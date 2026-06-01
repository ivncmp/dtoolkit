import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { IngestState, ParsedSession, TelemetryExtractor } from '@dtoolkit/core';

const OC_DB_PATH = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');

class OpenCodeTelemetry implements TelemetryExtractor {
  readonly name = 'opencode';

  scan(state: IngestState, since: Date): ParsedSession[] {
    const sessions: ParsedSession[] = [];
    if (!existsSync(OC_DB_PATH)) return sessions;

    const sinceEpoch = since.getTime();

    let rows: Array<{
      id: string;
      model: string | null;
      directory: string | null;
      time_created: number;
      time_updated: number;
    }>;
    try {
      const out = execSync(
        `sqlite3 -json "${OC_DB_PATH}" "SELECT id, model, directory, time_created, time_updated FROM session WHERE time_created > ${sinceEpoch}"`,
        { encoding: 'utf-8', timeout: 10000 },
      );
      rows = JSON.parse(out) as typeof rows;
    } catch {
      return sessions;
    }

    for (const row of rows) {
      const prev = state.sessions[`opencode:${row.id}`];
      if (prev && prev.mtime >= row.time_updated) continue;

      const session = parseOpenCodeSession(row);
      if (session) sessions.push(session);

      state.sessions[`opencode:${row.id}`] = { lines: 0, mtime: row.time_updated };
    }

    return sessions;
  }
}

function parseOpenCodeSession(row: {
  id: string;
  model: string | null;
  directory: string | null;
  time_created: number;
  time_updated: number;
}): ParsedSession | null {
  let modelName: string | undefined;
  if (row.model) {
    try {
      const parsed = JSON.parse(row.model) as Record<string, unknown>;
      modelName = (parsed['id'] as string) || undefined;
    } catch {
      modelName = row.model;
    }
  }

  const session: ParsedSession = {
    id: `opencode:${row.id}`,
    source: 'opencode',
    model: modelName,
    started_at: new Date(row.time_created).toISOString(),
    ended_at: new Date(row.time_updated).toISOString(),
    cwd: row.directory || undefined,
    token_usage: [],
    tool_calls: [],
  };

  let messages: Array<{ data: string; time_created: number }>;
  try {
    const escapedId = row.id.replace(/'/g, "''");
    const out = execSync(
      `sqlite3 -json "${OC_DB_PATH}" "SELECT data, time_created FROM message WHERE session_id = '${escapedId}' ORDER BY time_created ASC"`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    messages = JSON.parse(out) as typeof messages;
  } catch {
    return null;
  }

  for (const msg of messages) {
    try {
      const data = JSON.parse(msg.data) as Record<string, unknown>;
      const ts = new Date(msg.time_created).toISOString();

      const tokens = data['tokens'] as Record<string, unknown> | undefined;
      if (tokens) {
        const cache = (tokens['cache'] as Record<string, number>) || {};
        session.token_usage.push({
          model: (data['modelID'] as string) || modelName || 'opencode',
          input_tokens: (tokens['input'] as number) ?? 0,
          output_tokens: (tokens['output'] as number) ?? 0,
          cache_read: cache['read'] ?? 0,
          cache_write: cache['write'] ?? 0,
          timestamp: ts,
        });
      }

      const parts = data['parts'] as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part['type'] === 'tool-invocation') {
            const failed = part['state'] !== 'result';
            session.tool_calls.push({
              tool_name: (part['toolName'] as string) || 'unknown',
              success: !failed,
              timestamp: ts,
              args: part['args'] as Record<string, unknown> | undefined,
              error: failed
                ? ((part['error'] as string) || `state: ${part['state']}`).slice(0, 500)
                : undefined,
            });
          }
        }
      }
    } catch {
      continue;
    }
  }

  if (session.token_usage.length === 0 && session.tool_calls.length === 0) return null;
  return session;
}

export function createOpenCodeTelemetry(): TelemetryExtractor {
  return new OpenCodeTelemetry();
}
