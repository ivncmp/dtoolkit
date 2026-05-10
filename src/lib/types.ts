/** Options passed to {@link execClaude} for a single Claude CLI invocation. */
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

/** Token usage breakdown from a Claude CLI response. */
export interface ClaudeUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  total: number;
}

/** Parsed result from a Claude CLI invocation. */
export interface ClaudeResult {
  result: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  isError: boolean;
  usage?: ClaudeUsage;
  raw?: unknown;
}

/** A single entry in the JSONL history file. */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  prompt: string;
  result: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  model?: string;
  templateUsed?: string;
}

/** Metadata for the current/last chat session (persisted for `--continue`). */
export interface SessionInfo {
  sessionId: string;
  startedAt: string;
  name?: string;
}

/** A reusable YAML prompt template with variable placeholders. */
export interface TemplateDefinition {
  name: string;
  description?: string;
  prompt: string;
  variables?: TemplateVariable[];
  claudeOptions?: Partial<Pick<ClaudeOptions, 'model' | 'maxTurns' | 'maxBudgetUsd'>>;
}

/** A variable declaration within a prompt template. */
export interface TemplateVariable {
  name: string;
  source?: 'stdin' | 'arg' | 'flag';
  required?: boolean;
  default?: string;
}

/** Full application configuration stored in ~/.claude-wrapper/config.json. */
export interface AppConfig {
  /** Whether `cw init` has been run. Commands require this to be true. */
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
    outputFormat?: 'text' | 'json' | 'stream-json';
  };
  debug: boolean;
}
