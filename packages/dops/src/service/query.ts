import type Database from 'better-sqlite3';

export interface SessionRow {
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

export interface SessionDetail extends SessionRow {
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

export interface TimeSeriesBucket {
  bucket: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
  tool_calls: number;
  errors: number;
}

export interface ToolStat {
  tool_name: string;
  total: number;
  success: number;
  failed: number;
  avg_duration_ms: number | null;
}

export interface ModelStat {
  model: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
}

export interface SourceStat {
  source: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
}

export function listSessions(
  db: Database.Database,
  filters: {
    source?: string;
    model?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  },
): SessionRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.source) {
    conditions.push("s.source LIKE ? || '%'");
    params.push(filters.source);
  }
  if (filters.model) {
    conditions.push('s.model = ?');
    params.push(filters.model);
  }
  if (filters.status) {
    conditions.push('s.status = ?');
    params.push(filters.status);
  }
  if (filters.from) {
    conditions.push('s.started_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('s.started_at <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  return db
    .prepare(
      `SELECT s.id, s.source, s.model, s.started_at, s.ended_at, s.status, s.metadata,
        (SELECT COUNT(*) FROM token_usage t WHERE t.session_id = s.id) AS token_count,
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id = s.id) AS tool_count,
        (SELECT COUNT(*) FROM errors e WHERE e.session_id = s.id) AS error_count,
        COALESCE((SELECT SUM(input_tokens) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_input,
        COALESCE((SELECT SUM(output_tokens) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_output,
        COALESCE((SELECT SUM(cache_read) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_cache_read,
        COALESCE((SELECT SUM(cache_write) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_cache_write
      FROM sessions s ${where}
      ORDER BY s.started_at DESC
      LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SessionRow[];
}

export function getSession(db: Database.Database, id: string): SessionDetail | null {
  const row = db
    .prepare(
      `SELECT s.id, s.source, s.model, s.started_at, s.ended_at, s.status, s.metadata,
        (SELECT COUNT(*) FROM token_usage t WHERE t.session_id = s.id) AS token_count,
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id = s.id) AS tool_count,
        (SELECT COUNT(*) FROM errors e WHERE e.session_id = s.id) AS error_count,
        COALESCE((SELECT SUM(input_tokens) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_input,
        COALESCE((SELECT SUM(output_tokens) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_output,
        COALESCE((SELECT SUM(cache_read) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_cache_read,
        COALESCE((SELECT SUM(cache_write) FROM token_usage t WHERE t.session_id = s.id), 0) AS total_cache_write
      FROM sessions s WHERE s.id = ?`,
    )
    .get(id) as SessionRow | undefined;

  if (!row) return null;

  const token_usage = db
    .prepare(
      'SELECT id, model, input_tokens, output_tokens, cache_read, cache_write, timestamp FROM token_usage WHERE session_id = ? ORDER BY timestamp',
    )
    .all(id) as SessionDetail['token_usage'];

  const tool_calls = db
    .prepare(
      'SELECT id, tool_name, success, duration_ms, timestamp, args, error FROM tool_calls WHERE session_id = ? ORDER BY timestamp',
    )
    .all(id) as SessionDetail['tool_calls'];

  const errors = db
    .prepare(
      'SELECT id, type, message, timestamp FROM errors WHERE session_id = ? ORDER BY timestamp',
    )
    .all(id) as SessionDetail['errors'];

  return { ...row, token_usage, tool_calls, errors };
}

export function getTimeSeries(
  db: Database.Database,
  filters: { from?: string; to?: string; source?: string; interval?: string },
): TimeSeriesBucket[] {
  const fmt = filters.interval === '15m' ? '%Y-%m-%dT%H:%M' : '%Y-%m-%dT%H:00';
  const round =
    filters.interval === '15m'
      ? "strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 15) * 15)"
      : `strftime('${fmt}', timestamp)`;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.source) {
    conditions.push("s.source LIKE ? || '%'");
    params.push(filters.source);
  }
  if (filters.from) {
    conditions.push('t.timestamp >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('t.timestamp <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT ${round} AS bucket,
        COUNT(DISTINCT t.session_id) AS sessions,
        SUM(t.input_tokens) AS input_tokens,
        SUM(t.output_tokens) AS output_tokens,
        SUM(t.cache_read) AS cache_read,
        SUM(t.cache_write) AS cache_write,
        (SELECT COUNT(*) FROM tool_calls tc WHERE ${round.replace(/\bt\./g, 'tc.')} = ${round.replace(/\btimestamp\b/, 'tc.timestamp')}) AS tool_calls,
        0 AS errors
      FROM token_usage t
      LEFT JOIN sessions s ON s.id = t.session_id
      ${where}
      GROUP BY bucket
      ORDER BY bucket`,
    )
    .all(...params) as TimeSeriesBucket[];
}

export function getToolStats(
  db: Database.Database,
  filters: { from?: string; to?: string; source?: string },
): ToolStat[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.source) {
    conditions.push("s.source LIKE ? || '%'");
    params.push(filters.source);
  }
  if (filters.from) {
    conditions.push('tc.timestamp >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('tc.timestamp <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT tc.tool_name,
        COUNT(*) AS total,
        SUM(CASE WHEN tc.success = 1 THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN tc.success = 0 THEN 1 ELSE 0 END) AS failed,
        AVG(tc.duration_ms) AS avg_duration_ms
      FROM tool_calls tc
      LEFT JOIN sessions s ON s.id = tc.session_id
      ${where}
      GROUP BY tc.tool_name
      ORDER BY total DESC`,
    )
    .all(...params) as ToolStat[];
}

export function getModelStats(
  db: Database.Database,
  filters: { from?: string; to?: string },
): ModelStat[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.from) {
    conditions.push('t.timestamp >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('t.timestamp <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT t.model,
        COUNT(DISTINCT t.session_id) AS sessions,
        SUM(t.input_tokens) AS input_tokens,
        SUM(t.output_tokens) AS output_tokens,
        SUM(t.cache_read) AS cache_read,
        SUM(t.cache_write) AS cache_write
      FROM token_usage t
      ${where}
      GROUP BY t.model
      ORDER BY output_tokens DESC`,
    )
    .all(...params) as ModelStat[];
}

export function getSourceStats(
  db: Database.Database,
  filters: { from?: string; to?: string },
): SourceStat[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.from) {
    conditions.push('s.started_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('s.started_at <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT s.source,
        COUNT(*) AS sessions,
        COALESCE(SUM(t.input_tokens), 0) AS input_tokens,
        COALESCE(SUM(t.output_tokens), 0) AS output_tokens
      FROM sessions s
      LEFT JOIN token_usage t ON t.session_id = s.id
      ${where}
      GROUP BY s.source
      ORDER BY sessions DESC`,
    )
    .all(...params) as SourceStat[];
}
