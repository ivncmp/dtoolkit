import type { FastifyInstance } from 'fastify';

import * as overviewService from '../../service/overview.js';
import * as taskService from '../../service/tasks.js';

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/overview', async () => {
    return overviewService.overview(app.db);
  });

  app.get('/next', async (request) => {
    const { project } = request.query as { project?: string };
    const tasks = taskService.whatToDoNext(app.db, project);
    return taskService.enrichTasksWithDetails(app.db, tasks);
  });
}
