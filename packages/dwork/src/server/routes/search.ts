import type { FastifyInstance } from 'fastify';

import * as searchService from '../../service/search.js';

export async function searchRoutes(app: FastifyInstance) {
  app.post('/search', async (request, reply) => {
    const { query, project, limit } = request.body as {
      query: string;
      project?: string;
      limit?: number;
    };
    if (!query) return reply.code(400).send({ error: 'query is required' });
    return searchService.search(app.db, query, project, limit);
  });
}
