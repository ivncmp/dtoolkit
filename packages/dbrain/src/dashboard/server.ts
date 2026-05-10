import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, 'icons');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function startDashboard(port: number) {
  const app = Fastify();
  const logoC = readFileSync(join(__dirname, 'logo-complete.png'));
  const logoI = readFileSync(join(__dirname, 'logo-image.png'));

  app.get('/', (_, reply) => {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
    reply.type('text/html').send(html);
  });

  app.get('/logo-image.png', (_, reply) => {
    reply.type('image/png').send(logoI);
  });

  app.get('/logo-complete.png', (_, reply) => {
    reply.type('image/png').send(logoC);
  });

  app.get('/:file', (req, reply) => {
    const { file } = req.params as { file: string };
    const ext = '.' + file.split('.').pop();
    const mime = MIME[ext];
    if (!mime) return reply.code(404).send('Not found');

    const path = join(iconsDir, file);
    if (!existsSync(path)) return reply.code(404).send('Not found');

    reply.type(mime).send(readFileSync(path));
  });

  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error(`Dashboard failed to start: ${err.message}`);
      return;
    }
    console.log(`Dashboard: http://localhost:${port}`);
  });
}
