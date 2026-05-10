import type { FastifyInstance } from 'fastify';

interface EntityRow {
  metadata: string | null;
  [k: string]: unknown;
}

interface FactRow {
  related_entities: string;
  [k: string]: unknown;
}

export async function entityRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/entities', async (request) => {
    const { category, type } = request.query as { category?: string; type?: string };
    let sql = "SELECT * FROM entities WHERE status = 'active'";
    const params: string[] = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC';
    return (db.prepare(sql).all(...params) as EntityRow[]).map((e) => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));
  });

  app.get('/entities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as
      | EntityRow
      | undefined;
    if (!entity) return reply.code(404).send({ error: 'Entity not found' });

    const facts = db
      .prepare('SELECT * FROM facts WHERE entity_id = ? ORDER BY tier ASC, access_count DESC')
      .all(id) as FactRow[];

    return {
      ...entity,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : null,
      facts: facts.map((f) => ({ ...f, related_entities: JSON.parse(f.related_entities) })),
    };
  });

  app.post('/entities', async (request, reply) => {
    const { id, name, type, category, metadata } = request.body as {
      id: string;
      name: string;
      type: string;
      category: string;
      metadata?: Record<string, unknown>;
    };
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO entities (id, name, type, category, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, name, type, category, now, now, metadata ? JSON.stringify(metadata) : null);
    return reply.code(201).send({ id, name, type, category });
  });

  app.delete('/entities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = db
      .prepare("UPDATE entities SET status = 'archived', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Entity not found' });
    return { id, status: 'archived' };
  });
}
