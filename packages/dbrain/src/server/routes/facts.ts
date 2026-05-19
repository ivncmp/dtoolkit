import { randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import { loadConnections } from '../../core/config.js';
import { getConnection } from '../../core/connections.js';

import { requireWrite } from './permissions.js';

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

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
    if (!requireWrite(request, reply)) return;
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
    const authorId =
      request.brainUser?.userId === '_admin' ? null : (request.brainUser?.userId ?? null);
    db.prepare(
      "INSERT INTO facts (id, entity_id, fact, category, timestamp, last_accessed, access_count, tier, source, related_entities, author_id) VALUES (?, ?, ?, ?, ?, ?, 1, 'hot', ?, ?, ?)",
    ).run(
      id,
      entityId,
      fact,
      category || 'context',
      timestamp || now,
      now,
      source || 'api',
      JSON.stringify(relatedEntities || []),
      authorId,
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

  app.post('/facts/:id/share', async (request, reply) => {
    const config = app.config;
    if (config.brainType === 'shared')
      return reply.code(400).send({ error: 'Shared brains cannot push to other brains' });

    const connections = loadConnections(config.dataPath);
    if (connections.length === 0) return reply.code(400).send({ error: 'No connected brains' });

    const { id } = request.params as { id: string };
    const { targetBrain } = (request.body || {}) as { targetBrain?: string };

    const fact = db
      .prepare(
        'SELECT f.*, e.name as entity_name, e.type as entity_type, e.category as entity_category FROM facts f JOIN entities e ON e.id = f.entity_id WHERE f.id = ?',
      )
      .get(id) as
      | {
          id: string;
          entity_id: string;
          fact: string;
          category: string;
          timestamp: string;
          entity_name: string;
          entity_type: string;
          entity_category: string;
        }
      | undefined;

    if (!fact) return reply.code(404).send({ error: 'Fact not found' });

    const client = getConnection(connections, targetBrain);
    if (!client) return reply.code(400).send({ error: `Connection "${targetBrain}" not found` });

    try {
      try {
        await client.getEntity(fact.entity_id);
      } catch {
        await client.createEntity({
          id: fact.entity_id,
          name: fact.entity_name,
          type: fact.entity_type,
          category: fact.entity_category,
        });
      }

      const remoteFact = await client.addFact(fact.entity_id, {
        id: genId('fact'),
        fact: fact.fact,
        category: fact.category,
        timestamp: fact.timestamp,
        source: 'shared',
      });

      const target = targetBrain || connections[0]?.name || 'unknown';
      return { shared: true, targetBrain: target, remoteFact };
    } catch (err) {
      return reply.code(502).send({ error: `Failed to share: ${(err as Error).message}` });
    }
  });
}
