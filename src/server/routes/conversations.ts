import { randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

function genId(): string {
  return `msg_${randomBytes(12).toString('base64url')}`;
}

export async function conversationRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/conversations', async (request) => {
    const { source, limit = 50 } = request.query as { source?: string; limit?: number };
    let sql = `SELECT c.id, c.source, c.started_at, c.ended_at, c.summary,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
      FROM conversations c`;
    const params: (string | number)[] = [];
    if (source) {
      sql += ' WHERE c.source = ?';
      params.push(source);
    }
    sql += ' ORDER BY c.started_at DESC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params);
  });

  app.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conv) return reply.code(404).send({ error: 'Conversation not found' });

    const messages = db
      .prepare(
        'SELECT id, role, content, timestamp, processed FROM messages WHERE conversation_id = ? ORDER BY timestamp',
      )
      .all(id);

    return { ...(conv as Record<string, unknown>), messages };
  });

  app.post('/conversations', async (request, reply) => {
    const { id, source } = request.body as { id?: string; source: string };
    const convId = id || `conv_${randomBytes(12).toString('base64url')}`;
    const now = new Date().toISOString();

    db.prepare('INSERT INTO conversations (id, source, started_at) VALUES (?, ?, ?)').run(
      convId,
      source,
      now,
    );

    return reply.code(201).send({ id: convId, source, started_at: now });
  });

  app.post('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!conv) return reply.code(404).send({ error: 'Conversation not found' });

    const body = request.body as
      | { role: string; content: string }
      | Array<{ role: string; content: string }>;

    const msgs = Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();
    const insert = db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
    );

    const saved = msgs.map((m, i) => {
      const msgId = genId();
      const ts = i === 0 ? now : new Date(Date.now() + i).toISOString();
      insert.run(msgId, id, m.role, m.content, ts);
      return { id: msgId, role: m.role, timestamp: ts };
    });

    db.prepare('UPDATE conversations SET ended_at = ? WHERE id = ?').run(
      saved[saved.length - 1].timestamp,
      id,
    );

    return reply.code(201).send(saved);
  });

  app.get('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!conv) return reply.code(404).send({ error: 'Conversation not found' });

    const { since, processed } = request.query as { since?: string; processed?: string };
    let sql =
      'SELECT id, role, content, timestamp, processed FROM messages WHERE conversation_id = ?';
    const params: (string | number)[] = [id];
    if (since) {
      sql += ' AND timestamp > ?';
      params.push(since);
    }
    if (processed !== undefined) {
      sql += ' AND processed = ?';
      params.push(processed === 'true' ? 1 : 0);
    }
    sql += ' ORDER BY timestamp';
    return db.prepare(sql).all(...params);
  });

  app.get('/conversations/pending', async () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM messages WHERE processed = 0').get() as {
      count: number;
    };
    const conversations = db
      .prepare(
        `
      SELECT c.id, c.source, c.started_at, COUNT(m.id) as unprocessed
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id AND m.processed = 0
      GROUP BY c.id ORDER BY c.started_at DESC
    `,
      )
      .all();
    return { total_unprocessed: row.count, conversations };
  });
}
