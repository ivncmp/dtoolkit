import { Command } from 'commander';
import pc from 'picocolors';

import { resolveAdapter } from '../lib/adapter.js';
import { addChatLog } from '../lib/chat-log-store.js';
import { loadConfig } from '../lib/config.js';
import { buildSystemPromptContext } from '../lib/context-builder.js';
import { addHistoryEntry } from '../lib/history-store.js';
import { getSessionTokens, updateSessionTokens } from '../lib/session-state.js';
import { readStdin } from '../lib/stdin.js';
import type { AdapterRequest, ProviderName } from '../lib/types.js';

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
 * Execute a single-shot prompt: assemble context, call the adapter, display output,
 * and persist to history and chat log.
 */
export async function runAsk(promptParts: string[], opts: Record<string, unknown>): Promise<void> {
  const config = await loadConfig();
  const stdinContent = await readStdin();
  const promptText = promptParts.join(' ');

  if (!promptText && !stdinContent) {
    console.error(pc.red('No prompt provided. Usage: dproxy ask "your question"'));
    process.exit(1);
  }

  // Build the full prompt
  let fullPrompt = promptText;
  if (stdinContent) {
    fullPrompt = fullPrompt ? `${fullPrompt}\n\n---\n\n${stdinContent}` : stdinContent;
  }

  // Build context via shared builder
  const memoryOpt =
    opts.memory === false
      ? false
      : typeof opts.memory === 'string'
        ? (opts.memory as string).split(',')
        : true;

  const appendSystemPrompt =
    (await buildSystemPromptContext(
      {
        memory: memoryOpt,
        life: opts.life !== false,
        workspace: true,
        chatLog: true,
        lifeQuery: fullPrompt,
      },
      config,
    )) || undefined;

  // Check session token limit before resuming
  let sessionId = opts.resume as string | undefined;
  const maxSessionTokens = opts.maxSessionTokens as number | undefined;
  if (sessionId && maxSessionTokens) {
    const currentTokens = await getSessionTokens(sessionId);
    if (currentTokens > maxSessionTokens) {
      sessionId = undefined;
    }
  }

  // Resolve the adapter
  const providerName = (opts.provider as ProviderName | undefined) ?? config.provider.default;
  const adapter = resolveAdapter(providerName, config);

  const request: AdapterRequest = {
    prompt: fullPrompt,
    model: (opts.model as string) ?? config.defaults.model,
    maxTurns: (opts.maxTurns as number) ?? config.defaults.maxTurns,
    systemPrompt: opts.systemPrompt as string | undefined,
    sessionId,
    continueSession: opts.continue as boolean | undefined,
    options: {
      appendSystemPrompt,
      maxBudgetUsd: opts.maxBudgetUsd as number | undefined,
    },
  };

  const result = await adapter.execute(request);

  // Persist token count for this session
  if (result.sessionId && result.usage) {
    await updateSessionTokens(result.sessionId, result.usage.totalTokens);
  }

  // Append token footer if requested
  if (opts.tokenFooter && result.usage) {
    const u = result.usage;
    const parts: string[] = [];
    parts.push(`in:${u.inputTokens.toLocaleString()}`);
    parts.push(`out:${u.outputTokens.toLocaleString()}`);
    parts.push(`~${u.totalTokens.toLocaleString()}`);
    const footer = `\n\n—————————————\n\`${parts.join(' · ')}\``;
    result.text += footer;
  }

  // Output
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

  // Save to history
  if (opts.history !== false) {
    await addHistoryEntry({
      prompt: fullPrompt,
      result: result.text,
      sessionId: result.sessionId ?? '',
      costUsd: result.costUsd ?? 0,
      durationMs: result.durationMs,
      model: (opts.model as string) ?? config.defaults.model,
    });
  }

  // Save to daily chat log (if configured)
  void addChatLog(promptText, result.text);
}
