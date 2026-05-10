import { buildDayChatContext } from './chat-log-store.js';
import { buildLifeContext } from './life-store.js';
import { buildMemoryContext } from './memory-store.js';
import type { AppConfig } from './types.js';
import { buildWorkspaceContext } from './workspace-store.js';

/** Options controlling which context sources to include in the system prompt. */
export interface ContextOptions {
  memory?: boolean | string[];
  life?: boolean;
  workspace?: boolean;
  chatLog?: boolean;
  lifeQuery?: string;
}

/**
 * Assemble all context sources into a single `--append-system-prompt` string.
 * Sources are included in priority order: day chat log, workspace, memory, life/PARA.
 * Used by both `ask` and `chat` commands for consistent context injection.
 */
export async function buildSystemPromptContext(
  opts: ContextOptions,
  config: AppConfig,
): Promise<string> {
  const parts: string[] = [];

  // Day chat log (highest priority — unshifted to front at end)
  let dayChatCtx = '';
  if (opts.chatLog !== false) {
    dayChatCtx = await buildDayChatContext();
  }

  // Workspace bootstrap files
  if (opts.workspace !== false) {
    const ctx = await buildWorkspaceContext();
    if (ctx) parts.push(ctx);
  }

  // Memory snippets
  if (opts.memory !== false) {
    const keys = Array.isArray(opts.memory)
      ? opts.memory
      : config.memory.defaultKeys.length
        ? config.memory.defaultKeys
        : undefined;

    const ctx = await buildMemoryContext(keys, config.memory.maxInjectionChars);
    if (ctx) parts.push(ctx);
  }

  // Life/PARA context
  if (opts.life !== false && config.life.autoInject) {
    const ctx = await buildLifeContext(opts.lifeQuery, config.life.maxInjectionChars);
    if (ctx) parts.push(ctx);
  }

  // Day chat at front (highest priority)
  if (dayChatCtx) {
    parts.unshift(dayChatCtx);
  }

  if (parts.length === 0) return '';
  return parts.join('\n\n---\n\n');
}
