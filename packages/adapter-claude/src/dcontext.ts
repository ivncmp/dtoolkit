import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Target, TranscriptEntry } from '@dtoolkit/core';

const CLAUDE_DIR = join(homedir(), '.claude');
const CLAUDE_MD = join(CLAUDE_DIR, 'CLAUDE.md');
const SETTINGS_JSON = join(CLAUDE_DIR, 'settings.json');

const DBRAIN_START = '<!-- dbrain:start -->';
const DBRAIN_END = '<!-- dbrain:end -->';
const DCONTEXT_MARKER = '<!-- dcontext:active -->';

const DBRAIN_DCONTEXT_SECTION = `# dbrain

You have an AI brain connected via MCP (dbrain). Your identity, soul, user profile, and project facts are **automatically injected at session start** by dcontext — you already have them in your context under "Session Context (from dbrain)".

## Tools

- \`recall\` — Search the brain. **Only use when the user asks about something NOT already in your Session Context.** Do not call at session start — your context is already loaded.
- \`remember\` — Save important facts. Decisions, preferences, personal details, milestones. One atomic fact per call. Use proactively across ALL projects.
- \`log\` — Store conversation messages at natural breakpoints (end of task, before user leaves, every few exchanges).
- \`get_entity\` — Full context about a specific entity.
- \`list_entities\` — List entities by category or type.
- \`create_entity\` — Create new entity, then \`remember\` facts about it.
- \`bump\` — Touch a memory to keep it hot.
- \`overview\` — Brain stats.

## Rules

- Do NOT call \`recall\` or \`wake_up\` at session start. Your context is already loaded by dcontext.
- Use \`recall\` only mid-conversation when the user asks about something not in the injected context.
- Never say "I don't know" about the user without searching first.
- When storing facts, be specific and atomic. "Favorite ice cream is pistachio" not "We talked about food preferences".
- Use \`remember\` proactively. Decisions, milestones, preferences, people, learnings — if it's worth remembering, store it.`;

const DCONTEXT_HOOKS = {
  SessionStart: [
    {
      hooks: [
        {
          type: 'command' as const,
          command: 'dcontext hook session-start',
          timeout: 5000,
        },
      ],
    },
  ],
  PreCompact: [
    {
      hooks: [
        {
          type: 'command' as const,
          command: 'dcontext hook pre-compact',
          timeout: 10000,
        },
      ],
    },
  ],
};

class ClaudeTarget implements Target {
  readonly name = 'claude';

  async install(): Promise<void> {
    await this.addHooksToSettings();
    await this.addClaudeMdSection();
  }

  async uninstall(): Promise<void> {
    await this.removeHooksFromSettings();
    await this.removeClaudeMdSection();
  }

  private async addClaudeMdSection(): Promise<void> {
    const section = `${DBRAIN_START}\n${DCONTEXT_MARKER}\n${DBRAIN_DCONTEXT_SECTION}\n${DBRAIN_END}`;
    let content = '';
    try {
      content = await readFile(CLAUDE_MD, 'utf-8');
    } catch {
      // file doesn't exist yet
    }

    const startIdx = content.indexOf(DBRAIN_START);
    const endIdx = content.indexOf(DBRAIN_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const before = content.slice(0, startIdx).trimEnd();
      const after = content.slice(endIdx + DBRAIN_END.length).trimStart();
      const parts = [before, section, after].filter(Boolean);
      content = parts.join('\n\n');
    } else if (content.trim()) {
      content = section + '\n\n' + content.trim();
    } else {
      content = section;
    }

    await mkdir(CLAUDE_DIR, { recursive: true });
    await writeFile(CLAUDE_MD, content.trim() + '\n', 'utf-8');
  }

  private async removeClaudeMdSection(): Promise<void> {
    let content: string;
    try {
      content = await readFile(CLAUDE_MD, 'utf-8');
    } catch {
      return;
    }

    if (!content.includes(DCONTEXT_MARKER)) return;

    const startIdx = content.indexOf(DBRAIN_START);
    const endIdx = content.indexOf(DBRAIN_END);
    if (startIdx === -1 || endIdx === -1) return;

    const before = content.slice(0, startIdx).trimEnd();
    const after = content.slice(endIdx + DBRAIN_END.length).trimStart();
    const result = [before, after].filter(Boolean).join('\n\n');

    await writeFile(CLAUDE_MD, result.trim() + '\n', 'utf-8');
  }

