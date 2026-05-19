import type { FastifyInstance } from 'fastify';

import { loadConnections } from '../../core/config.js';
import { getAllConnections } from '../../core/connections.js';

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
  author_id: string | null;
  origin_brain: string | null;
  entity_name: string;
  entity_type: string;
  entity_category: string;
  rank: number;
}

function localSearch(
  app: FastifyInstance,
  query: string,
  limit: number,
  entityId?: string,
  tier?: string,
) {
  const db = app.db;
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
      authorId: r.author_id ?? null,
      originBrain: r.origin_brain ?? null,
    },
    entity: {
      id: r.entity_id,
      name: r.entity_name,
      type: r.entity_type,
      category: r.entity_category,
    },
    score: -r.rank,
  }));
}

export async function searchRoutes(app: FastifyInstance) {
  app.post('/search', async (request) => {
    const {
      query,
      limit = 10,
      entityId,
      tier,
      federated = false,
    } = request.body as {
      query: string;
      limit?: number;
      entityId?: string;
      tier?: string;
      federated?: boolean;
    };

    const localResults = localSearch(app, query, limit, entityId, tier);

    if (!federated) return localResults;

    const connections = loadConnections(app.config.dataPath);
    if (connections.length === 0) {
      return {
        results: localResults,
        federation: {
          local: localResults.length,
          remote: 0,
          partial: false,
          sources: [{ name: 'local', count: localResults.length }],
        },
      };
    }

    const localMaxScore =
      localResults.length > 0 ? Math.max(...localResults.map((r) => r.score)) : 1;
    const scored = localResults.map((r) => ({
      ...r,
      normalizedScore: localMaxScore > 0 ? r.score / localMaxScore : 0,
      originBrain: null as string | null,
    }));

    let partial = false;
    const remoteSources: Array<{ name: string; count: number }> = [];
    const remoteResults: typeof scored = [];

    const clients = getAllConnections(connections);
    const remoteSearches = clients.map(async ({ name, client }) => {
      try {
        const hits = await client.search(query, { limit });
        remoteSources.push({ name, count: hits.length });
        const maxScore = hits.length > 0 ? Math.max(...hits.map((h) => h.score)) : 1;
        for (const h of hits) {
          remoteResults.push({
            ...h,
            normalizedScore: maxScore > 0 ? h.score / maxScore : 0,
            originBrain: name,
          });
        }
      } catch {
        partial = true;
        remoteSources.push({ name, count: 0 });
      }
    });
    await Promise.all(remoteSearches);

    const localKeys = new Set(scored.map((r) => `${r.entity.id}::${r.fact.fact}`));
    const dedupedRemote = remoteResults.filter(
      (r) => !localKeys.has(`${r.entity.id}::${r.fact.fact}`),
    );

    const merged = [...scored, ...dedupedRemote]
      .sort((a, b) => b.normalizedScore - a.normalizedScore)
      .slice(0, limit)
      .map(({ normalizedScore: _, ...r }) => r);

    return {
      results: merged,
      federation: {
        local: localResults.length,
        remote: remoteResults.length,
        partial,
        sources: [{ name: 'local', count: localResults.length }, ...remoteSources],
      },
    };
  });

  app.get('/memory/summary', async () => {
    return app.db
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
