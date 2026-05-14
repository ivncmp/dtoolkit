import * as p from '@clack/prompts';
import { DBrainClient } from '@dtoolkit/sdk';
import { Command } from 'commander';
import pc from 'picocolors';

import type { DcontextConfig } from '../core/config.js';
import { getDataDir, loadConfig, saveConfig } from '../core/config.js';

export function createInitCommand(): Command {
  return new Command('init').description('Interactive setup wizard').action(async () => {
    try {
      await runInit();
    } catch (err) {
      if ((err as Error).message?.includes('cancelled')) process.exit(0);
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });
}

async function runInit() {
  p.intro(pc.cyan('dcontext') + ' — dbrain hooks for AI coding CLIs');

  const config = await loadConfig();

  if (config.initialized && config.dbrain.url) {
    p.log.info(`Current dbrain: ${pc.blue(config.dbrain.url)}`);
    const cwd = process.cwd();
    const entity = config.projects[cwd];
    if (entity) {
      p.log.info(`Current mapping: ${pc.dim(cwd)} → ${pc.blue(entity)}`);
    }
  }

  const options: { value: string; label: string; description: string }[] = [
    {
      value: 'connect',
      label: 'Connect to existing dbrain',
      description: 'I have a dbrain running already',
    },
    {
      value: 'local',
      label: 'Start a local dbrain',
      description: 'Initialize and start a new brain here',
    },
  ];

  if (config.initialized && config.dbrain.url) {
    options.unshift({
      value: 'remap',
      label: 'Keep dbrain, remap this directory',
      description: `Change entity mapping for ${process.cwd()}`,
    });
  }

  const mode = await p.select({
    message: config.initialized
      ? 'What do you want to change?'
      : 'How do you want to connect to dbrain?',
    options,
  });

  if (p.isCancel(mode)) {
    p.cancel('Init cancelled.');
    process.exit(0);
  }

  if (mode === 'remap') {
    await finishInit(config);
  } else if (mode === 'local') {
    await startLocalDbrain(config);
  } else {
    await connectToDbrain(config);
  }
}

async function startLocalDbrain(config: DcontextConfig) {
  const s = p.spinner();
  s.start('Checking dbrain CLI');

  try {
    const { execSync } = await import('node:child_process');
    execSync('dbrain --help', { stdio: 'ignore' });
    s.stop('dbrain CLI found');
  } catch {
    s.stop(pc.red('dbrain CLI not found'));
    p.log.error('Install dbrain first: ' + pc.cyan('npm i -g @dtoolkit/dbrain'));
    p.outro(pc.red('Then run dcontext init again.'));
    process.exit(1);
  }

  const brainPath = await p.text({
    message: 'Brain path',
    initialValue: `${process.env.HOME}/.dbrain`,
    validate: (v) => (!v ? 'Path is required' : undefined),
  });

  if (p.isCancel(brainPath)) {
    p.cancel('Init cancelled.');
    process.exit(0);
  }

  const s2 = p.spinner();
  s2.start('Initializing and starting dbrain');

  try {
    const { execSync, spawn } = await import('node:child_process');
    execSync(`dbrain init "${brainPath}"`, { stdio: 'ignore' });

    const child = spawn('dbrain', ['start', brainPath], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();

    let healthy = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        await new DBrainClient('http://localhost:7878').health();
        healthy = true;
        break;
      } catch {
        // not ready yet
      }
    }

    if (!healthy) throw new Error('dbrain did not start in time');

    let token = '';
    try {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const dbrainConfig = JSON.parse(await readFile(join(brainPath, 'config.json'), 'utf-8'));
      token = dbrainConfig.token || '';
    } catch {
      // no token needed or config not readable
    }

    const client = new DBrainClient('http://localhost:7878', token);
    const health = await client.health();
    s2.stop(
      `dbrain running — ${pc.green(String(health.entities))} entities, ${pc.green(String(health.facts))} facts`,
    );

    config.dbrain = { url: 'http://localhost:7878', token };
    await finishInit(config);
  } catch (err) {
    s2.stop(pc.red('Failed to start dbrain'));
    p.log.error((err as Error).message);
    p.outro(pc.red('Try starting dbrain manually: dbrain start'));
    process.exit(1);
  }
}

async function connectToDbrain(config: DcontextConfig) {
  const answers = await p.group(
    {
      url: () =>
        p.text({
          message: 'dbrain URL',
          initialValue: config.dbrain.url || 'http://localhost:7878',
          validate: (v) => (!v ? 'URL is required' : undefined),
        }),
      token: () =>
        p.text({
          message: 'dbrain token (empty if none)',
          initialValue: config.dbrain.token || '',
        }),
    },
    {
      onCancel: () => {
        p.cancel('Init cancelled.');
        process.exit(0);
      },
    },
  );

  const s = p.spinner();
  s.start('Connecting to dbrain');

  try {
    const client = new DBrainClient(answers.url, answers.token);
    const health = await client.health();
    s.stop(
      `Connected — ${pc.green(String(health.entities))} entities, ${pc.green(String(health.facts))} facts`,
    );
  } catch (err) {
    s.stop(pc.red('Connection failed'));
    p.log.error((err as Error).message);
    p.outro(pc.red('Check dbrain URL and token, then try again.'));
    process.exit(1);
  }

  config.dbrain = { url: answers.url, token: answers.token };
  await finishInit(config);
}

async function finishInit(config: DcontextConfig) {
  const client = new DBrainClient(config.dbrain.url, config.dbrain.token);

  let entityName: string | undefined;
  try {
    const entities = await client.listEntities();
    if (entities.length > 0) {
      const cwd = process.cwd();
      const selected = await p.select({
        message: `Map ${pc.dim(cwd)} to entity:`,
        options: [
          ...entities.map((e) => ({
            value: e.id,
            label: `${e.name} (${e.type}, ${e.category})`,
          })),
          { value: '__skip__', label: 'Skip for now' },
          { value: '__custom__', label: 'Enter custom name...' },
        ],
      });

      if (p.isCancel(selected)) {
        p.cancel('Init cancelled.');
        process.exit(0);
      }

      if (selected === '__custom__') {
        const custom = await p.text({
          message: 'Entity name for this project',
          validate: (v) => (!v ? 'Name is required' : undefined),
        });
        if (p.isCancel(custom)) {
          p.cancel('Init cancelled.');
          process.exit(0);
        }
        entityName = custom;
        try {
          await client.createEntity({
            id: custom.toLowerCase().replace(/\s+/g, '-'),
            name: custom,
            type: 'project',
            category: 'projects',
          });
          p.log.success(`Entity ${pc.blue(custom)} created in dbrain`);
        } catch {
          // entity may already exist
        }
      } else if (selected !== '__skip__') {
        entityName = selected as string;
      }

      if (entityName) {
        config.projects[cwd] = entityName;
      }
    }
  } catch (err) {
    p.log.warn(`Could not list entities: ${(err as Error).message}`);
  }

  config.initialized = true;
  await saveConfig(config);

  p.note(
    [
      `dbrain:  ${pc.green(config.dbrain.url)}`,
      entityName ? `Project: ${pc.green(process.cwd())} → ${pc.green(entityName)}` : '',
      `Config:  ${pc.green(getDataDir() + '/config.json')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    'Configuration',
  );

  p.outro(`Next: ${pc.cyan('dcontext install claude')}`);
}

export async function requireInit(): Promise<void> {
  const config = await loadConfig();
  if (!config.initialized) {
    console.error(pc.red('dcontext is not initialized. Run: dcontext init'));
    process.exit(1);
  }
}
