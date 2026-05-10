import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

const SUPPORTED_CLIENTS = ['claude', 'opencode'] as const;
type Client = (typeof SUPPORTED_CLIENTS)[number];

interface BrainConfig {
  mcp: Record<string, unknown>;
  permissions: string[];
  claudeMd: string;
}

export async function connect(client?: string, url?: string, tokenArg?: string) {
  p.intro(pc.cyan('dbrain') + ' — Connect to a brain');

  if (!client || !SUPPORTED_CLIENTS.includes(client as Client)) {
    p.log.error(
      client
        ? `Unknown client "${client}". Supported: ${SUPPORTED_CLIENTS.join(', ')}`
        : `Client is required. Usage: dbrain connect <client> [url] [--token=...]`,
    );
    p.log.info(`Supported clients: ${SUPPORTED_CLIENTS.join(', ')}`);
    p.outro(pc.red('Aborted.'));
    return;
  }

  const selectedClient = client as Client;

  if (selectedClient === 'opencode') {
    p.log.warning('opencode support is not available yet.');
    p.outro(pc.yellow('Coming soon.'));
    return;
  }

  if (!url) {
    const input = await p.text({
      message: 'Brain URL',
      placeholder: 'http://your-server:7878',
      validate: (v) => (!v || v.length === 0 ? 'URL is required' : undefined),
    });
    if (p.isCancel(input)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    url = input as string;
  }

  url = url.replace(/\/+$/, '');

  if (!tokenArg) {
    const input = await p.text({
      message: 'Access token',
      placeholder: 'sk-dbr_...',
      validate: (v) => (!v || v.length === 0 ? 'Token is required' : undefined),
    });
    if (p.isCancel(input)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    tokenArg = input as string;
  }

  const s = p.spinner();
  s.start('Connecting to brain');

  let config: BrainConfig;
  try {
    const res = await fetch(`${url}/connect`, {
      headers: { Authorization: `Bearer ${tokenArg}` },
    });
    if (res.status === 401) throw new Error('Invalid token');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = (await res.json()) as BrainConfig;
  } catch (err) {
    s.stop(pc.red('Failed to connect'));
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(`Could not reach ${url}/connect — ${message}`);
    p.log.info('Make sure the brain is running, the URL is correct, and the token is valid.');
    p.outro(pc.red('Connection failed.'));
    return;
  }
  s.stop('Brain found');

  const healthRes = await fetch(`${url}/health`)
    .then((r) => r.json() as Promise<{ name?: string; entities?: number; facts?: number }>)
    .catch(() => null);
  if (healthRes?.name) {
    p.log.info(
      `Brain: ${pc.cyan(healthRes.name)} — ${healthRes.entities} entities, ${healthRes.facts} facts`,
    );
  }

  configureClaude(config, s);

  p.outro(pc.green('Connected. Restart Claude Code to activate.'));
}

function configureClaude(config: BrainConfig, s: ReturnType<typeof p.spinner>) {
  s.start('Configuring Claude Code');

  const claudeDir = join(homedir(), '.claude');
  const claudeJson = join(homedir(), '.claude.json');
  const settingsJson = join(claudeDir, 'settings.json');
  const claudeMd = join(claudeDir, 'CLAUDE.md');

  mkdirSync(claudeDir, { recursive: true });

  let claudeConfig: { mcpServers?: Record<string, unknown>; [k: string]: unknown } = {};
  if (existsSync(claudeJson)) {
    try {
      claudeConfig = JSON.parse(readFileSync(claudeJson, 'utf-8'));
    } catch {
      /* corrupt config, start fresh */
    }
  }
  if (!claudeConfig.mcpServers) claudeConfig.mcpServers = {};
  Object.assign(claudeConfig.mcpServers, config.mcp);
  writeFileSync(claudeJson, JSON.stringify(claudeConfig, null, 2) + '\n', 'utf-8');

  let settings: { permissions?: { allow?: string[] }; [k: string]: unknown } = {};
  if (existsSync(settingsJson)) {
    try {
      settings = JSON.parse(readFileSync(settingsJson, 'utf-8'));
    } catch {
      /* corrupt config, start fresh */
    }
  }
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];
  for (const perm of config.permissions) {
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
    }
  }
  writeFileSync(settingsJson, JSON.stringify(settings, null, 2) + '\n', 'utf-8');

  writeFileSync(claudeMd, config.claudeMd, 'utf-8');

  s.stop('Claude Code configured');

  p.note(
    [
      `${pc.green('~/.claude.json')}          MCP server registered`,
      `${pc.green('~/.claude/settings.json')}  Permissions granted`,
      `${pc.green('~/.claude/CLAUDE.md')}      Behavioral instructions installed`,
    ].join('\n'),
    'Files updated',
  );
}
