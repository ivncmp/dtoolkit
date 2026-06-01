/**
 * @dtoolkit/dops — REST API examples
 *
 * Demonstrates: health check, session lifecycle, event ingestion,
 * token usage, tool calls, error reporting, and analytics queries.
 *
 * dops doesn't have an SDK client yet — these examples use fetch directly.
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run dops
 */

const DOPS_URL = process.env.DOPS_URL ?? "http://localhost:7883";
const DOPS_TOKEN = process.env.DOPS_TOKEN ?? "changeme";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${DOPS_TOKEN}`,
};

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${DOPS_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${method} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ──────────────────────────────────────────────────────────

async function healthCheck(): Promise<void> {
  const health = await api<{
    status: string;
    service: string;
    version: string;
    stats: {
      sessions: number;
      events: number;
      tool_calls: number;
      errors: number;
      token_records: number;
    };
  }>("GET", "/health");
  console.log(`dops v${health.version} is ${health.status}`);
  console.log(
    `  ${health.stats.sessions} sessions, ${health.stats.events} events, ${health.stats.tool_calls} tool calls`,
  );
}

// ── Session lifecycle ──────────────────────────────────────────────

async function sessionLifecycle(): Promise<string> {
  const { id } = await api<{ id: string }>("POST", "/sessions", {
    source: "sdk-example",
    model: "claude-sonnet-4-6",
    metadata: { project: "dtoolkit", purpose: "demo" },
  });
  console.log(`\nCreated session: ${id}`);

  const session = await api<{ id: string; status: string; source: string }>(
    "GET",
    `/sessions/${id}`,
  );
  console.log(`  Status: ${session.status}, source: ${session.source}`);

  return id;
}

// ── Token usage ────────────────────────────────────────────────────

async function ingestTokenUsage(sessionId: string): Promise<void> {
  await api("POST", "/token-usage", {
    session_id: sessionId,
    model: "claude-sonnet-4-6",
    input_tokens: 1250,
    output_tokens: 430,
    cache_read: 800,
    cache_write: 200,
  });
  console.log(`\nIngested token usage (1250 in / 430 out / 800 cache read)`);

  await api("POST", "/token-usage", {
    session_id: sessionId,
    model: "claude-sonnet-4-6",
    input_tokens: 2100,
    output_tokens: 890,
    cache_read: 1500,
    cache_write: 0,
  });
  console.log(`  Ingested second token record (2100 in / 890 out)`);
}

// ── Tool calls ─────────────────────────────────────────────────────

async function ingestToolCalls(sessionId: string): Promise<void> {
  await api("POST", "/tool-calls", {
    session_id: sessionId,
    tool_name: "Read",
    success: true,
    duration_ms: 12,
    args: { file_path: "/src/index.ts" },
  });

  await api("POST", "/tool-calls", {
    session_id: sessionId,
    tool_name: "Edit",
    success: true,
    duration_ms: 45,
    args: { file_path: "/src/index.ts" },
  });

  await api("POST", "/tool-calls", {
    session_id: sessionId,
    tool_name: "Bash",
    success: false,
    duration_ms: 5200,
    error: "Command timed out",
  });

  console.log(`\nIngested 3 tool calls (2 success, 1 failed)`);
}

// ── Events ─────────────────────────────────────────────────────────

async function ingestEvents(sessionId: string): Promise<void> {
  await api("POST", "/events", {
    session_id: sessionId,
    type: "session_start",
    data: { cwd: "/home/user/project", provider: "claude" },
  });
  console.log(`\nIngested session_start event`);

  await api("POST", "/events/batch", {
    events: [
      {
        session_id: sessionId,
        type: "tool_call",
        data: { tool: "Read", file: "/src/index.ts" },
      },
      {
        session_id: sessionId,
        type: "tool_call",
        data: { tool: "Edit", file: "/src/index.ts" },
      },
      {
        session_id: sessionId,
        type: "custom",
        data: { action: "user_approved_edit" },
      },
    ],
  });
  console.log(`  Batch-ingested 3 events`);
}

// ── Errors ─────────────────────────────────────────────────────────

async function ingestErrors(sessionId: string): Promise<void> {
  await api("POST", "/errors", {
    session_id: sessionId,
    type: "tool_error",
    message: "ENOENT: no such file or directory '/src/missing.ts'",
  });
  console.log(`\nIngested 1 error`);
}

// ── End session ────────────────────────────────────────────────────

async function endSession(sessionId: string): Promise<void> {
  await api("PATCH", `/sessions/${sessionId}`, {
    status: "completed",
  });
  console.log(`\nSession ${sessionId} marked as completed`);
}

// ── Query: sessions list ───────────────────────────────────────────

async function querySessions(): Promise<void> {
  const sessions = await api<
    Array<{
      id: string;
      source: string;
      status: string;
      total_input: number;
      total_output: number;
      tool_count: number;
      error_count: number;
    }>
  >("GET", "/sessions?limit=5");
  console.log(`\nSessions (${sessions.length}):`);
  for (const s of sessions) {
    console.log(
      `  [${s.status}] ${s.id} — ${s.total_input + s.total_output} tokens, ${s.tool_count} tools, ${s.error_count} errors`,
    );
  }
}

// ── Query: session detail ──────────────────────────────────────────

async function querySessionDetail(sessionId: string): Promise<void> {
  const detail = await api<{
    id: string;
    source: string;
    status: string;
    token_usage: Array<{
      model: string;
      input_tokens: number;
      output_tokens: number;
      cache_read: number;
    }>;
    tool_calls: Array<{
      tool_name: string;
      success: number;
      duration_ms: number | null;
    }>;
    errors: Array<{ type: string; message: string }>;
  }>("GET", `/sessions/${sessionId}`);

  console.log(`\nSession detail: ${detail.id}`);
  console.log(`  Token records: ${detail.token_usage.length}`);
  for (const t of detail.token_usage) {
    console.log(
      `    ${t.model}: ${t.input_tokens} in / ${t.output_tokens} out / ${t.cache_read} cache`,
    );
  }
  console.log(`  Tool calls: ${detail.tool_calls.length}`);
  for (const t of detail.tool_calls) {
    const status = t.success ? "ok" : "FAIL";
    const duration = t.duration_ms ? ` (${t.duration_ms}ms)` : "";
    console.log(`    [${status}] ${t.tool_name}${duration}`);
  }
  console.log(`  Errors: ${detail.errors.length}`);
  for (const e of detail.errors) {
    console.log(`    [${e.type}] ${e.message}`);
  }
}

// ── Query: tool stats ──────────────────────────────────────────────

async function queryToolStats(): Promise<void> {
  const tools = await api<
    Array<{
      tool_name: string;
      total: number;
      success: number;
      failed: number;
      avg_duration_ms: number | null;
    }>
  >("GET", "/stats/tools");
  console.log(`\nTool stats (${tools.length} tools):`);
  for (const t of tools) {
    const avg = t.avg_duration_ms ? ` avg ${t.avg_duration_ms}ms` : "";
    console.log(
      `  ${t.tool_name}: ${t.total} calls (${t.success} ok, ${t.failed} failed)${avg}`,
    );
  }
}

// ── Query: model stats ─────────────────────────────────────────────

async function queryModelStats(): Promise<void> {
  const models = await api<
    Array<{
      model: string;
      sessions: number;
      input_tokens: number;
      output_tokens: number;
      cache_read: number;
    }>
  >("GET", "/stats/models");
  console.log(`\nModel stats (${models.length} models):`);
  for (const m of models) {
    const total = m.input_tokens + m.output_tokens;
    console.log(
      `  ${m.model}: ${total} tokens (${m.input_tokens} in / ${m.output_tokens} out), ${m.cache_read} cache read`,
    );
  }
}

// ── Query: source stats ────────────────────────────────────────────

async function querySourceStats(): Promise<void> {
  const sources = await api<
    Array<{
      source: string;
      sessions: number;
      input_tokens: number;
      output_tokens: number;
    }>
  >("GET", "/stats/sources");
  console.log(`\nSource stats (${sources.length} sources):`);
  for (const s of sources) {
    console.log(
      `  ${s.source}: ${s.sessions} sessions, ${s.input_tokens + s.output_tokens} tokens`,
    );
  }
}

// ── Query: timeseries ──────────────────────────────────────────────

async function queryTimeseries(): Promise<void> {
  const buckets = await api<
    Array<{
      bucket: string;
      sessions: number;
      input_tokens: number;
      output_tokens: number;
      tool_calls: number;
      errors: number;
    }>
  >("GET", "/stats/timeseries?interval=1h");
  console.log(`\nTimeseries (${buckets.length} buckets):`);
  for (const b of buckets.slice(0, 5)) {
    console.log(
      `  ${b.bucket}: ${b.sessions} sessions, ${b.input_tokens + b.output_tokens} tokens, ${b.tool_calls} tools`,
    );
  }
  if (buckets.length > 5) console.log(`  ... and ${buckets.length - 5} more`);
}

// ── Run ─────────────────────────────────────────────────────────────

try {
  await healthCheck();
  const sessionId = await sessionLifecycle();
  await ingestTokenUsage(sessionId);
  await ingestToolCalls(sessionId);
  await ingestEvents(sessionId);
  await ingestErrors(sessionId);
  await endSession(sessionId);
  await querySessions();
  await querySessionDetail(sessionId);
  await queryToolStats();
  await queryModelStats();
  await querySourceStats();
  await queryTimeseries();
} catch (err) {
  console.error("\nError:", (err as Error).message);
  process.exit(1);
}
