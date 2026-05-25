import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { Config } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import * as projectService from '../service/projects.js';

function generateToken(): string {
  return `sk-dwk_${randomBytes(24).toString('base64url')}`;
}

function defaultDataPath(): string {
  return join(homedir(), '.dwork');
}

export async function init(pathArg?: string, flags?: { nonInteractive?: boolean }) {
  const nonInteractive = flags?.nonInteractive || process.env.DWORK_NON_INTERACTIVE === '1';

  if (nonInteractive) {
    return initNonInteractive(pathArg);
  }

  p.intro(pc.cyan('dwork') + ' — AI-native project manager');

  const existingPath = resolve(pathArg || defaultDataPath());
  if (existsSync(join(existingPath, 'config.json'))) {
    p.log.info(`dwork already initialized at ${pc.green(existingPath)}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const answers = await p.group(
    {
      dataPath: () =>
        p.text({
          message: 'Where should dwork store data?',
          initialValue: pathArg || defaultDataPath(),
          validate: (v) => (!v || v.length === 0 ? 'Path is required' : undefined),
        }),
      port: () =>
        p.text({
          message: 'API port?',
          initialValue: '7881',
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
      createProject: () =>
        p.confirm({
          message: 'Create a first project now?',
          initialValue: true,
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
    p.log.info(`dwork already initialized at ${pc.green(dataPath)}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const port = parseInt(answers.port, 10);

  const config: Config = {
    dataPath,
    port,
    host: answers.host as string,
    token: answers.token,
  };

  const s = p.spinner();

  s.start('Creating data directory');
  mkdirSync(join(dataPath, 'projects'), { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  s.stop('Config saved');

  s.start('Initializing database');
  const db = createDatabase(config);
  s.stop('Database ready');

  if (answers.createProject) {
    const projectAnswers = await p.group(
      {
        slug: () =>
          p.text({
            message: 'Project slug (lowercase, hyphens)',
            validate: (v) => {
              if (!v || v.length === 0) return 'Slug is required';
              if (!/^[a-z0-9-]+$/.test(v)) return 'Only lowercase letters, numbers, and hyphens';
            },
          }),
        name: () =>
          p.text({
            message: 'Project display name',
            validate: (v) => (!v || v.length === 0 ? 'Name is required' : undefined),
          }),
        sourcePath: () =>
          p.text({
            message: 'Source code path (optional, for sync)',
            initialValue: '',
          }),
      },
      {
        onCancel: () => {
          p.cancel('Skipped project creation.');
        },
      },
    );

    if (projectAnswers.slug) {
      s.start('Creating project');
      projectService.createProject(
        db,
        config,
        projectAnswers.slug,
        projectAnswers.name,
        undefined,
        projectAnswers.sourcePath || undefined,
      );
      s.stop(`Project ${pc.green(projectAnswers.slug)} created`);
    }
  }

  db.close();

  p.note(
    [
      `Data:   ${pc.green(dataPath)}`,
      `Port:   ${pc.green(String(port))}`,
      `Host:   ${pc.green(config.host)}`,
      `Token:  ${pc.green(config.token)}`,
    ].join('\n'),
    'Configuration',
  );

  p.note([`Start the server:`, `  ${pc.cyan('dwork start')}`].join('\n'), 'Next steps');

  p.outro(pc.green('dwork initialized. Ready to manage your projects.'));
}

function initNonInteractive(pathArg?: string) {
  const dataPath = resolve(pathArg || process.env.DWORK_DATA || defaultDataPath());
  const port = parseInt(process.env.DWORK_PORT || '7881', 10);
  const host = process.env.DWORK_HOST || '0.0.0.0';
  const token = process.env.DWORK_TOKEN || generateToken();

  if (existsSync(join(dataPath, 'config.json'))) {
    console.log(`Config already exists at ${dataPath}, skipping init.`);
    return;
  }

  const config: Config = { dataPath, port, host, token };

  mkdirSync(join(dataPath, 'projects'), { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');

  const db = createDatabase(config);
  db.close();

  console.log(`dwork initialized at ${dataPath}`);
  console.log(`Token: ${token}`);
  console.log(`Start with: dwork start`);
}
