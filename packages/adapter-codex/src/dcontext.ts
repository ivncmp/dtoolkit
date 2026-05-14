import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Target, TranscriptEntry } from '@dtoolkit/core';
import { writeDcontextMdSection, removeDcontextMdSection } from '@dtoolkit/core';

const CODEX_DIR = join(homedir(), '.codex');
const AGENTS_MD = join(CODEX_DIR, 'AGENTS.md');
const CONFIG_TOML = join(CODEX_DIR, 'config.toml');

const DCONTEXT_HOOKS = {
  SessionStart: [
    {
      hooks: [
        {
          type: 'command' as const,
          command: 'dcontext hook session-start --target codex',
          timeout: 5000,
        },
      ],
    },
  ],
  Stop: [
    {
      hooks: [
        {
          type: 'command' as const,
          command: 'dcontext hook pre-compact --target codex',
          timeout: 10000,
        },
      ],
    },
  ],
};

class CodexTarget implements Target {
  readonly name = 'codex';

  async install(): Promise<void> {
    await mkdir(CODEX_DIR, { recursive: true });
    await this.addHooksToConfig();
    await this.addAgentsMdSection();
  }

  async uninstall(): Promise<void> {
    await this.removeHooksFromConfig();
    await this.removeAgentsMdSection();
  }

  private async addHooksToConfig(): Promise<void> {
    let toml = '';
    try {
      toml = await readFile(CONFIG_TOML, 'utf-8');
    } catch {
      // file doesn't exist
    }

    if (toml.includes('dcontext hook session-start')) return;

    if (!toml.includes('hooks = true') && !toml.includes('codex_hooks = true')) {
      if (toml.includes('[features]')) {
        toml = toml.replace('[features]', '[features]\nhooks = true');
      } else {
        toml = toml.trimEnd() + '\n\n[features]\nhooks = true\n';
      }
    }
    toml = toml.replace('codex_hooks = true', 'hooks = true');

    const hookLines = [
      '',
      '# dcontext hooks',
      '[[hooks.SessionStart]]',
      'matcher = "*"',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "dcontext hook session-start --target codex"',
      'timeout = 5000',
      '',
      '[[hooks.PreCompact]]',
      'matcher = "*"',
      '',
      '[[hooks.PreCompact.hooks]]',
      'type = "command"',
      'command = "dcontext hook pre-compact --target codex"',
      'timeout = 10000',
    ];

    await writeFile(
      CONFIG_TOML,
      (toml.trimEnd() + '\n' + hookLines.join('\n') + '\n').trimStart(),
      'utf-8',
    );
  }

  private async removeHooksFromConfig(): Promise<void> {
    let toml = '';
    try {
      toml = await readFile(CONFIG_TOML, 'utf-8');
    } catch {
      return;
    }

    if (!toml.includes('dcontext hook')) return;

    const lines = toml.split('\n');
    const filtered: string[] = [];
    let skipBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === '# dcontext hooks') {
        skipBlock = true;
        continue;
      }

      if (skipBlock) {
        if (
          line.startsWith('[[hooks.') ||
          line.startsWith('type = ') ||
          line.startsWith('command = "dcontext') ||
          line.startsWith('timeout = ') ||
          line.startsWith('matcher = ') ||
          line.startsWith('statusMessage = ')
        ) {
          continue;
        }
        if (line.trim() === '') {
          continue;
        }
        skipBlock = false;
      }

      filtered.push(line);
    }

    const result =
      filtered
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim() + '\n';
    await writeFile(CONFIG_TOML, result, 'utf-8');
  }

  async isInstalled(): Promise<boolean> {
    if (!existsSync(CONFIG_TOML)) return false;
    try {
      const toml = await readFile(CONFIG_TOML, 'utf-8');
      return toml.includes('dcontext hook session-start');
    } catch {
      return false;
    }
  }

  private async addAgentsMdSection(): Promise<void> {
    let content = '';
    try {
      content = await readFile(AGENTS_MD, 'utf-8');
    } catch {
      // file doesn't exist yet
    }

    await writeFile(AGENTS_MD, writeDcontextMdSection(content), 'utf-8');
  }

  private async removeAgentsMdSection(): Promise<void> {
    let content: string;
    try {
      content = await readFile(AGENTS_MD, 'utf-8');
    } catch {
      return;
    }

    const result = removeDcontextMdSection(content);
    if (result !== null) {
      await writeFile(AGENTS_MD, result, 'utf-8');
    }
  }

  async parseTranscript(path: string): Promise<TranscriptEntry[]> {
    const raw = await readFile(path, 'utf-8');
    const entries: TranscriptEntry[] = [];

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const type = parsed['type'] as string | undefined;

        if (type === 'item.completed') {
          const item = parsed['item'] as Record<string, unknown> | undefined;
          if (!item) continue;
          const role = item['role'] as string | undefined;
          if (role !== 'user' && role !== 'assistant') continue;
          const text = item['text'] as string | undefined;
          if (!text) continue;

          entries.push({
            role: role as 'user' | 'assistant',
            content: text,
            timestamp: parsed['timestamp'] as string | undefined,
          });
        }
      } catch {
        // skip malformed lines
      }
    }

    return entries;
  }

  resolveTranscriptPath(sessionId: string, _cwd: string): string {
    return join(CODEX_DIR, 'sessions', sessionId);
  }

  detectFromEnv(env: Record<string, string | undefined>): boolean {
    return !!env['CODEX_SESSION_ID'];
  }

  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined {
    return (env['CODEX_SESSION_ID'] ?? input['session_id']) as string | undefined;
  }
}

export function createCodexTarget(): Target {
  return new CodexTarget();
}
