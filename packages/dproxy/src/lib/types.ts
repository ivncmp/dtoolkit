export type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
  HistoryEntry,
  InputFile,
  SessionInfo,
  TemplateDefinition,
  TemplateVariable,
} from '@dtoolkit/core';

export type ProviderName = 'claude' | 'codex' | 'gemini' | 'opencode';

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
  provider: {
    default: ProviderName;
    claude?: { bin?: string; skipPermissions?: boolean };
    codex?: { bin?: string; approval?: 'suggest' | 'auto-edit' | 'full-auto' };
    gemini?: { bin?: string; yolo?: boolean };
    opencode?: { bin?: string; skipPermissions?: boolean };
  };
  defaults: {
    model?: string;
    maxTurns?: number;
    outputFormat?: 'text' | 'json' | 'stream-json';
  };
  server: {
    port: number;
    host: string;
    apiKey?: string;
  };
  debug: boolean;
}
