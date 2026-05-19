import type { FastifyInstance } from 'fastify';

import { loadConnections } from '../../core/config.js';

export async function proxyRoutes(app: FastifyInstance) {
  app.all('/proxy/:name/*', async (request, reply) => {
    if (request.method === 'OPTIONS') return reply.status(204).send();

    const { name } = request.params as { name: string };
    const wildcard = (request.params as Record<string, string>)['*'];
    const path = `/${wildcard}`;

    const connections = loadConnections(app.config.dataPath);
    const conn = connections.find((c) => c.name === name);
    if (!conn) return reply.code(404).send({ error: `Connection "${name}" not found` });

    const url = `${conn.url}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${conn.token}`,
    };

    const contentType = request.headers['content-type'];
    if (contentType) headers['Content-Type'] = contentType;

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body;

    try {
      const res = await fetch(url, {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(5000),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      return reply.code(res.status).send(data);
    } catch (err) {
      return reply.code(502).send({ error: `Proxy error: ${(err as Error).message}` });
    }
  });
}
