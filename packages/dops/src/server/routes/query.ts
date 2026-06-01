import type { FastifyInstance } from 'fastify';

import * as query from '../../service/query.js';

export async function queryRoutes(app: FastifyInstance) {
  app.get('/sessions', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return query.listSessions(app.db, {
      source: q['source'],
      model: q['model'],
      status: q['status'],
      from: q['from'],
      to: q['to'],
      limit: q['limit'] ? parseInt(q['limit'], 10) : undefined,
      offset: q['offset'] ? parseInt(q['offset'], 10) : undefined,
    });
  });

  app.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = query.getSession(app.db, id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return session;
  });

  app.get('/stats/timeseries', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return query.getTimeSeries(app.db, {
      from: q['from'],
      to: q['to'],
      source: q['source'],
      interval: q['interval'],
    });
  });

  app.get('/stats/tools', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return query.getToolStats(app.db, {
      from: q['from'],
      to: q['to'],
      source: q['source'],
    });
  });

  app.get('/stats/models', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return query.getModelStats(app.db, {
      from: q['from'],
      to: q['to'],
    });
  });

  app.get('/stats/sources', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return query.getSourceStats(app.db, {
      from: q['from'],
      to: q['to'],
    });
  });
}
