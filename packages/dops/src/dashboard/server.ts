import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startDashboard(port: number) {
  const app = Fastify();
  const logoSquare = readFileSync(join(__dirname, 'logo-dops.png'));
  const logoComplete = readFileSync(join(__dirname, 'logo-dops-complete.png'));

  app.get('/', (_, reply) => {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
    reply.type('text/html').send(html);
  });

  app.get('/logo-dops.png', (_, reply) => {
    reply.type('image/png').send(logoSquare);
  });

  app.get('/logo-dops-complete.png', (_, reply) => {
    reply.type('image/png').send(logoComplete);
  });

  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error(`Dashboard failed to start: ${err.message}`);
      return;
    }
  });
}
