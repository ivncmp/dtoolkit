import type Database from 'better-sqlite3';
import Fastify from 'fastify';

import type { Config } from '../core/config.js';
import { mountMcp } from '../mcp/server.js';

import { docRoutes } from './routes/docs.js';
import { healthRoutes } from './routes/health.js';
import { keyRoutes } from './routes/keys.js';
import { overviewRoutes } from './routes/overview.js';
import { projectRoutes } from './routes/projects.js';
import { searchRoutes } from './routes/search.js';
import { syncRoutes } from './routes/sync.js';
import { taskRoutes } from './routes/tasks.js';

export function createServer(config: Config, db: Database.Database) {
  const app = Fastify({ logger: true });

  app.decorate('db', db);
  app.decorate('config', config);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    return payload;
  });

  app.options('/*', async (_, reply) => {
    reply.status(204).send();
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    if (request.url === '/health') return;

    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = auth.slice(7);

    if (token === config.token) {
      request.dworkUser = { userId: '_admin', userName: 'Admin', permissions: 'read+write' };
      return;
    }

    const key = db
      .prepare(
        "SELECT user_id, user_name, permissions FROM api_keys WHERE token = ? AND status = 'active'",
      )
      .get(token) as { user_id: string; user_name: string; permissions: string } | undefined;

    if (key) {
      db.prepare('UPDATE api_keys SET last_used = ? WHERE token = ?').run(
        new Date().toISOString(),
        token,
      );
      request.dworkUser = {
        userId: key.user_id,
        userName: key.user_name,
        permissions: key.permissions,
      };
      return;
    }

    return reply.code(401).send({ error: 'Unauthorized' });
  });

  app.register(healthRoutes);
  app.register(projectRoutes);
  app.register(taskRoutes);
  app.register(docRoutes);
  app.register(searchRoutes);
  app.register(overviewRoutes);
  app.register(syncRoutes);
  app.register(keyRoutes);
  mountMcp(app);

  return app;
}
