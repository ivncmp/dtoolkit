import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { ConfigSchema } from '../core/config.js';
import { createDatabase } from '../core/db.js';

function generateToken(): string {
  return `sk-dop_${randomBytes(24).toString('base64url')}`;
}

function defaultDataPath(): string {
  return join(homedir(), '.dops');
}

export async function init(pathArg?: string, flags?: { nonInteractive?: boolean }) {
  const nonInteractive = flags?.nonInteractive || process.env.DOPS_NON_INTERACTIVE === '1';

  if (nonInteractive) {
    return initNonInteractive(pathArg);
  }

  p.intro(pc.cyan('dops') + ' — agent observability');

  const existingPath = resolve(pathArg || defaultDataPath());
  if (existsSync(join(existingPath, 'config.json'))) {
    p.log.info(`dops already initialized at ${pc.green(existingPath)}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const answers = await p.group(
    {
      dataPath: () =>
        p.text({
          message: 'Where should dops store data?',
          initialValue: pathArg || defaultDataPath(),
          validate: (v) => (!v || v.length === 0 ? 'Path is required' : undefined),
        }),
      port: () =>
        p.text({
          message: 'API port?',
          initialValue: '7883',
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1 || n > 65535) return 'Invalid port';
          },
        }),
      host: () =>
        p.select({
          message: 'Bind address?',
          options: [
            { value: '0.0.0.0', label: '0.0.0.0 — All interfaces (accessible from network)' },
            { value: '127.0.0.1', label: '127.0.0.1 — Localhost only' },
          ],
          initialValue: '0.0.0.0',
        }),
      token: () =>
        p.text({
          message: 'Access token (leave default to auto-generate)',
          initialValue: generateToken(),
        }),
    },
    {
      onCancel: () => {
        p.cancel('Init cancelled.');
        process.exit(0);
      },
    },
  );

  const dataPath = resolve(answers.dataPath.replace('~', homedir()));

  if (existsSync(join(dataPath, 'config.json'))) {
    p.log.info(`dops already initialized at ${pc.green(dataPath)}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const port = parseInt(answers.port, 10);

  const config = ConfigSchema.parse({
    dataPath,
    port,
    host: answers.host as string,
    token: answers.token,
  });

  const s = p.spinner();

  s.start('Creating data directory');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  s.stop('Config saved');

  s.start('Initializing database');
  const db = createDatabase(config);
  db.close();
  s.stop('Database ready');

  p.note(
    [
      `Data:       ${pc.green(dataPath)}`,
      `Port:       ${pc.green(String(port))}`,
      `Host:       ${pc.green(config.host)}`,
      `Token:      ${pc.green(config.token)}`,
    ].join('\n'),
    'Configuration',
  );

  p.note([`Start the server:`, `  ${pc.cyan('dops start')}`].join('\n'), 'Next steps');

  p.outro(pc.green('dops initialized. Ready to observe your agents.'));
}

function initNonInteractive(pathArg?: string) {
  const dataPath = resolve(pathArg || process.env.DOPS_DATA || defaultDataPath());
  const port = parseInt(process.env.DOPS_PORT || '7883', 10);
  const host = process.env.DOPS_HOST || '0.0.0.0';
  const token = process.env.DOPS_TOKEN || generateToken();

  if (existsSync(join(dataPath, 'config.json'))) {
    console.log(`Config already exists at ${dataPath}, skipping init.`);
    return;
  }

  const config = ConfigSchema.parse({ dataPath, port, host, token });

  mkdirSync(dataPath, { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');

  const db = createDatabase(config);
  db.close();

  console.log(`dops initialized at ${dataPath}`);
  console.log(`Token: ${token}`);
  console.log(`Start with: dops start`);
}
