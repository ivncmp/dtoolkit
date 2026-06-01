import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const stats = app.db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM sessions) AS sessions,
          (SELECT COUNT(*) FROM events) AS events,
          (SELECT COUNT(*) FROM tool_calls) AS tool_calls,
          (SELECT COUNT(*) FROM errors) AS errors,
          (SELECT COUNT(*) FROM token_usage) AS token_records`,
      )
      .get() as {
      sessions: number;
      events: number;
      tool_calls: number;
      errors: number;
      token_records: number;
    };

    return {
      status: 'ok',
      service: 'dops',
      version: pkg.version,
      port: app.config.port,
      pricing: app.config.pricing,
      stats,
    };
  });
}
