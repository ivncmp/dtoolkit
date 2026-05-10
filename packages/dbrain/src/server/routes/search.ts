import type { FastifyInstance } from 'fastify';

interface SearchResultRow {
  id: string;
  entity_id: string;
  fact: string;
  category: string;
  timestamp: string;
  status: string;
  last_accessed: string;
  access_count: number;
  tier: string;
  source: string | null;
  entity_name: string;
  entity_type: string;
  entity_category: string;
  rank: number;
}

export async function searchRoutes(app: FastifyInstance) {
  const db = app.db;

  app.post('/search', async (request) => {
    const {
      query,
      limit = 10,
      entityId,
      tier,
    } = request.body as {
      query: string;
      limit?: number;
      entityId?: string;
      tier?: string;
    };
    const ftsQuery = query.split(/\s+/).filter(Boolean).join(' OR ');
    let sql = `
      SELECT f.*, e.name as entity_name, e.type as entity_type, e.category as entity_category, rank
      FROM facts_fts fts
      JOIN facts f ON f.rowid = fts.rowid
      JOIN entities e ON e.id = f.entity_id
      WHERE facts_fts MATCH ?
    `;
    const params: (string | number)[] = [ftsQuery];
    if (entityId) {
      sql += ' AND f.entity_id = ?';
      params.push(entityId);
    }
    if (tier) {
      sql += ' AND f.tier = ?';
      params.push(tier);
    }
    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    return (db.prepare(sql).all(...params) as SearchResultRow[]).map((r) => ({
      fact: {
        id: r.id,
        entityId: r.entity_id,
        fact: r.fact,
        category: r.category,
        timestamp: r.timestamp,
        status: r.status,
        lastAccessed: r.last_accessed,
        accessCount: r.access_count,
        tier: r.tier,
        source: r.source,
      },
      entity: {
        id: r.entity_id,
        name: r.entity_name,
        type: r.entity_type,
        category: r.entity_category,
      },
      score: -r.rank,
    }));
  });

  app.get('/memory/summary', async () => {
    return db
      .prepare(
        `
      SELECT e.id, e.name, e.type, e.category,
        COUNT(CASE WHEN f.tier = 'hot' THEN 1 END) as hot,
        COUNT(CASE WHEN f.tier = 'warm' THEN 1 END) as warm,
        COUNT(CASE WHEN f.tier = 'cold' THEN 1 END) as cold,
        COUNT(f.id) as total
      FROM entities e LEFT JOIN facts f ON f.entity_id = e.id
      WHERE e.status = 'active' GROUP BY e.id ORDER BY total DESC
    `,
      )
      .all();
  });
}
