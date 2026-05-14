export interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Target {
  readonly name: string;
  install(): Promise<void>;
  uninstall(): Promise<void>;
  isInstalled(): Promise<boolean>;
  parseTranscript(path: string): Promise<TranscriptEntry[]>;
  resolveTranscriptPath(sessionId: string, cwd: string): string;
  detectFromEnv(env: Record<string, string | undefined>): boolean;
  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined;
}
