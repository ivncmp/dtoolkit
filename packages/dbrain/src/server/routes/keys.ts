import { randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

function generateKeyId(): string {
  return `key_${randomBytes(12).toString('base64url')}`;
}

function generateToken(): string {
  return `sk-dbr_${randomBytes(24).toString('base64url')}`;
}

function redactToken(token: string): string {
  return token.slice(0, 10) + '...' + token.slice(-4);
}

export async function keyRoutes(app: FastifyInstance) {
  const db = app.db;

  app.addHook('onRequest', async (request, reply) => {
    if (request.brainUser?.userId !== '_admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  });

  app.post('/keys', async (request, reply) => {
    const {
      userId,
      userName,
      permissions = 'read+write',
    } = request.body as {
      userId: string;
      userName: string;
      permissions?: string;
    };

    if (!userId || !userName) {
      return reply.code(400).send({ error: 'userId and userName are required' });
    }

    const valid = ['read', 'write', 'read+write'];
    if (!valid.includes(permissions)) {
      return reply.code(400).send({ error: `permissions must be one of: ${valid.join(', ')}` });
    }

    const id = generateKeyId();
    const token = generateToken();

    db.prepare(
      'INSERT INTO api_keys (id, token, user_id, user_name, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, token, userId, userName, permissions, new Date().toISOString());

    return reply.code(201).send({ id, token, userId, userName, permissions });
  });

  app.get('/keys', async () => {
    const rows = db
      .prepare(
        'SELECT id, token, user_id, user_name, permissions, created_at, last_used, status FROM api_keys ORDER BY created_at DESC',
      )
      .all() as {
      id: string;
      token: string;
      user_id: string;
      user_name: string;
      permissions: string;
      created_at: string;
      last_used: string | null;
      status: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      tokenPreview: redactToken(r.token),
      userId: r.user_id,
      userName: r.user_name,
      permissions: r.permissions,
      createdAt: r.created_at,
      lastUsed: r.last_used,
      status: r.status,
    }));
  });

  app.patch('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { permissions } = request.body as { permissions: string };

    const valid = ['read', 'write', 'read+write'];
    if (!valid.includes(permissions)) {
      return reply.code(400).send({ error: `permissions must be one of: ${valid.join(', ')}` });
    }

    const result = db
      .prepare("UPDATE api_keys SET permissions = ? WHERE id = ? AND status = 'active'")
      .run(permissions, id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: 'Key not found or already revoked' });
    }

    return { id, permissions, updated: true };
  });

  app.delete('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = db
      .prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ? AND status = 'active'")
      .run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: 'Key not found or already revoked' });
    }

    return { id, revoked: true };
  });
}
