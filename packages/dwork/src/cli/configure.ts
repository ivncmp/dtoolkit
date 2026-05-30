import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dwork');
}

export async function configure(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  let config;
  try {
    config = loadConfig(dataPath);
  } catch {
    console.log(`${pc.red('Not initialized.')} Run: ${pc.cyan('dwork init')}`);
    return;
  }

  p.intro(pc.cyan('dwork') + ' configure');

  const answers = await p.group(
    {
      port: () =>
        p.text({
          message: 'API port',
          initialValue: String(config.port),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1 || n > 65535) return 'Invalid port';
          },
        }),
      host: () =>
        p.select({
          message: 'Bind address',
          options: [
            { value: '0.0.0.0', label: '0.0.0.0 — All interfaces (accessible from network)' },
            { value: '127.0.0.1', label: '127.0.0.1 — Localhost only' },
          ],
          initialValue: config.host,
        }),
      dproxyUrl: () =>
        p.text({
          message: 'dproxy URL (for sync)',
          initialValue: config.dproxy?.url || 'http://localhost:7880',
        }),
      dproxyToken: () =>
        p.text({
          message: 'dproxy token (optional)',
          initialValue: config.dproxy?.token || '',
        }),
      dproxyProvider: () =>
        p.select({
          message: 'dproxy provider',
          options: [
            { value: 'claude', label: 'Claude' },
            { value: 'codex', label: 'Codex' },
            { value: 'gemini', label: 'Gemini' },
            { value: 'opencode', label: 'OpenCode' },
          ],
          initialValue: config.dproxy?.provider || 'claude',
        }),
    },
    {
      onCancel: () => {
        p.cancel('Configuration cancelled.');
        process.exit(0);
      },
    },
  );

  const raw = JSON.parse(readFileSync(join(dataPath, 'config.json'), 'utf-8'));

  const updated = {
    ...raw,
    port: parseInt(answers.port, 10),
    host: answers.host as string,
    dproxy: {
      url: answers.dproxyUrl,
      token: answers.dproxyToken || undefined,
      provider: answers.dproxyProvider as string,
    },
  };

  if (JSON.stringify(updated) === JSON.stringify(raw)) {
    p.outro(pc.dim('No changes.'));
    return;
  }

  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(updated, null, 2) + '\n', 'utf-8');

  p.outro(pc.green('Config updated. Restart the server to apply changes.'));
}
