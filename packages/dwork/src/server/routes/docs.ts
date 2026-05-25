import type { FastifyInstance } from 'fastify';

import * as docService from '../../service/docs.js';

import { requireWrite } from './permissions.js';

export async function docRoutes(app: FastifyInstance) {
  const { db, config } = app;

  app.get('/projects/:slug/docs', async (request) => {
    const { slug } = request.params as { slug: string };
    const { type } = request.query as { type?: string };
    return docService.listDocs(db, slug, type);
  });

  app.post('/projects/:slug/docs', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const { title, body, type } = request.body as {
      title: string;
      body: string;
      type: string;
    };
    if (!title || !body || !type) {
      return reply.code(400).send({ error: 'title, body, and type are required' });
    }

    try {
      const result = docService.addDoc(db, config, slug, title, body, type);
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  app.get('/docs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = docService.getDoc(db, config, id);
    if (!result) return reply.code(404).send({ error: 'Doc not found' });
    return result;
  });

  app.patch('/docs/:id', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const changes = request.body as { title?: string; body?: string; type?: string };
    const ok = docService.updateDoc(db, config, id, changes);
    if (!ok) return reply.code(404).send({ error: 'Doc not found' });
    return { updated: true, id };
  });

  app.delete('/docs/:id', async (request, reply) => {
    if (!requireWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const ok = docService.deleteDoc(db, config, id);
    if (!ok) return reply.code(404).send({ error: 'Doc not found' });
    return { deleted: true, id };
  });
}
