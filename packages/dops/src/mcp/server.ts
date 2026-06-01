import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as query from '../service/query.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export function createMcpServer(app: FastifyInstance) {
  const db = app.db;

  const mcp = new McpServer({
    name: 'dops',
    version: pkg.version,
  });

  mcp.registerTool(
    'observe',
    {
      description:
        'Get a quick overview of agent activity: total sessions, tokens, tool calls, and errors. Use this to understand how much work agents have been doing.',
      inputSchema: {
        from: z.string().optional().describe('Start date (ISO 8601)'),
        to: z.string().optional().describe('End date (ISO 8601)'),
        source: z.string().optional().describe('Filter by source: claude, codex, gemini, opencode'),
      },
    },
    async ({ from, to, source }) => {
      const sessions = query.listSessions(db, { from, to, source, limit: 1000 });
      const models = query.getModelStats(db, { from, to });
      const sources = query.getSourceStats(db, { from, to });

      const totalInput = sessions.reduce((s, r) => s + r.total_input, 0);
      const totalOutput = sessions.reduce((s, r) => s + r.total_output, 0);
      const totalCacheRead = sessions.reduce((s, r) => s + r.total_cache_read, 0);
      const totalTools = sessions.reduce((s, r) => s + r.tool_count, 0);
      const totalErrors = sessions.reduce((s, r) => s + r.error_count, 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              sessions: sessions.length,
              tokens: {
                input: totalInput,
                output: totalOutput,
                cache_read: totalCacheRead,
              },
              tool_calls: totalTools,
              errors: totalErrors,
              models,
              sources,
            }),
          },
        ],
      };
    },
  );

  mcp.registerTool(
    'stats',
    {
      description:
        'Get time-series token usage data for graphing. Returns buckets grouped by hour or 15 minutes.',
      inputSchema: {
        from: z.string().optional().describe('Start date (ISO 8601)'),
        to: z.string().optional().describe('End date (ISO 8601)'),
        source: z.string().optional().describe('Filter by source'),
        interval: z.enum(['1h', '15m']).optional().default('1h').describe('Bucket size'),
      },
    },
    async ({ from, to, source, interval }) => {
      const data = query.getTimeSeries(db, { from, to, source, interval });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
      };
    },
  );

  mcp.registerTool(
    'tools',
    {
      description:
        'Get tool usage analytics: call frequency, success/failure rates, and average duration per tool.',
      inputSchema: {
        from: z.string().optional().describe('Start date (ISO 8601)'),
        to: z.string().optional().describe('End date (ISO 8601)'),
        source: z.string().optional().describe('Filter by source'),
      },
    },
    async ({ from, to, source }) => {
      const data = query.getToolStats(db, { from, to, source });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
      };
    },
  );

  mcp.registerTool(
    'sessions',
    {
      description:
        'List recent agent sessions with token and tool summaries. Filter by source, model, or date range.',
      inputSchema: {
        source: z.string().optional().describe('Filter: claude, codex, gemini, opencode'),
        model: z.string().optional().describe('Filter by model name'),
        from: z.string().optional().describe('Start date (ISO 8601)'),
        to: z.string().optional().describe('End date (ISO 8601)'),
        limit: z.number().optional().default(20).describe('Max results'),
      },
    },
    async ({ source, model, from, to, limit }) => {
      const data = query.listSessions(db, { source, model, from, to, limit });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
      };
    },
  );

  mcp.registerTool(
    'session_detail',
    {
      description:
        'Get full details for a single session: all token usage records, tool calls with args, and errors.',
      inputSchema: {
        id: z.string().describe('Session ID'),
      },
    },
    async ({ id }) => {
      const data = query.getSession(db, id);
      if (!data) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ error: 'Session not found' }) },
          ],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
      };
    },
  );

  mcp.registerTool(
    'errors',
    {
      description: 'List recent errors across all agent sessions.',
      inputSchema: {
        from: z.string().optional().describe('Start date (ISO 8601)'),
        to: z.string().optional().describe('End date (ISO 8601)'),
        limit: z.number().optional().default(50).describe('Max results'),
      },
    },
    async ({ from, to, limit }) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (from) {
        conditions.push('e.timestamp >= ?');
        params.push(from);
      }
      if (to) {
        conditions.push('e.timestamp <= ?');
        params.push(to);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const data = db
        .prepare(
          `SELECT e.id, e.session_id, e.type, e.message, e.timestamp
           FROM errors e ${where}
           ORDER BY e.timestamp DESC LIMIT ?`,
        )
        .all(...params, limit);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
      };
    },
  );

  return mcp;
}

export function mountMcp(app: FastifyInstance) {
  app.all('/mcp', async (request, reply) => {
    const raw = request.raw;
    const res = reply.raw;

    reply.hijack();

    if (request.method === 'POST') {
      const server = createMcpServer(app);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(raw, res, request.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } else {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        }),
      );
    }
  });
}
