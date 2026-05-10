import type { FastifyInstance } from 'fastify';

export async function workspaceRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/workspace', async () => {
    return db.prepare('SELECT key, title, updated_at FROM documents ORDER BY key').all();
  });

  app.get('/workspace/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const doc = db.prepare('SELECT * FROM documents WHERE key = ?').get(key);
    if (!doc) return reply.code(404).send({ error: 'Document not found' });
    return doc;
  });

  app.put('/workspace/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const { title, content } = request.body as { title: string; content: string };
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT key FROM documents WHERE key = ?').get(key);
    if (existing) {
      db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE key = ?').run(
        title,
        content,
        now,
        key,
      );
    } else {
      db.prepare('INSERT INTO documents (key, title, content, updated_at) VALUES (?, ?, ?, ?)').run(
        key,
        title,
        content,
        now,
      );
    }

    return reply.code(existing ? 200 : 201).send({ key, title, updated_at: now });
  });

  app.delete('/workspace/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const result = db.prepare('DELETE FROM documents WHERE key = ?').run(key);
    if (result.changes === 0) return reply.code(404).send({ error: 'Document not found' });
    return { key, deleted: true };
  });
}
