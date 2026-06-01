import * as p from '@clack/prompts';
import { DBrainClient, DWorkClient } from '@dtoolkit/sdk';
import pc from 'picocolors';

import type { DcontextConfig } from '../core/config.js';

// ---------------------------------------------------------------------------
// Generic service connection
// ---------------------------------------------------------------------------

export async function connectToService(
  name: string,
  current: { url: string; token: string },
  defaultUrl: string,
  validate: (url: string, token: string) => Promise<string>,
): Promise<{ url: string; token: string } | null> {
  const answers = await p.group(
    {
      url: () =>
        p.text({
          message: `${name} URL`,
          initialValue: current.url || defaultUrl,
          validate: (v) => (!v ? 'URL is required' : undefined),
        }),
      token: () =>
        p.text({
          message: `${name} token (empty if none)`,
          initialValue: current.token || '',
        }),
    },
    {
      onCancel: () => {
        p.cancel('Cancelled.');
        process.exit(0);
      },
    },
  );

  const s = p.spinner();
  s.start(`Connecting to ${name}`);

  try {
    const info = await validate(answers.url, answers.token);
    s.stop(`Connected — ${info}`);
    return { url: answers.url, token: answers.token };
  } catch (err) {
    s.stop(pc.red('Connection failed'));
    p.log.error((err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// dbrain
// ---------------------------------------------------------------------------

export async function connectToDbrain(config: DcontextConfig): Promise<boolean> {
  const result = await connectToService(
    'dbrain',
    config.dbrain,
    'http://localhost:7878',
    async (url, token) => {
      const client = new DBrainClient(url, token);
      const health = await client.health();
      return `${pc.green(String(health.entities))} entities, ${pc.green(String(health.facts))} facts`;
    },
  );
  if (result) {
    config.dbrain = result;
    return true;
  }
  return false;
}

export async function startLocalDbrain(config: DcontextConfig): Promise<boolean> {
  const s = p.spinner();
  s.start('Checking dbrain CLI');

  try {
    const { execSync } = await import('node:child_process');
    execSync('dbrain --help', { stdio: 'ignore' });
    s.stop('dbrain CLI found');
  } catch {
    s.stop(pc.red('dbrain CLI not found'));
    p.log.error('Install dbrain first: ' + pc.cyan('npm i -g @dtoolkit/dbrain'));
    return false;
  }

  const brainPath = await p.text({
    message: 'Brain path',
    initialValue: `${process.env.HOME}/.dbrain`,
    validate: (v) => (!v ? 'Path is required' : undefined),
  });

  if (p.isCancel(brainPath)) {
    p.cancel('Cancelled.');
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
      // no token needed
    }

    const client = new DBrainClient('http://localhost:7878', token);
    const health = await client.health();
    s2.stop(
      `dbrain running — ${pc.green(String(health.entities))} entities, ${pc.green(String(health.facts))} facts`,
    );

    config.dbrain = { url: 'http://localhost:7878', token };
    return true;
  } catch (err) {
    s2.stop(pc.red('Failed to start dbrain'));
    p.log.error((err as Error).message);
    return false;
  }
}

export async function mapEntity(config: DcontextConfig): Promise<void> {
  const client = new DBrainClient(config.dbrain.url, config.dbrain.token);
  const cwd = process.cwd();

  try {
    const entities = await client.listEntities();

    if (entities.length === 0) {
      const name = await p.text({
        message: 'Entity name for this project',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });

      if (p.isCancel(name)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      const id = name.toLowerCase().replace(/\s+/g, '-');
      try {
        await client.createEntity({ id, name, type: 'project', category: 'projects' });
        p.log.success(`Entity ${pc.blue(name)} created`);
      } catch {
        // may already exist
      }
      config.projects[cwd] = id;
      return;
    }

    const currentEntity = config.projects[cwd];
    const selected = await p.select({
      message: `Map ${pc.dim(cwd)} to entity:`,
      options: [
        ...entities.map((e) => ({
          value: e.id,
          label: `${e.name} (${e.type}, ${e.category})`,
        })),
        { value: '__custom__', label: 'Create new entity...' },
        { value: '__skip__', label: currentEntity ? `Keep current (${currentEntity})` : 'Skip' },
      ],
      initialValue: currentEntity || undefined,
    });

    if (p.isCancel(selected)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    if (selected === '__custom__') {
      const name = await p.text({
        message: 'Entity name',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });
      if (p.isCancel(name)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }
      const id = name.toLowerCase().replace(/\s+/g, '-');
      try {
        await client.createEntity({ id, name, type: 'project', category: 'projects' });
        p.log.success(`Entity ${pc.blue(name)} created`);
      } catch {
        // may already exist
      }
      config.projects[cwd] = id;
    } else if (selected !== '__skip__') {
      config.projects[cwd] = selected as string;
    }
  } catch (err) {
    p.log.warn(`Could not list entities: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// dwork
// ---------------------------------------------------------------------------

export async function connectToDwork(config: DcontextConfig): Promise<boolean> {
  const result = await connectToService(
    'dwork',
    config.dwork || { url: '', token: '' },
    'http://localhost:7881',
    async (url, token) => {
      const client = new DWorkClient(url, token);
      const overview = await client.overview();
      return `${pc.green(String(overview.totalProjects))} projects`;
    },
  );
  if (result) {
    config.dwork = result;
    return true;
  }
  return false;
}

export async function mapDworkProjects(config: DcontextConfig): Promise<void> {
  if (!config.dwork?.url) return;

  const cwd = process.cwd();
  try {
    const client = new DWorkClient(config.dwork.url, config.dwork.token);
    const projects = await client.listProjects();
    if (projects.length === 0) return;

    const current = config.dworkProjects[cwd] || [];
    const selected = await p.multiselect({
      message: `Map ${pc.dim(cwd)} to dwork projects:`,
      options: projects.map((pr) => ({
        value: pr.slug,
        label: `${pr.name} (${pr.slug})`,
        selected: current.includes(pr.slug),
      })),
      required: false,
    });

    if (!p.isCancel(selected)) {
      config.dworkProjects[cwd] = selected as string[];
    }
  } catch (err) {
    p.log.warn(`Could not list dwork projects: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// dops
// ---------------------------------------------------------------------------

export async function connectToDops(config: DcontextConfig): Promise<boolean> {
  const result = await connectToService(
    'dops',
    config.dops || { url: '', token: '' },
    'http://localhost:7883',
    async (url, token) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${url}/health`, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'online';
    },
  );
  if (result) {
    config.dops = result;
    return true;
  }
  return false;
}
