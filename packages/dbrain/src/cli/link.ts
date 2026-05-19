import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { Config, Connection } from '../core/config.js';
import { loadConfig } from '../core/config.js';

function configPath(dataPath: string): string {
  return join(dataPath, 'config.json');
}

function saveConnections(dataPath: string, connections: Connection[]): void {
  const raw = JSON.parse(readFileSync(configPath(dataPath), 'utf-8'));
  raw.connections = connections;
  writeFileSync(configPath(dataPath), JSON.stringify(raw, null, 2) + '\n');
}

export async function link(url: string, opts: { path?: string; token?: string; name?: string }) {
  const dataPath = resolve(opts.path || join(homedir(), '.dbrain'));
  let config: Config;
  try {
    config = loadConfig(dataPath);
  } catch {
    p.log.error(`${pc.red('No brain found.')} Run ${pc.bold('dbrain init')} first.`);
    process.exit(1);
  }

  if (config.brainType === 'shared') {
    p.log.error(`${pc.red('Shared brains cannot connect to other brains.')}`);
    process.exit(1);
  }

  const token = opts.token;
  if (!token) {
    p.log.error(`${pc.red('--token is required')}`);
    process.exit(1);
  }

  p.log.step(`Connecting to ${pc.blue(url)}...`);

  let health: { name: string; brainType?: string };
  try {
    const res = await fetch(`${url}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    health = (await res.json()) as { name: string; brainType?: string };
  } catch (err) {
    p.log.error(`${pc.red('Cannot reach brain:')} ${(err as Error).message}`);
    process.exit(1);
  }

  if (health.brainType !== 'shared') {
    p.log.error(
      `${pc.red('Target brain is not shared.')} Only personal → shared connections are allowed.`,
    );
    process.exit(1);
  }

  const name = opts.name || health.name || new URL(url).hostname;

  const existing = config.connections.find((c) => c.url === url);
  if (existing) {
    p.log.warn(`${pc.yellow('Already linked to')} ${pc.bold(existing.name)} at ${url}`);
    process.exit(0);
  }

  const connections = [...config.connections, { name, url, token }];
  saveConnections(dataPath, connections);

  p.log.success(`${pc.green('Linked to')} ${pc.bold(name)}`);
  p.note(
    [`Name:  ${pc.green(name)}`, `URL:   ${pc.dim(url)}`, `Type:  ${pc.green('shared')}`].join(
      '\n',
    ),
    'Connection',
  );
}

export async function unlink(name: string, opts: { path?: string }) {
  const dataPath = resolve(opts.path || join(homedir(), '.dbrain'));
  let config: Config;
  try {
    config = loadConfig(dataPath);
  } catch {
    p.log.error(`${pc.red('No brain found.')} Run ${pc.bold('dbrain init')} first.`);
    process.exit(1);
  }

  const idx = config.connections.findIndex((c) => c.name === name);
  if (idx === -1) {
    p.log.error(`${pc.red(`Connection "${name}" not found.`)}`);
    process.exit(1);
  }

  const connections = config.connections.filter((_, i) => i !== idx);
  saveConnections(dataPath, connections);

  p.log.success(`${pc.green('Unlinked')} ${pc.bold(name)}`);
}

export async function connections(opts: { path?: string }) {
  const dataPath = resolve(opts.path || join(homedir(), '.dbrain'));
  let config: Config;
  try {
    config = loadConfig(dataPath);
  } catch {
    p.log.error(`${pc.red('No brain found.')} Run ${pc.bold('dbrain init')} first.`);
    process.exit(1);
  }

  if (config.connections.length === 0) {
    p.log.info('No connections. Use `dbrain link` to connect to a shared brain.');
    return;
  }

  p.log.info(`${pc.bold(`${config.connections.length} connection(s)`)}\n`);

  for (const conn of config.connections) {
    let status = pc.dim('checking...');
    try {
      const res = await fetch(`${conn.url}/health`, {
        headers: { Authorization: `Bearer ${conn.token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const h = (await res.json()) as { name: string; entities: number; facts: number };
        status = `${pc.green('online')}  ${h.entities} entities, ${h.facts} facts`;
      } else {
        status = pc.red(`error (${res.status})`);
      }
    } catch {
      status = pc.red('offline');
    }
    console.log(`  ${pc.bold(conn.name)}  ${pc.dim(conn.url)}  ${status}`);
  }
}
