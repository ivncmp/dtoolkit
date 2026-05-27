import type { FastifyInstance } from 'fastify';

import { compact } from '../../core/compact.js';

export async function compactRoutes(app: FastifyInstance) {
  app.post('/compact', async (request, reply) => {
    if (request.brainUser?.userId !== '_admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const body = (request.body ?? {}) as {
      dryRun?: boolean;
      steps?: string[];
      threshold?: number;
      limit?: number;
    };

    const steps = (body.steps ?? ['dedup', 'tiers']).filter(
      (s): s is 'dedup' | 'tiers' | 'process' => ['dedup', 'tiers', 'process'].includes(s),
    );

    const result = await compact({
      db: app.db,
      tiers: app.config.tiers,
      threshold: body.threshold ?? app.config.compact.threshold,
      limit: body.limit ?? app.config.compact.limit,
      dryRun: body.dryRun,
      steps,
    });

    if (!body.dryRun) {
      const now = new Date().toISOString();
      const payload = JSON.stringify({ ...result, at: now });
      app.db
        .prepare(
          `INSERT INTO documents (key, title, content, updated_at)
           VALUES ('compact_last_run', 'Last Compact Run', ?, ?)
           ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
        )
        .run(payload, now);
    }

    return result;
  });
}
