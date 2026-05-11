export interface AdapterRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTurns?: number;
  stdinContent?: string;
  sessionId?: string;
  continueSession?: boolean;
  options?: Record<string, unknown>;
}

export interface AdapterUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AdapterResult {
  text: string;
  sessionId?: string;
  costUsd?: number;
  durationMs: number;
  isError: boolean;
  usage?: AdapterUsage;
  model?: string;
  raw?: unknown;
}

export interface Adapter {
  readonly provider: string;
  execute(request: AdapterRequest): Promise<AdapterResult>;
}
