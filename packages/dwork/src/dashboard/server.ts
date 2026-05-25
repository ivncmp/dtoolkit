import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startDashboard(port: number) {
  const app = Fastify();

  app.get('/', (_, reply) => {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
    reply.type('text/html').send(html);
  });

  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error(`Dashboard failed to start: ${err.message}`);
      return;
    }
  });
}
