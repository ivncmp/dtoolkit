declare const __VERSION__: string;

import { Command } from 'commander';
import Fastify from 'fastify';
import pc from 'picocolors';

import { loadConfig, getConfigValue, setConfigValue } from '../lib/config.js';
import {
  listHistory,
  getHistoryEntry,
  searchHistory,
  clearHistory,
} from '../lib/history-store.js';
import {
  listMemoryKeys,
  getMemory,
  setMemory,
  searchMemory,
  deleteMemory,
} from '../lib/memory-store.js';
import { executePrompt, streamPrompt } from '../lib/runner.js';
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  renderTemplate,
} from '../lib/template-store.js';
import type { ProviderName, TemplateDefinition } from '../lib/types.js';

/** Create the `dproxy serve` Commander command. */
export function createServeCommand(): Command {
  return new Command('serve')
    .description('Start the dproxy HTTP API server')
    .option('--port <port>', 'Port to listen on', parseInt)
    .option('--host <host>', 'Host to bind to')
    .action(async (opts) => {
      try {
        await runServe(opts);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runServe(opts: Record<string, unknown>): Promise<void> {
  const config = await loadConfig();
  const port = (opts.port as number) ?? config.server.port;
  const host = (opts.host as string) ?? config.server.host;
  const apiKey = config.server.apiKey;

  const app = Fastify({ logger: false });

  // --- Auth hook ---
  if (apiKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/v1/health') return;
      const provided = request.headers['x-api-key'];
      if (provided !== apiKey) {
        reply.code(401).send({ error: 'Invalid or missing API key' });
      }
    });
  }

  // --- Health ---
  app.get('/v1/health', async () => {
    const cfg = await loadConfig();
    return {
      status: 'ok',
      provider: cfg.provider.default,
      version: __VERSION__,
    };
  });

  // --- Ask ---
  interface AskBody {
    prompt: string;
    stream?: boolean;
    provider?: ProviderName;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    systemPrompt?: string;
    memory?: boolean | string[];
    life?: boolean;
    workspace?: boolean;
    chatLog?: boolean;
    sessionId?: string;
    continueSession?: boolean;
    maxSessionTokens?: number;
    saveHistory?: boolean;
    saveChatLog?: boolean;
  }

  app.post<{ Body: AskBody }>('/v1/ask', async (request, reply) => {
    const body = request.body;
    if (!body?.prompt) {
      return reply.code(400).send({ error: 'prompt is required' });
    }

    const runnerOpts = {
      provider: body.provider,
      model: body.model,
      maxTurns: body.maxTurns,
      maxBudgetUsd: body.maxBudgetUsd,
      systemPrompt: body.systemPrompt,
      memory: body.memory,
      life: body.life,
      workspace: body.workspace,
      chatLog: body.chatLog,
      sessionId: body.sessionId,
      continueSession: body.continueSession,
      maxSessionTokens: body.maxSessionTokens,
      saveHistory: body.saveHistory,
      saveChatLog: body.saveChatLog,
    };

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      try {
        for await (const event of streamPrompt(body.prompt, runnerOpts)) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        reply.raw.write('data: [DONE]\n\n');
      } catch (err) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`);
      }

      reply.raw.end();
      return reply;
    }

    const result = await executePrompt(body.prompt, runnerOpts);
    return result;
  });

  // --- History ---
  app.get<{ Querystring: { limit?: string } }>('/v1/history', async (request) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    return { entries: await listHistory(limit) };
  });

  app.get<{ Params: { id: string } }>('/v1/history/:id', async (request, reply) => {
    const entry = await getHistoryEntry(request.params.id);
    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    return entry;
  });

  app.get<{ Querystring: { q: string } }>('/v1/history/search', async (request, reply) => {
    if (!request.query.q) {
      return reply.code(400).send({ error: 'q query parameter is required' });
    }
    return { entries: await searchHistory(request.query.q) };
  });

  app.delete<{ Querystring: { before?: string } }>('/v1/history', async (request) => {
    const removed = await clearHistory(request.query.before);
    return { removed };
  });

  // --- Memory ---
  app.get('/v1/memory', async () => {
    return { keys: await listMemoryKeys() };
  });

  app.get<{ Querystring: { q: string } }>('/v1/memory/search', async (request, reply) => {
    if (!request.query.q) {
      return reply.code(400).send({ error: 'q query parameter is required' });
    }
    return { results: await searchMemory(request.query.q) };
  });

  app.get<{ Params: { key: string } }>('/v1/memory/:key', async (request, reply) => {
    const content = await getMemory(request.params.key);
    if (content === null) {
      return reply.code(404).send({ error: `Memory "${request.params.key}" not found` });
    }
    return { key: request.params.key, content };
  });

  app.put<{ Params: { key: string }; Body: { content: string } }>(
    '/v1/memory/:key',
    async (request, reply) => {
      if (!request.body?.content) {
        return reply.code(400).send({ error: 'content is required' });
      }
      await setMemory(request.params.key, request.body.content);
      return { ok: true, key: request.params.key };
    },
  );

  app.delete<{ Params: { key: string } }>('/v1/memory/:key', async (request, reply) => {
    const deleted = await deleteMemory(request.params.key);
    if (!deleted) {
      return reply.code(404).send({ error: `Memory "${request.params.key}" not found` });
    }
    return { ok: true, key: request.params.key };
  });

  // --- Templates ---
  app.get('/v1/templates', async () => {
    return { templates: await listTemplates() };
  });

  app.get<{ Params: { name: string } }>('/v1/templates/:name', async (request, reply) => {
    const t = await getTemplate(request.params.name);
    if (!t) {
      return reply.code(404).send({ error: `Template "${request.params.name}" not found` });
    }
    return t;
  });

  app.put<{ Params: { name: string }; Body: TemplateDefinition }>(
    '/v1/templates/:name',
    async (request, reply) => {
      if (!request.body?.prompt) {
        return reply.code(400).send({ error: 'prompt is required' });
      }
      const template: TemplateDefinition = {
        ...request.body,
        name: request.params.name,
      };
      await saveTemplate(template);
      return { ok: true, name: request.params.name };
    },
  );

  app.post<{
    Params: { name: string };
    Body: {
      vars?: Record<string, string>;
      model?: string;
      maxTurns?: number;
      maxBudgetUsd?: number;
      provider?: ProviderName;
    };
  }>('/v1/templates/:name/run', async (request, reply) => {
    const t = await getTemplate(request.params.name);
    if (!t) {
      return reply.code(404).send({ error: `Template "${request.params.name}" not found` });
    }

    const vars = request.body?.vars ?? {};

    if (t.variables) {
      for (const v of t.variables) {
        if (!(v.name in vars) && v.default) {
          vars[v.name] = v.default;
        }
        if (v.required && !(v.name in vars)) {
          return reply.code(400).send({ error: `Missing required variable: {{${v.name}}}` });
        }
      }
    }

    const rendered = renderTemplate(t, vars);
    const result = await executePrompt(rendered, {
      model: request.body?.model ?? t.claudeOptions?.model,
      maxTurns: request.body?.maxTurns ?? t.claudeOptions?.maxTurns,
      maxBudgetUsd: request.body?.maxBudgetUsd ?? t.claudeOptions?.maxBudgetUsd,
      provider: request.body?.provider,
    });
    return result;
  });

  app.delete<{ Params: { name: string } }>('/v1/templates/:name', async (request, reply) => {
    const deleted = await deleteTemplate(request.params.name);
    if (!deleted) {
      return reply.code(404).send({ error: `Template "${request.params.name}" not found` });
    }
    return { ok: true, name: request.params.name };
  });

  // --- Config ---
  app.get('/v1/config', async () => {
    const cfg = await loadConfig();
    return cfg;
  });

  app.get<{ Params: { '*': string } }>('/v1/config/*', async (request, reply) => {
    const key = request.params['*'];
    const value = await getConfigValue(key);
    if (value === undefined) {
      return reply.code(404).send({ error: `Config key "${key}" not found` });
    }
    return { key, value };
  });

  app.put<{ Params: { '*': string }; Body: { value: string } }>(
    '/v1/config/*',
    async (request, reply) => {
      const key = request.params['*'];
      if (request.body?.value === undefined) {
        return reply.code(400).send({ error: 'value is required' });
      }
      await setConfigValue(key, String(request.body.value));
      return { ok: true, key, value: request.body.value };
    },
  );

  // --- Start ---
  await app.listen({ port, host });

  console.log(pc.green(`\ndproxy server listening on ${pc.bold(`http://${host}:${port}`)}`));
  console.log(pc.dim(`Provider: ${config.provider.default}`));
  if (apiKey) {
    console.log(pc.dim('Auth: API key required (X-API-Key header)'));
  } else {
    console.log(pc.dim('Auth: disabled (set server.apiKey to enable)'));
  }
  console.log(pc.dim('\nPress Ctrl+C to stop.\n'));
}
