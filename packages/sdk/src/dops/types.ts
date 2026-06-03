export interface DOpsHealthResponse {
  status: string;
  service: string;
  version: string;
  port: number;
  pricing: unknown;
  stats: {
    sessions: number;
    events: number;
    tool_calls: number;
    errors: number;
    token_records: number;
  };
}

// --- Ingest input types ---

export interface DOpsCreateSession {
  id?: string;
  source: string;
  model?: string;
  started_at?: string;
  metadata?: Record<string, unknown>;
}

export type DOpsSessionStatus = 'completed' | 'failed' | 'abandoned';

export interface DOpsEndSession {
  status?: DOpsSessionStatus;
  ended_at?: string;
}

export type DOpsEventType =
  | 'session_start'
  | 'session_end'
  | 'tool_call'
  | 'token_usage'
  | 'error'
  | 'custom';

export interface DOpsEvent {
  session_id: string;
  type: DOpsEventType;
  timestamp?: string;
  data?: Record<string, unknown>;
}

export interface DOpsToolCall {
  session_id: string;
  tool_name: string;
  success?: boolean;
  duration_ms?: number;
  timestamp?: string;
  args?: Record<string, unknown>;
  error?: string;
}

export interface DOpsTokenUsage {
  session_id: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read?: number;
  cache_write?: number;
  timestamp?: string;
}

export interface DOpsError {
  session_id?: string;
  type: string;
  message: string;
  stack?: string;
  timestamp?: string;
}

// --- Query response types ---

export interface DOpsSessionRow {
  id: string;
  source: string;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  metadata: string | null;
  token_count: number;
  tool_count: number;
  error_count: number;
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_cache_write: number;
}

export interface DOpsSessionDetail extends DOpsSessionRow {
  token_usage: Array<{
    id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_write: number;
    timestamp: string;
  }>;
  tool_calls: Array<{
    id: string;
    tool_name: string;
    success: number;
    duration_ms: number | null;
    timestamp: string;
    args: string | null;
    error: string | null;
  }>;
  errors: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface DOpsTimeSeriesBucket {
  bucket: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
  tool_calls: number;
  errors: number;
}

export interface DOpsToolStat {
  tool_name: string;
  total: number;
  success: number;
  failed: number;
  avg_duration_ms: number | null;
}

export interface DOpsModelStat {
  model: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
}

export interface DOpsSourceStat {
  source: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
}

// --- Filter types ---

export interface DOpsSessionFilters {
  source?: string;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface DOpsTimeSeriesFilters {
  from?: string;
  to?: string;
  source?: string;
  interval?: '15m' | '1h';
}

export interface DOpsStatsFilters {
  from?: string;
  to?: string;
  source?: string;
}

export interface DOpsDateFilters {
  from?: string;
  to?: string;
}
