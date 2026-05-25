import type { FastifyInstance } from 'fastify';

import * as syncService from '../../service/sync.js';

import { requireWrite } from './permissions.js';

export async function syncRoutes(app: FastifyInstance) {
  app.post('/sync/:slug', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug } = request.params as { slug: string };
    return syncService.syncProject(app.db, app.config, slug);
  });
}
