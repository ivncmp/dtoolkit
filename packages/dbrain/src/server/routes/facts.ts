import type { FastifyInstance } from 'fastify';

interface FactRow {
  related_entities: string;
  [k: string]: unknown;
}

export async function factRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/entities/:entityId/facts', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { tier } = request.query as { tier?: string };
    if (!db.prepare('SELECT id FROM entities WHERE id = ?').get(entityId))
      return reply.code(404).send({ error: 'Entity not found' });

    let sql = 'SELECT * FROM facts WHERE entity_id = ?';
    const params: string[] = [entityId];
    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }
    sql += ' ORDER BY access_count DESC, last_accessed DESC';

    return (db.prepare(sql).all(...params) as FactRow[]).map((f) => ({
      ...f,
      related_entities: JSON.parse(f.related_entities),
    }));
  });

  app.post('/entities/:entityId/facts', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { id, fact, category, timestamp, source, relatedEntities } = request.body as {
      id: string;
      fact: string;
      category?: string;
      timestamp?: string;
      source?: string;
      relatedEntities?: string[];
    };
    if (!db.prepare('SELECT id FROM entities WHERE id = ?').get(entityId))
      return reply.code(404).send({ error: 'Entity not found' });

    const now = new Date().toISOString().split('T')[0];
    db.prepare(
      "INSERT INTO facts (id, entity_id, fact, category, timestamp, last_accessed, access_count, tier, source, related_entities) VALUES (?, ?, ?, ?, ?, ?, 1, 'hot', ?, ?)",
    ).run(
      id,
      entityId,
      fact,
      category || 'context',
      timestamp || now,
      now,
      source || 'api',
      JSON.stringify(relatedEntities || []),
    );

    db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?').run(now, entityId);
    return reply.code(201).send({ id, entityId, fact });
  });

  app.patch('/facts/:id/access', async (request, reply) => {
    const { id } = request.params as { id: string };
    const now = new Date().toISOString().split('T')[0];
    const result = db
      .prepare(
        "UPDATE facts SET last_accessed = ?, access_count = access_count + 1, tier = 'hot' WHERE id = ?",
      )
      .run(now, id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Fact not found' });
    return { id, bumped: true };
  });
}
