import { resolveAdapter } from './adapter.js';
import { addChatLog } from './chat-log-store.js';
import { loadConfig } from './config.js';
import { buildSystemPromptContext } from './context-builder.js';
import { addHistoryEntry } from './history-store.js';
import { getSessionTokens, updateSessionTokens } from './session-state.js';
import type {
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
  AppConfig,
  ProviderName,
} from './types.js';

export interface RunnerOptions {
  provider?: ProviderName;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  systemPrompt?: string;
  memory?: boolean | string[];
  life?: boolean;
  workspace?: boolean;
  chatLog?: boolean;
  sessionId?: string;
  continueSession?: boolean;
  maxSessionTokens?: number;
  saveHistory?: boolean;
  saveChatLog?: boolean;
}

export interface RunnerResult {
  text: string;
  sessionId?: string;
  costUsd?: number;
  durationMs: number;
  usage?: AdapterUsage;
  raw?: unknown;
}

export async function executePrompt(
  prompt: string,
  options: RunnerOptions = {},
  config?: AppConfig,
): Promise<RunnerResult> {
  const cfg = config ?? (await loadConfig());

  if (!prompt) {
    throw new Error('No prompt provided.');
  }

  const memoryOpt =
    options.memory === false
      ? false
      : Array.isArray(options.memory)
        ? options.memory
        : true;

  const appendSystemPrompt =
    (await buildSystemPromptContext(
      {
        memory: memoryOpt,
        life: options.life !== false,
        workspace: options.workspace !== false,
        chatLog: options.chatLog !== false,
        lifeQuery: prompt,
      },
      cfg,
    )) || undefined;

  let sessionId = options.sessionId;
  if (sessionId && options.maxSessionTokens) {
    const currentTokens = await getSessionTokens(sessionId);
    if (currentTokens > options.maxSessionTokens) {
      sessionId = undefined;
    }
  }

  const providerName = options.provider ?? cfg.provider.default;
  const adapter = resolveAdapter(providerName, cfg);

  const result: AdapterResult = await adapter.execute({
    prompt,
    model: options.model ?? cfg.defaults.model,
    maxTurns: options.maxTurns ?? cfg.defaults.maxTurns,
    systemPrompt: options.systemPrompt,
    sessionId,
    continueSession: options.continueSession,
    options: {
      appendSystemPrompt,
      maxBudgetUsd: options.maxBudgetUsd,
    },
  });

  if (result.sessionId && result.usage) {
    await updateSessionTokens(result.sessionId, result.usage.totalTokens);
  }

  if (options.saveHistory !== false) {
    await addHistoryEntry({
      prompt,
      result: result.text,
      sessionId: result.sessionId ?? '',
      costUsd: result.costUsd ?? 0,
      durationMs: result.durationMs,
      model: options.model ?? cfg.defaults.model,
    });
  }

  if (options.saveChatLog !== false) {
    void addChatLog(prompt, result.text);
  }

  return {
    text: result.text,
    sessionId: result.sessionId,
    costUsd: result.costUsd,
    durationMs: result.durationMs,
    usage: result.usage,
    raw: result.raw,
  };
}

export async function* streamPrompt(
  prompt: string,
  options: RunnerOptions = {},
  config?: AppConfig,
): AsyncGenerator<AdapterStreamEvent> {
  const cfg = config ?? (await loadConfig());

  if (!prompt) {
    throw new Error('No prompt provided.');
  }

  const memoryOpt =
    options.memory === false
      ? false
      : Array.isArray(options.memory)
        ? options.memory
        : true;

  const appendSystemPrompt =
    (await buildSystemPromptContext(
      {
        memory: memoryOpt,
        life: options.life !== false,
        workspace: options.workspace !== false,
        chatLog: options.chatLog !== false,
        lifeQuery: prompt,
      },
      cfg,
    )) || undefined;

  let sessionId = options.sessionId;
  if (sessionId && options.maxSessionTokens) {
    const currentTokens = await getSessionTokens(sessionId);
    if (currentTokens > options.maxSessionTokens) {
      sessionId = undefined;
    }
  }

  const providerName = options.provider ?? cfg.provider.default;
  const adapter = resolveAdapter(providerName, cfg);

  const request = {
    prompt,
    model: options.model ?? cfg.defaults.model,
    maxTurns: options.maxTurns ?? cfg.defaults.maxTurns,
    systemPrompt: options.systemPrompt,
    sessionId,
    continueSession: options.continueSession,
    options: {
      appendSystemPrompt,
      maxBudgetUsd: options.maxBudgetUsd,
    },
  };

  let finalResult: AdapterResult | undefined;

  for await (const event of adapter.stream(request)) {
    yield event;
    if (event.type === 'result') {
      finalResult = event.result;
    }
  }

  if (finalResult) {
    if (finalResult.sessionId && finalResult.usage) {
      await updateSessionTokens(finalResult.sessionId, finalResult.usage.totalTokens);
    }

    if (options.saveHistory !== false) {
      await addHistoryEntry({
        prompt,
        result: finalResult.text,
        sessionId: finalResult.sessionId ?? '',
        costUsd: finalResult.costUsd ?? 0,
        durationMs: finalResult.durationMs,
        model: options.model ?? cfg.defaults.model,
      });
    }

    if (options.saveChatLog !== false) {
      void addChatLog(prompt, finalResult.text);
    }
  }
}
