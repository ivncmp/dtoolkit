import type { FastifyInstance } from 'fastify';

import * as projectService from '../../service/projects.js';

import { requireWrite } from './permissions.js';

export async function projectRoutes(app: FastifyInstance) {
  const { db, config } = app;

  app.get('/projects', async (request) => {
    const { status } = request.query as { status?: string };
    return projectService.listProjects(db, status);
  });

  app.get('/projects/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const result = projectService.getProject(db, config, slug);
    if (!result) return reply.code(404).send({ error: 'Project not found' });
    return result;
  });

  app.post('/projects', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug, name, description, source_path } = request.body as {
      slug: string;
      name: string;
      description?: string;
      source_path?: string;
    };
    if (!slug || !name) return reply.code(400).send({ error: 'slug and name are required' });

    try {
      const result = projectService.createProject(db, config, slug, name, description, source_path);
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(409).send({ error: (err as Error).message });
    }
  });

  app.patch('/projects/:slug', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const changes = request.body as {
      name?: string;
      description?: string;
      status?: string;
      source_path?: string;
    };
    const ok = projectService.updateProject(db, slug, changes);
    if (!ok) return reply.code(404).send({ error: 'Project not found' });
    return { updated: true, slug };
  });

  app.delete('/projects/:slug', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const ok = projectService.archiveProject(db, slug);
    if (!ok) return reply.code(404).send({ error: 'Project not found' });
    return { archived: true, slug };
  });
}
