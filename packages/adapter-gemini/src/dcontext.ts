import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Target, TranscriptEntry } from '@dtoolkit/core';
import { writeDcontextMdSection, removeDcontextMdSection } from '@dtoolkit/core';

const GEMINI_DIR = join(homedir(), '.gemini');
const GEMINI_MD = join(GEMINI_DIR, 'GEMINI.md');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');

const DCONTEXT_HOOKS = {
  SessionStart: [
    {
      hooks: [
        {
          name: 'dcontext-session-start',
          type: 'command',
          command: 'dcontext hook session-start',
          timeout: 5000,
        },
      ],
    },
  ],
  PreCompress: [
    {
      hooks: [
        {
          name: 'dcontext-pre-compress',
          type: 'command',
          command: 'dcontext hook pre-compact',
          timeout: 10000,
        },
      ],
    },
  ],
};

class GeminiTarget implements Target {
  readonly name = 'gemini';

  async install(): Promise<void> {
    await mkdir(GEMINI_DIR, { recursive: true });

    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
    } catch {
      // file doesn't exist or isn't valid JSON
    }

    const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>;
    hooks['SessionStart'] = [
      ...(hooks['SessionStart'] ?? []).filter((h) => !isDcontextHook(h)),
      ...DCONTEXT_HOOKS.SessionStart,
    ];
    hooks['PreCompress'] = [
      ...(hooks['PreCompress'] ?? []).filter((h) => !isDcontextHook(h)),
      ...DCONTEXT_HOOKS.PreCompress,
    ];
    settings['hooks'] = hooks;

    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    await this.addGeminiMdSection();
  }

  async uninstall(): Promise<void> {
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
    } catch {
      return;
    }

    const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>;
    const cleaned: Record<string, unknown[]> = {};

    for (const [event, entries] of Object.entries(hooks)) {
      if (event === 'SessionStart' || event === 'PreCompress') {
        const remaining = entries.filter((h) => !isDcontextHook(h));
        if (remaining.length > 0) cleaned[event] = remaining;
      } else {
        cleaned[event] = entries;
      }
    }

    if (Object.keys(cleaned).length === 0) {
      const { hooks: _, ...rest } = settings;
      settings = rest as Record<string, unknown>;
    } else {
      settings['hooks'] = cleaned;
    }

    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    await this.removeGeminiMdSection();
  }

  private async addGeminiMdSection(): Promise<void> {
    let content = '';
    try {
      content = await readFile(GEMINI_MD, 'utf-8');
    } catch {
      // file doesn't exist yet
    }

    await writeFile(GEMINI_MD, writeDcontextMdSection(content), 'utf-8');
  }

  private async removeGeminiMdSection(): Promise<void> {
    let content: string;
    try {
      content = await readFile(GEMINI_MD, 'utf-8');
    } catch {
      return;
    }

    const result = removeDcontextMdSection(content);
    if (result !== null) {
      await writeFile(GEMINI_MD, result, 'utf-8');
    }
  }

  async isInstalled(): Promise<boolean> {
    try {
      const settings = JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
      const hooks = settings['hooks'] as Record<string, unknown[]> | undefined;
      if (!hooks?.['SessionStart']) return false;
      return hooks['SessionStart'].some((h) => isDcontextHook(h));
    } catch {
      return false;
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
        if (type !== 'user' && type !== 'gemini') continue;

        const content = parsed['content'] as Array<Record<string, unknown>> | string | undefined;
        let text = '';
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((c) => typeof c['text'] === 'string')
            .map((c) => c['text'] as string)
            .join('\n');
        }

        if (!text) continue;

        entries.push({
          role: type === 'gemini' ? 'assistant' : 'user',
          content: text,
          timestamp: parsed['timestamp'] as string | undefined,
        });
      } catch {
        // skip malformed lines
      }
    }

    return entries;
  }

  resolveTranscriptPath(sessionId: string, _cwd: string): string {
    return join(homedir(), '.gemini', 'tmp', sessionId);
  }

  detectFromEnv(env: Record<string, string | undefined>): boolean {
    return !!env['GEMINI_SESSION_ID'];
  }

  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined {
    return (env['GEMINI_SESSION_ID'] ?? input['session_id']) as string | undefined;
  }
}

function isDcontextHook(hookGroup: unknown): boolean {
  if (!hookGroup || typeof hookGroup !== 'object') return false;
  const group = hookGroup as Record<string, unknown>;
  const hooks = group['hooks'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(hooks)) return false;
  return hooks.some(
    (h) =>
      (typeof h['name'] === 'string' && (h['name'] as string).includes('dcontext')) ||
      (typeof h['command'] === 'string' && (h['command'] as string).includes('dcontext')),
  );
}

export function createGeminiTarget(): Target {
  return new GeminiTarget();
}
