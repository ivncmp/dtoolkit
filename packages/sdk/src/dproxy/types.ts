import type {
  AdapterUsage,
  HistoryEntry,
  InputFile,
  TemplateDefinition,
} from "@dtoolkit/core";

export type ProviderName =
  | "claude"
  | "codex"
  | "gemini"
  | "ollama"
  | "opencode";

// --- Ask ---

export interface AskOptions {
  provider?: ProviderName;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  systemPrompt?: string;
  memory?: boolean | string[];
  life?: boolean;
  workspace?: boolean;
  chatLog?: boolean;
  files?: InputFile[];
  sessionId?: string;
  continueSession?: boolean;
  maxSessionTokens?: number;
  saveHistory?: boolean;
  saveChatLog?: boolean;
}

export interface AskResponse {
  text: string;
  sessionId?: string;
  costUsd?: number;
  durationMs: number;
  usage?: AdapterUsage;
  raw?: unknown;
}

// --- Health ---

export interface DProxyHealthResponse {
  status: string;
  provider: string;
  version: string;
}

// --- History ---

export type { HistoryEntry };

// --- Memory ---

export interface MemorySearchResult {
  key: string;
  content: string;
}

// --- Templates ---

export type { TemplateDefinition };

export interface TemplateRunOptions {
  vars?: Record<string, string>;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  provider?: ProviderName;
}
