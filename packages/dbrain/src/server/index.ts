import type Database from 'better-sqlite3';
import Fastify from 'fastify';

import type { Config } from '../core/config.js';
import { mountMcp } from '../mcp/server.js';

import { conversationRoutes } from './routes/conversations.js';
import { entityRoutes } from './routes/entities.js';
import { factRoutes } from './routes/facts.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { workspaceRoutes } from './routes/workspace.js';

export function createServer(config: Config, db: Database.Database) {
  const app = Fastify({ logger: true });

  app.decorate('db', db);
  app.decorate('config', config);

  app.addHook('onSend', async (request, reply, payload) => {
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
    if (!auth || auth !== `Bearer ${config.token}`) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.register(healthRoutes);
  app.register(entityRoutes);
  app.register(factRoutes);
  app.register(searchRoutes);
  app.register(workspaceRoutes);
  app.register(conversationRoutes);

  mountMcp(app);

  return app;
}
