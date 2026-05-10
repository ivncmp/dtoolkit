import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import chalk from 'chalk';
import { Command } from 'commander';

import { execClaude } from '../claude.js';
import { addChatLog } from '../lib/chat-log-store.js';
import { loadConfig, getDataDir, ensureDataDir } from '../lib/config.js';
import { buildSystemPromptContext } from '../lib/context-builder.js';
import { addHistoryEntry } from '../lib/history-store.js';
import type { SessionInfo } from '../lib/types.js';

const SESSION_FILE = 'current-session.json';

async function loadSession(): Promise<SessionInfo | null> {
  try {
    const raw = await readFile(join(getDataDir(), SESSION_FILE), 'utf-8');
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

async function saveSession(session: SessionInfo): Promise<void> {
  await ensureDataDir();
  await writeFile(
    join(getDataDir(), SESSION_FILE),
    JSON.stringify(session, null, 2) + '\n',
    'utf-8',
  );
}

/** Create the `cw chat` Commander command for interactive conversations. */
export function createChatCommand(): Command {
  return new Command('chat')
    .description('Start an interactive conversation with Claude')
    .option('-c, --continue', 'Continue last conversation')
    .option('-r, --resume <id>', 'Resume a specific session')
    .option('-m, --model <model>', 'Model to use')
    .option('--max-turns <n>', 'Max agent turns per message', parseInt)
    .option('--no-memory', 'Skip memory injection')
    .option('--no-life', 'Skip life/PARA context injection')
    .action(async (opts) => {
      try {
        await runChat(opts);
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}

/** Run the interactive chat REPL: readline loop with session tracking and context injection. */
async function runChat(opts: Record<string, unknown>): Promise<void> {
  const config = await loadConfig();

  let sessionId: string | undefined;

  // Resume or continue
  if (opts.resume) {
    sessionId = opts.resume as string;
    console.log(chalk.dim(`Resuming session: ${sessionId}`));
  } else if (opts.continue) {
    const prev = await loadSession();
    if (prev) {
      sessionId = prev.sessionId;
      console.log(chalk.dim(`Continuing session: ${sessionId}`));
    } else {
      console.log(chalk.dim('No previous session found. Starting new chat.'));
    }
  }

  // Build context via shared builder (same sources as ask)
  const appendSystemPrompt =
    (await buildSystemPromptContext(
      {
        memory: opts.memory !== false,
        life: opts.life !== false,
        workspace: true,
        chatLog: true,
      },
      config,
    )) || undefined;

  console.log(chalk.bold.blue('Claude Chat'));
  console.log(chalk.dim('Type "exit" or Ctrl+C to quit.\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('you > '),
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      console.log(chalk.dim('Bye!'));
      rl.close();
      return;
    }

    // Lock input while processing
    rl.pause();

    try {
      process.stdout.write(chalk.dim('thinking...\r'));

      const result = await execClaude({
        prompt: input,
        model: (opts.model as string) ?? config.defaults.model,
        maxTurns: (opts.maxTurns as number) ?? config.defaults.maxTurns,
        appendSystemPrompt,
        resumeSessionId: sessionId,
      });

      // Clear "thinking..." and print response
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
      console.log(chalk.cyan('claude > ') + result.result);
      console.log();

      // Capture session ID from first response
      if (!sessionId && result.sessionId) {
        sessionId = result.sessionId;
        await saveSession({
          sessionId,
          startedAt: new Date().toISOString(),
        });
      }

      // Save to history
      await addHistoryEntry({
        prompt: input,
        result: result.result,
        sessionId: result.sessionId,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        model: (opts.model as string) ?? config.defaults.model,
      });

      // Save to daily chat log
      void addChatLog(input, result.result);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
    }

    // Unlock input
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
