import { Command } from 'commander';
import pc from 'picocolors';

import { executePrompt } from '../lib/runner.js';
import { readStdin } from '../lib/stdin.js';
import type { ProviderName } from '../lib/types.js';

/** Create the `dproxy ask` Commander command with all CLI options. */
export function createAskCommand(): Command {
  return new Command('ask')
    .description('Send a prompt to an AI model')
    .argument('[prompt...]', 'The prompt to send')
    .option('-p, --provider <provider>', 'Provider to use (claude, codex, gemini, ollama, opencode)')
    .option('-m, --model <model>', 'Model to use')
    .option('--max-turns <n>', 'Max agent turns', parseInt)
    .option('--max-budget-usd <n>', 'Max budget in USD', parseFloat)
    .option('-o, --output-format <format>', 'Output format: text, json, stream-json')
    .option('--system-prompt <text>', 'System prompt override')
    .option('--no-memory', 'Skip memory injection')
    .option('--memory <keys>', 'Inject only specific memory keys (comma-separated)')
    .option('--no-life', 'Skip life/PARA context injection')
    .option('--no-history', "Don't save to history")
    .option('--raw', 'Print raw JSON response')
    .option('--token-footer', 'Append token usage footer to response text')
    .option(
      '--max-session-tokens <n>',
      'Reset session if context exceeds this token count',
      parseInt,
    )
    .option('-c, --continue', 'Continue last conversation')
    .option('-r, --resume <id>', 'Resume a specific session')
    .action(async (promptParts: string[], opts) => {
      try {
        await runAsk(promptParts, opts);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

/**
 * Execute a single-shot prompt via CLI: read stdin, call the runner,
 * and format output to stdout.
 */
export async function runAsk(promptParts: string[], opts: Record<string, unknown>): Promise<void> {
  const stdinContent = await readStdin();
  const promptText = promptParts.join(' ');

  if (!promptText && !stdinContent) {
    console.error(pc.red('No prompt provided. Usage: dproxy ask "your question"'));
    process.exit(1);
  }

  let fullPrompt = promptText;
  if (stdinContent) {
    fullPrompt = fullPrompt ? `${fullPrompt}\n\n---\n\n${stdinContent}` : stdinContent;
  }

  const memoryOpt =
    opts.memory === false
      ? false
      : typeof opts.memory === 'string'
        ? (opts.memory as string).split(',')
        : undefined;

  const result = await executePrompt(fullPrompt, {
    provider: opts.provider as ProviderName | undefined,
    model: opts.model as string | undefined,
    maxTurns: opts.maxTurns as number | undefined,
    maxBudgetUsd: opts.maxBudgetUsd as number | undefined,
    systemPrompt: opts.systemPrompt as string | undefined,
    memory: memoryOpt,
    life: opts.life !== false ? undefined : false,
    sessionId: opts.resume as string | undefined,
    continueSession: opts.continue as boolean | undefined,
    maxSessionTokens: opts.maxSessionTokens as number | undefined,
    saveHistory: opts.history !== false,
  });

  if (opts.tokenFooter && result.usage) {
    const u = result.usage;
    const parts: string[] = [];
    parts.push(`in:${u.inputTokens.toLocaleString()}`);
    parts.push(`out:${u.outputTokens.toLocaleString()}`);
    parts.push(`~${u.totalTokens.toLocaleString()}`);
    const footer = `\n\n—————————————\n\`${parts.join(' · ')}\``;
    result.text += footer;
  }

  if (opts.raw) {
    console.log(JSON.stringify(result.raw ?? result, null, 2));
  } else if (opts.outputFormat === 'json') {
    console.log(
      JSON.stringify(
        { result: result.text, sessionId: result.sessionId, costUsd: result.costUsd },
        null,
        2,
      ),
    );
  } else {
    console.log(result.text);
  }
}
