export interface ParsedTokenUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
  timestamp: string;
}

export interface ParsedToolCall {
  tool_name: string;
  success: boolean;
  duration_ms?: number;
  timestamp: string;
  args?: Record<string, unknown>;
  error?: string;
}

export interface ParsedSession {
  id: string;
  source: string;
  model?: string;
  started_at: string;
  ended_at?: string;
  cwd?: string;
  token_usage: ParsedTokenUsage[];
  tool_calls: ParsedToolCall[];
}

export interface IngestState {
  sessions: Record<string, { lines: number; mtime: number }>;
}

export interface TelemetryExtractor {
  readonly name: string;
  scan(state: IngestState, since: Date): ParsedSession[];
}
