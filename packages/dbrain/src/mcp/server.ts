import { randomBytes } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

export function createMcpServer(app: FastifyInstance) {
  const db = app.db;

  const mcp = new McpServer({
    name: 'dbrain',
    version: '0.1.0',
  });

  // --- brain context: auto-loaded resource ---
  mcp.registerResource(
    'brain',
    'dbrain://brain',
    {
      title: 'dbrain',
      description: 'Your connected AI brain — identity, user, and how to use memory tools',
      mimeType: 'text/plain',
    },
    async () => {
      const identity = db.prepare("SELECT content FROM documents WHERE key = 'identity'").get() as
        | { content: string }
        | undefined;
      const user = db.prepare("SELECT content FROM documents WHERE key = 'user'").get() as
        | { content: string }
        | undefined;
      const { entities } = db.prepare('SELECT COUNT(*) as entities FROM entities').get() as {
        entities: number;
      };
      const { facts } = db.prepare('SELECT COUNT(*) as facts FROM facts').get() as {
        facts: number;
      };

      const lines = [
        'You have an AI brain connected (dbrain).',
        '',
        identity?.content || '',
        '',
        user?.content || '',
        '',
        `Brain stats: ${entities} entities, ${facts} facts stored.`,
        '',
        'IMPORTANT: Use the `recall` tool BEFORE answering any question about the user, their preferences, projects, or past conversations.',
        'Use `remember` to save new facts when the user shares something worth remembering.',
      ];

      return {
        contents: [
          {
            uri: 'dbrain://brain',
            text: lines.join('\n'),
          },
        ],
      };
    },
  );

  // --- wake_up: first thing an AI should call ---
  mcp.registerTool(
    'wake_up',
    {
      description: `Call this ONCE at the start of every conversation. Returns your identity, the user profile, and behavioral rules. You are not ready to help until you've called this.`,
    },
    async () => {
      const docs = db.prepare('SELECT key, title, content FROM documents ORDER BY key').all() as {
        key: string;
        title: string;
        content: string;
      }[];
      const { entities } = db.prepare('SELECT COUNT(*) as entities FROM entities').get() as {
        entities: number;
      };
      const { facts } = db.prepare('SELECT COUNT(*) as facts FROM facts').get() as {
        facts: number;
      };
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ documents: docs, stats: { entities, facts } }),
          },
        ],
      };
    },
  );

  // --- recall: search memory ---
  mcp.registerTool(
    'recall',
    {
      description: `Search your memory. Use this BEFORE answering any question about the user, their projects, preferences, or past conversations. If you're not sure, search first.`,
      inputSchema: {
        query: z.string().describe('What to search for'),
        limit: z.number().optional().default(10).describe('Max results'),
      },
    },
    async ({ query, limit }) => {
      const ftsQuery = query.split(/\s+/).filter(Boolean).join(' OR ');
      const results = db
        .prepare(
          `
      SELECT f.*, e.name as entity_name, e.type as entity_type, rank
      FROM facts_fts fts
      JOIN facts f ON f.rowid = fts.rowid
      JOIN entities e ON e.id = f.entity_id
      WHERE facts_fts MATCH ?
      ORDER BY rank LIMIT ?
    `,
        )
        .all(ftsQuery, limit) as {
        id: string;
        fact: string;
        entity_name: string;
        entity_type: string;
        category: string;
        tier: string;
        rank: number;
      }[];

      const now = new Date().toISOString().split('T')[0];
      const bumpStmt = db.prepare(
        'UPDATE facts SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?',
      );
      for (const r of results) bumpStmt.run(now, r.id);

      const docs = db.prepare('SELECT key, content FROM documents ORDER BY key').all() as {
        key: string;
        content: string;
      }[];

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              identity: Object.fromEntries(docs.map((d) => [d.key, d.content])),
              results: results.map((r) => ({
                fact: r.fact,
                entity: r.entity_name,
                entityType: r.entity_type,
                category: r.category,
                tier: r.tier,
                score: -r.rank,
              })),
            }),
          },
        ],
      };
    },
  );

  // --- remember: save a fact ---
  mcp.registerTool(
    'remember',
    {
      description: `Save something important to memory. You MUST use this when:
- The user shares a preference, opinion, or personal detail
- A decision is made about a project
- Something happens that the user would want remembered later
- The user explicitly says "remember this"

Extract a clear, atomic fact. One fact per call.
Bad:  "We talked about React and the user likes it"
Good: "User prefers React over Vue for new frontend projects"`,
      inputSchema: {
        entityId: z.string().describe('Entity to attach the fact to'),
        fact: z.string().describe('The fact to remember — clear, atomic, one sentence'),
        category: z
          .string()
          .optional()
          .default('context')
          .describe('Fact category: context, milestone, status, preference, relationship'),
      },
    },
    async ({ entityId, fact, category }) => {
      const entity = db.prepare('SELECT id FROM entities WHERE id = ?').get(entityId);
      if (!entity) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: `Entity '${entityId}' not found. Create it first or use list_entities to find the right one.`,
              }),
            },
          ],
        };
      }

      const id = genId('fact');
      const now = new Date().toISOString().split('T')[0];
      db.prepare(
        "INSERT INTO facts (id, entity_id, fact, category, timestamp, last_accessed, access_count, tier, source, related_entities) VALUES (?, ?, ?, ?, ?, ?, 1, 'hot', 'mcp', '[]')",
      ).run(id, entityId, fact, category, now, now);
      db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?').run(now, entityId);

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ saved: true, id, entityId, fact }) },
        ],
      };
    },
  );

  // --- get_entity: read entity with facts ---
  mcp.registerTool(
    'get_entity',
    {
      description:
        'Read an entity and all its facts. Use this to get full context about a project, person, system, or event.',
      inputSchema: {
        id: z.string().describe('Entity ID'),
      },
    },
    async ({ id }) => {
      const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as
        | { metadata: string | null; [k: string]: unknown }
        | undefined;
      if (!entity) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Entity not found' }) }],
        };
      }

      const facts = db
        .prepare(
          'SELECT id, fact, category, tier, access_count, last_accessed FROM facts WHERE entity_id = ? ORDER BY tier ASC, access_count DESC',
        )
        .all(id);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              ...entity,
              metadata: entity.metadata ? JSON.parse(entity.metadata) : null,
              facts,
            }),
          },
        ],
      };
    },
  );

  // --- list_entities ---
  mcp.registerTool(
    'list_entities',
    {
      description: 'List all known entities. Filter by PARA category or type.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('PARA category: projects, areas, resources, archives'),
        type: z
          .string()
          .optional()
          .describe('Entity type: project, person, system, event, resource'),
      },
    },
    async ({ category, type }) => {
      let sql = "SELECT id, name, type, category, status FROM entities WHERE status = 'active'";
      const params: string[] = [];
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      sql += ' ORDER BY updated_at DESC';

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(db.prepare(sql).all(...params)) }],
      };
    },
  );

  // --- create_entity ---
  mcp.registerTool(
    'create_entity',
    {
      description:
        'Create a new entity (project, person, system, event). Use this before remembering facts about something new.',
      inputSchema: {
        id: z.string().describe("Unique ID (lowercase, no spaces, e.g. 'my-project')"),
        name: z.string().describe('Display name'),
        type: z.enum(['project', 'person', 'system', 'event', 'resource']).describe('Entity type'),
        category: z.enum(['projects', 'areas', 'resources', 'archives']).describe('PARA category'),
      },
    },
    async ({ id, name, type, category }) => {
      const existing = db.prepare('SELECT id FROM entities WHERE id = ?').get(id);
      if (existing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Entity '${id}' already exists` }),
            },
          ],
        };
      }

      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO entities (id, name, type, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, name, type, category, now, now);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ created: true, id, name, type, category }),
          },
        ],
      };
    },
  );

  // --- bump: keep a memory hot ---
  mcp.registerTool(
    'bump',
    {
      description:
        'Touch a memory to keep it alive. Call this when you use a fact to answer a question.',
      inputSchema: {
        factId: z.string().describe('Fact ID to bump'),
      },
    },
    async ({ factId }) => {
      const now = new Date().toISOString().split('T')[0];
      const result = db
        .prepare(
          "UPDATE facts SET last_accessed = ?, access_count = access_count + 1, tier = 'hot' WHERE id = ?",
        )
        .run(now, factId);

      if (result.changes === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Fact not found' }) }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ bumped: true, factId }) }],
      };
    },
  );

  // --- log: store conversation messages ---
  mcp.registerTool(
    'log',
    {
      description: `Send conversation messages to the brain for storage. Call this periodically during the conversation to log what's happening. Send both user and assistant messages.`,
      inputSchema: {
        source: z
          .string()
          .describe("Where this conversation is from, e.g. 'claude-code-home', 'gemini-mobile'"),
        conversationId: z
          .string()
          .optional()
          .describe('Existing conversation ID. Omit to start a new one.'),
        messages: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          )
          .describe('Messages to log'),
      },
    },
    async ({ source, conversationId, messages }) => {
      let convId = conversationId;
      if (!convId) {
        convId = genId('conv');
        db.prepare('INSERT INTO conversations (id, source, started_at) VALUES (?, ?, ?)').run(
          convId,
          source,
          new Date().toISOString(),
        );
      }

      const insert = db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      );
      const now = new Date().toISOString();
      for (const m of messages) {
        insert.run(genId('msg'), convId, m.role, m.content, now);
      }

      db.prepare('UPDATE conversations SET ended_at = ? WHERE id = ?').run(now, convId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ logged: true, conversationId: convId, count: messages.length }),
          },
        ],
      };
    },
  );

  // --- overview: brain stats ---
  mcp.registerTool(
    'overview',
    {
      description:
        'Get a summary of everything in the brain: entities, facts by tier, conversations.',
      inputSchema: {},
    },
    async () => {
      const entities = db
        .prepare(
          `
      SELECT e.id, e.name, e.type, e.category,
        COUNT(CASE WHEN f.tier = 'hot' THEN 1 END) as hot,
        COUNT(CASE WHEN f.tier = 'warm' THEN 1 END) as warm,
        COUNT(CASE WHEN f.tier = 'cold' THEN 1 END) as cold,
        COUNT(f.id) as total
      FROM entities e LEFT JOIN facts f ON f.entity_id = e.id
      WHERE e.status = 'active' GROUP BY e.id ORDER BY total DESC
    `,
        )
        .all();

      const { conversations } = db
        .prepare('SELECT COUNT(*) as conversations FROM conversations')
        .get() as { conversations: number };
      const { messages } = db.prepare('SELECT COUNT(*) as messages FROM messages').get() as {
        messages: number;
      };
      const { unprocessed } = db
        .prepare('SELECT COUNT(*) as unprocessed FROM messages WHERE processed = 0')
        .get() as { unprocessed: number };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ entities, conversations, messages, unprocessed }),
          },
        ],
      };
    },
  );

  return mcp;
}

function logMcpRequest(app: FastifyInstance, body: unknown) {
  const msg = body as { method?: string; params?: Record<string, unknown> };
  if (!msg?.method) return;

  const method = msg.method;
  const params = msg.params ?? {};

  if (method === 'initialize') {
    app.log.info({ mcp: method }, 'MCP client connected');
  } else if (method === 'notifications/initialized') {
    // silent
  } else if (method === 'tools/call') {
    const toolName = params.name ?? 'unknown';
    const toolArgs = params.arguments ?? {};
    app.log.info({ mcp: method, tool: toolName, args: toolArgs }, `MCP tool: ${toolName}`);
  } else if (
    method === 'tools/list' ||
    method === 'resources/list' ||
    method === 'resources/read'
  ) {
    app.log.info({ mcp: method }, `MCP ${method}`);
  }
}

export function mountMcp(app: FastifyInstance) {
  app.all('/mcp', async (request, reply) => {
    const raw = request.raw;
    const res = reply.raw;

    reply.hijack();

    if (request.method === 'POST') {
      logMcpRequest(app, request.body);
      const server = createMcpServer(app);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(raw, res, request.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } else if (request.method === 'GET') {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        }),
      );
    } else if (request.method === 'DELETE') {
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
