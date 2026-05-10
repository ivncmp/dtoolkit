export type {
  HistoryEntry,
  SessionInfo,
  TemplateDefinition,
  TemplateVariable,
} from "@dtoolkit/core";

export interface ClaudeOptions {
  prompt: string;
  stdinContent?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  model?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  resumeSessionId?: string;
  continueSession?: boolean;
  allowedTools?: string[];
  additionalArgs?: string[];
}

export interface ClaudeUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  total: number;
}

export interface ClaudeResult {
  result: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  isError: boolean;
  usage?: ClaudeUsage;
  raw?: unknown;
}

export interface AppConfig {
  initialized: boolean;
  memory: {
    autoInject: boolean;
    defaultKeys: string[];
    maxInjectionChars: number;
  };
  life: {
    autoInject: boolean;
    dir: string;
    maxInjectionChars: number;
    maxEntityChars: number;
    pythonBin: string;
  };
  history: {
    maxEntries: number;
  };
  workspace: {
    enabled: boolean;
    dir: string;
    maxInjectionChars: number;
    files: Array<{ file: string; header: string }>;
  };
  chatLog: {
    enabled: boolean;
    dir: string;
    userPrefix: string;
    assistantPrefix: string;
    sectionHeader: string;
  };
  claude: {
    bin: string;
    skipPermissions: boolean;
  };
  defaults: {
    model?: string;
    maxTurns?: number;
    outputFormat?: "text" | "json" | "stream-json";
  };
  debug: boolean;
}
