import type { Target } from '@dtoolkit/core';
import { Command } from 'commander';

import { generateBriefing } from '../core/briefing.js';
import type { DcontextConfig } from '../core/config.js';
import { loadConfig, logError, updateStats } from '../core/config.js';
import { extractAndSave } from '../core/extraction.js';

import { resolveTarget } from './targets.js';

export function createHookCommand(): Command {
  return new Command('hook')
    .description('Handle hook events (internal — called by CLI hooks)')
    .argument('<event>', 'Hook event: session-start, pre-compact')
    .action(async (event: string) => {
      try {
        await runHook(event);
      } catch (err) {
        await logError(`hook ${event}: ${(err as Error).message}`);
        process.stdout.write('{}');
      }
    });
}

function readStdinRaw(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('{}');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data || '{}'));
  });
}

function detectTarget(env: Record<string, string | undefined>): Target | null {
  for (const name of ['claude', 'codex', 'gemini', 'opencode'] as const) {
    const target = resolveTarget(name);
    if (target?.detectFromEnv(env)) return target;
  }
  return resolveTarget('claude');
}

async function runHook(event: string) {
  const raw = await readStdinRaw();
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(raw);
  } catch {
    // invalid JSON, use empty
  }

  const config = await loadConfig();
  if (!config.dbrain.url) {
    process.stdout.write('{}');
    return;
  }

  const env = process.env as Record<string, string | undefined>;
  const target = detectTarget(env);
  if (!target) {
    process.stdout.write('{}');
    return;
  }

  const cwd = (input['cwd'] as string) || env['GEMINI_CWD'] || env['GEMINI_PROJECT_DIR'] || process.cwd();
  const sessionId = target.getSessionId(env, input);

  if (event === 'session-start') {
    await handleSessionStart(cwd, config);
  } else if (event === 'pre-compact') {
    await handlePreCompact(sessionId, target, cwd, config);
  } else {
    process.stdout.write('{}');
  }
}

async function handleSessionStart(cwd: string, config: DcontextConfig) {
  const projectEntity = config.projects[cwd];
  if (!projectEntity) {
    process.stdout.write('{}');
    return;
  }

  const briefing = await generateBriefing(projectEntity, config);
  if (!briefing) {
    process.stdout.write('{}');
    return;
  }

  await updateStats((stats) => {
    stats.briefings.total++;
    stats.briefings.lastAt = new Date().toISOString();
  });

  process.stdout.write(JSON.stringify({ additionalContext: briefing }));
}

async function handlePreCompact(
  sessionId: string | undefined,
  target: Target,
  cwd: string,
  config: DcontextConfig,
) {
  if (!sessionId) {
    process.stdout.write('{}');
    return;
  }

  const notes = await extractAndSave(sessionId, target, cwd, config);
  if (!notes) {
    process.stdout.write('{}');
    return;
  }

  process.stdout.write(JSON.stringify({ additionalContext: notes }));
}
