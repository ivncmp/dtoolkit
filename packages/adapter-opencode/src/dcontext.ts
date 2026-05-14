import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Target, TranscriptEntry } from '@dtoolkit/core';
import { writeDcontextMdSection, removeDcontextMdSection } from '@dtoolkit/core';

const OPENCODE_DIR = join(homedir(), '.config', 'opencode');
const CONFIG_PATH = join(OPENCODE_DIR, 'opencode.json');
const AGENTS_MD = join(OPENCODE_DIR, 'AGENTS.md');
const DB_PATH = join(homedir(), '.local', 'share', 'opencode', 'state_5.sqlite');

class OpenCodeTarget implements Target {
  readonly name = 'opencode';

  async install(): Promise<void> {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
    } catch {
      // file doesn't exist
    }

    const plugins = (config['plugins'] ?? {}) as Record<string, unknown>;
    plugins['dcontext'] = '@dtoolkit/dcontext';
    config['plugins'] = plugins;

    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    await this.addAgentsMdSection();
  }

  async uninstall(): Promise<void> {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
    } catch {
      return;
    }

    const plugins = (config['plugins'] ?? {}) as Record<string, unknown>;
    delete plugins['dcontext'];
    if (Object.keys(plugins).length === 0) {
      delete config['plugins'];
    } else {
      config['plugins'] = plugins;
    }

    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    await this.removeAgentsMdSection();
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

  async isInstalled(): Promise<boolean> {
    try {
      const config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
      const plugins = config['plugins'] as Record<string, unknown> | undefined;
      return !!plugins?.['dcontext'];
    } catch {
      return false;
    }
  }

  async parseTranscript(path: string): Promise<TranscriptEntry[]> {
    if (!existsSync(path)) return [];

    const sessionId = path;
    try {
      const query = `SELECT role, content FROM message WHERE session_id = '${sessionId.replace(/'/g, "''")}' ORDER BY created_at ASC`;
      const output = execSync(`sqlite3 -json "${DB_PATH}" "${query}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      const rows = JSON.parse(output) as Array<{ role: string; content: string }>;
      return rows
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .map((r) => ({
          role: r.role as 'user' | 'assistant',
          content: r.content,
        }));
    } catch {
      return [];
    }
  }

  resolveTranscriptPath(sessionId: string, _cwd: string): string {
    return sessionId;
  }

  detectFromEnv(env: Record<string, string | undefined>): boolean {
    return !!env['OPENCODE_SESSION_ID'];
  }

  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined {
    return (env['OPENCODE_SESSION_ID'] ?? input['sessionID'] ?? input['session_id']) as
      | string
      | undefined;
  }
}

export function createOpenCodeTarget(): Target {
  return new OpenCodeTarget();
}
