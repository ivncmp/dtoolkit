import { DProxyClient } from '@dtoolkit/sdk';

import type { Config } from './config.js';

export interface LlmRequest {
  prompt: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  maxBudgetUsd?: number;
}

export interface LlmResponse {
  text: string;
  costUsd?: number;
  durationMs: number;
}

let client: DProxyClient | null = null;
let defaults: { provider?: string; model?: string } = {};

export function initLlm(config: Config): void {
  const { dproxyUrl, dproxyToken, provider, model } = config.llm;
  if (!dproxyUrl) {
    client = null;
    return;
  }
  client = new DProxyClient(dproxyUrl, dproxyToken);
  defaults = { provider, model };
}

export function isLlmConfigured(): boolean {
  return client !== null;
}

export async function llmAsk(req: LlmRequest): Promise<LlmResponse> {
  if (!client) throw new Error('LLM not configured. Run: dbrain configure');
  const res = await client.ask(req.prompt, {
    systemPrompt: req.systemPrompt,
    provider: (req.provider ?? defaults.provider) as
      | 'claude'
      | 'codex'
      | 'gemini'
      | 'opencode'
      | undefined,
    model: req.model ?? defaults.model,
    maxBudgetUsd: req.maxBudgetUsd,
    maxTurns: 1,
    memory: false,
    life: false,
    workspace: false,
    chatLog: false,
    saveHistory: false,
    saveChatLog: false,
  });
  return { text: res.text, costUsd: res.costUsd, durationMs: res.durationMs };
}
