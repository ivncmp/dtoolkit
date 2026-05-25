import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function healthRoutes(app: FastifyInstance) {
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
    );
    version = pkg.version;
  } catch {
    // ok
  }

  app.get('/health', async () => {
    const { projects } = app.db.prepare('SELECT COUNT(*) as projects FROM projects').get() as {
      projects: number;
    };
    const { tasks } = app.db.prepare('SELECT COUNT(*) as tasks FROM tasks').get() as {
      tasks: number;
    };
    const { docs } = app.db.prepare('SELECT COUNT(*) as docs FROM docs').get() as { docs: number };

    return {
      status: 'ok',
      version,
      projects,
      tasks,
      docs,
    };
  });
}
