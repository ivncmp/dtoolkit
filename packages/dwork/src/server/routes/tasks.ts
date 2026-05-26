import type { FastifyInstance } from 'fastify';

import * as taskService from '../../service/tasks.js';

import { requireWrite } from './permissions.js';

export async function taskRoutes(app: FastifyInstance) {
  const { db, config } = app;

  app.get('/projects/:slug/tasks', async (request) => {
    const { slug } = request.params as { slug: string };
    const { status, priority } = request.query as { status?: string; priority?: string };
    return taskService.getTasks(db, slug, status, priority);
  });

  app.post('/projects/:slug/tasks', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const { title, ...opts } = request.body as {
      title: string;
      type?: string;
      priority?: string;
      status?: string;
      estimate?: string;
      deadline?: string;
      detail?: string;
      detail_doc?: { title: string; body: string; type: string };
      source?: string;
    };
    if (!title) return reply.code(400).send({ error: 'title is required' });

    try {
      const result = taskService.addTask(db, config, slug, title, opts);
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  app.patch('/tasks/:id', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const changes = request.body as {
      title?: string;
      status?: string;
      priority?: string;
      type?: string;
      estimate?: string;
      deadline?: string;
      detail?: string;
    };
    const ok = taskService.updateTask(db, config, id, changes);
    if (!ok) return reply.code(404).send({ error: 'Task not found' });
    return { updated: true, id };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const ok = taskService.deleteTask(db, config, id);
    if (!ok) return reply.code(404).send({ error: 'Task not found' });
    return { deleted: true, id };
  });
}
