import { randomBytes } from 'node:crypto';

import type Database from 'better-sqlite3';
import type { z } from 'zod';

import type {
  CreateSessionSchema,
  EndSessionSchema,
  ErrorSchema,
  IngestEventSchema,
  TokenUsageSchema,
  ToolCallSchema,
} from '../core/models.js';

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

function now(): string {
  return new Date().toISOString();
}

export function createSession(
  db: Database.Database,
  input: z.infer<typeof CreateSessionSchema>,
): string {
  const id = input.id || genId('ses');
  db.prepare(
    `INSERT INTO sessions (id, source, model, started_at, status, metadata) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, model), metadata = COALESCE(excluded.metadata, metadata)`,
  ).run(
    id,
    input.source,
    input.model ?? null,
    input.started_at ?? now(),
    'active',
    input.metadata ? JSON.stringify(input.metadata) : null,
  );
  return id;
}

export function endSession(
  db: Database.Database,
  sessionId: string,
  input: z.infer<typeof EndSessionSchema>,
): void {
  db.prepare('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?').run(
    input.status,
    input.ended_at ?? now(),
    sessionId,
  );
}

export function insertEvent(
  db: Database.Database,
  input: z.infer<typeof IngestEventSchema>,
): string {
  const id = genId('evt');
  db.prepare(
    'INSERT INTO events (id, session_id, type, timestamp, data) VALUES (?, ?, ?, ?, ?)',
  ).run(
    id,
    input.session_id,
    input.type,
    input.timestamp ?? now(),
    JSON.stringify(input.data ?? {}),
  );
  return id;
}

export function insertEventBatch(
  db: Database.Database,
  events: z.infer<typeof IngestEventSchema>[],
): number {
  const stmt = db.prepare(
    'INSERT INTO events (id, session_id, type, timestamp, data) VALUES (?, ?, ?, ?, ?)',
  );

  const tx = db.transaction((items: typeof events) => {
    let count = 0;
    for (const e of items) {
      stmt.run(
        genId('evt'),
        e.session_id,
        e.type,
        e.timestamp ?? now(),
        JSON.stringify(e.data ?? {}),
      );
      count++;
    }
    return count;
  });

  return tx(events);
}

export function insertToolCall(
  db: Database.Database,
  input: z.infer<typeof ToolCallSchema>,
): string {
  const id = genId('tc');
  db.prepare(
    'INSERT INTO tool_calls (id, session_id, tool_name, success, duration_ms, timestamp, args, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.session_id,
    input.tool_name,
    input.success ? 1 : 0,
    input.duration_ms ?? null,
    input.timestamp ?? now(),
    input.args ? JSON.stringify(input.args) : null,
    input.error ?? null,
  );
  return id;
}

export function insertTokenUsage(
  db: Database.Database,
  input: z.infer<typeof TokenUsageSchema>,
): string {
  const id = genId('tok');
  db.prepare(
    'INSERT INTO token_usage (id, session_id, model, input_tokens, output_tokens, cache_read, cache_write, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.session_id,
    input.model,
    input.input_tokens,
    input.output_tokens,
    input.cache_read,
    input.cache_write,
    input.timestamp ?? now(),
  );
  return id;
}

export function insertError(db: Database.Database, input: z.infer<typeof ErrorSchema>): string {
  const id = genId('err');
  db.prepare(
    'INSERT INTO errors (id, session_id, type, message, stack, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.session_id ?? null,
    input.type,
    input.message,
    input.stack ?? null,
    input.timestamp ?? now(),
  );
  return id;
}
