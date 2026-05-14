import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

const SUPPORTED_CLIENTS = ['claude', 'gemini', 'opencode'] as const;
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

  if (selectedClient === 'claude') {
    configureClaude(config, url, tokenArg, s);
  } else if (selectedClient === 'gemini') {
    configureGemini(config, url, tokenArg, s);
  } else if (selectedClient === 'opencode') {
    configureOpenCode(config, url, tokenArg, s);
  }

  const clientNames: Record<Client, string> = {
    claude: 'Claude Code',
    gemini: 'Gemini CLI',
    opencode: 'OpenCode',
  };
  p.outro(pc.green(`Connected. Restart ${clientNames[selectedClient]} to activate.`));
}

function configureClaude(config: BrainConfig, _url: string, _token: string, s: ReturnType<typeof p.spinner>) {
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

  writeDbrainMdSection(claudeMd, config.claudeMd);

  s.stop('Claude Code configured');

  p.note(
    [
      `${pc.green('~/.claude.json')}           MCP server registered`,
      `${pc.green('~/.claude/settings.json')}  Permissions granted`,
      `${pc.green('~/.claude/CLAUDE.md')}      Behavioral instructions installed`,
    ].join('\n'),
    'Files updated',
  );
}

const DBRAIN_START = '<!-- dbrain:start -->';
const DBRAIN_END = '<!-- dbrain:end -->';

function writeDbrainMdSection(filePath: string, content: string) {
  const text = content.trim().replace('{hostname}', hostname().toLowerCase());
  const section = `${DBRAIN_START}\n${text}\n${DBRAIN_END}`;

  let mdContent = section;
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    const startIdx = existing.indexOf(DBRAIN_START);
    const endIdx = existing.indexOf(DBRAIN_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const before = existing.slice(0, startIdx).trim();
      const after = existing.slice(endIdx + DBRAIN_END.length).trim();
      const parts = [before, section, after].filter(Boolean);
      mdContent = parts.join('\n\n');
    } else if (existing.trim()) {
      mdContent = section + '\n\n' + existing.trim();
    }
  }
  writeFileSync(filePath, mdContent.trim() + '\n', 'utf-8');
}

const DBRAIN_POLICY = `[[rule]]
mcpName = "dbrain"
toolName = "*"
decision = "allow"
priority = 200
modes = ["default", "autoEdit", "yolo"]
`;

function configureGemini(config: BrainConfig, url: string, token: string, s: ReturnType<typeof p.spinner>) {
  s.start('Configuring Gemini CLI');

  const geminiDir = join(homedir(), '.gemini');
  const settingsJson = join(geminiDir, 'settings.json');
  const policiesDir = join(geminiDir, 'policies');
  const policyFile = join(policiesDir, 'dbrain.toml');
  const geminiMd = join(geminiDir, 'GEMINI.md');

  mkdirSync(geminiDir, { recursive: true });
  mkdirSync(policiesDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsJson)) {
    try {
      settings = JSON.parse(readFileSync(settingsJson, 'utf-8'));
    } catch {
      /* corrupt config, start fresh */
    }
  }

  if (!settings.mcpServers) settings.mcpServers = {};
  const mcpServers = settings.mcpServers as Record<string, unknown>;
  mcpServers['dbrain'] = {
    url: `${url}/mcp`,
    headers: { Authorization: `Bearer ${token}` },
  };

  writeFileSync(settingsJson, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  writeFileSync(policyFile, DBRAIN_POLICY, 'utf-8');
  writeDbrainMdSection(geminiMd, config.claudeMd);

  s.stop('Gemini CLI configured');

  p.note(
    [
      `${pc.green('~/.gemini/settings.json')}        MCP server registered`,
      `${pc.green('~/.gemini/policies/dbrain.toml')}  Auto-approve dbrain tools`,
      `${pc.green('~/.gemini/GEMINI.md')}             Behavioral instructions installed`,
    ].join('\n'),
    'Files updated',
  );
}

function configureOpenCode(brainConfig: BrainConfig, url: string, token: string, s: ReturnType<typeof p.spinner>) {
  s.start('Configuring OpenCode');

  const opencodeDir = join(homedir(), '.config', 'opencode');
  const configJson = join(opencodeDir, 'opencode.json');
  const agentsMd = join(opencodeDir, 'AGENTS.md');

  mkdirSync(opencodeDir, { recursive: true });

  let config: Record<string, unknown> = {};
  if (existsSync(configJson)) {
    try {
      config = JSON.parse(readFileSync(configJson, 'utf-8'));
    } catch {
      /* corrupt config, start fresh */
    }
  }

  if (!config.mcp) config.mcp = {};
  const mcp = config.mcp as Record<string, unknown>;
  mcp['dbrain'] = {
    url: `${url}/mcp`,
    headers: { Authorization: `Bearer ${token}` },
    enabled: true,
    type: 'remote',
  };

  if (!config.permission) config.permission = {};
  const permission = config.permission as Record<string, string>;
  permission['dbrain_*'] = 'allow';

  writeFileSync(configJson, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  writeDbrainMdSection(agentsMd, brainConfig.claudeMd);

  s.stop('OpenCode configured');

  p.note(
    [
      `${pc.green('~/.config/opencode/opencode.json')}  MCP server + permissions registered`,
      `${pc.green('~/.config/opencode/AGENTS.md')}      Behavioral instructions installed`,
    ].join('\n'),
    'Files updated',
  );
}