  async isInstalled(): Promise<boolean> {
    if (!existsSync(SETTINGS_JSON)) return false;
    try {
      const settings = JSON.parse(await readFile(SETTINGS_JSON, 'utf-8'));
      const hooks = settings?.hooks?.SessionStart;
      if (!Array.isArray(hooks)) return false;
      return hooks.some((group: Record<string, unknown>) => {
        const inner = (group as { hooks?: Array<{ command?: string }> }).hooks;
        return inner?.some((h) => h.command?.startsWith('dcontext '));
      });
    } catch {
      return false;
    }
  }

  private async addHooksToSettings(): Promise<void> {
    await mkdir(CLAUDE_DIR, { recursive: true });
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(await readFile(SETTINGS_JSON, 'utf-8'));
    } catch {
      // file doesn't exist or corrupt
    }

    if (!settings.hooks) settings.hooks = {};
    const hooks = settings.hooks as Record<string, unknown>;

    for (const [event, value] of Object.entries(DCONTEXT_HOOKS)) {
      const existing = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
      const hasDcontext = existing.some((group) => {
        const inner = (group as { hooks?: Array<{ command?: string }> }).hooks;
        return inner?.some((h) => h.command?.startsWith('dcontext '));
      });
      if (!hasDcontext) {
        hooks[event] = [...existing, ...value];
      }
    }

    await writeFile(SETTINGS_JSON, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  private async removeHooksFromSettings(): Promise<void> {
    if (!existsSync(SETTINGS_JSON)) return;
    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(await readFile(SETTINGS_JSON, 'utf-8'));
    } catch {
      return;
    }

    const hooks = settings.hooks as Record<string, unknown> | undefined;
    if (!hooks) return;

    for (const event of Object.keys(DCONTEXT_HOOKS)) {
      const existing = hooks[event];
      if (!Array.isArray(existing)) continue;
      hooks[event] = existing.filter((group) => {
        const inner = (group as { hooks?: Array<{ command?: string }> }).hooks;
        return !inner?.some((h) => h.command?.startsWith('dcontext '));
      });
      if ((hooks[event] as unknown[]).length === 0) {
        delete hooks[event];
      }
    }

    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }

    await writeFile(SETTINGS_JSON, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  async parseTranscript(path: string): Promise<TranscriptEntry[]> {
    const raw = await readFile(path, 'utf-8');
    const entries: TranscriptEntry[] = [];

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const type = parsed['type'] as string | undefined;
        if (type !== 'user' && type !== 'assistant') continue;

        const message = parsed['message'] as Record<string, unknown> | undefined;
        if (!message) continue;

        const role = message['role'] as string | undefined;
        if (role !== 'user' && role !== 'assistant') continue;

        const contentBlocks = message['content'] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(contentBlocks)) continue;

        const textParts: string[] = [];
        for (const block of contentBlocks) {
          if (block['type'] === 'text' && typeof block['text'] === 'string') {
            textParts.push(block['text'] as string);
          }
        }

        if (textParts.length === 0) continue;

        entries.push({
          role: role as 'user' | 'assistant',
          content: textParts.join('\n'),
          timestamp: parsed['timestamp'] as string | undefined,
        });
      } catch {
        // skip malformed lines
      }
    }

    return entries;
  }

  resolveTranscriptPath(sessionId: string, cwd: string): string {
    const encoded = cwd.replace(/\//g, '-');
    return join(homedir(), '.claude', 'projects', encoded, `${sessionId}.jsonl`);
  }

  detectFromEnv(env: Record<string, string | undefined>): boolean {
    return !!env['CLAUDE_CODE_SESSION_ID'];
  }

  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined {
    return (env['CLAUDE_CODE_SESSION_ID'] ?? input['session_id']) as string | undefined;
  }
}

export function createClaudeTarget(): Target {
  return new ClaudeTarget();
}
