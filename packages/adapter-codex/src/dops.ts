import { globSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { IngestState, ParsedSession, TelemetryExtractor } from '@dtoolkit/core';

const CODEX_SESSIONS = join(homedir(), '.codex', 'sessions');

class CodexTelemetry implements TelemetryExtractor {
  readonly name = 'codex';

  scan(state: IngestState, since: Date): ParsedSession[] {
    const sessions: ParsedSession[] = [];

    let files: string[];
    try {
      files = globSync(join(CODEX_SESSIONS, '**', '*.jsonl'));
    } catch {
      return sessions;
    }

    for (const filePath of files) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < since.getTime()) continue;

        const raw = readFileSync(filePath, 'utf-8');
        const lines = raw.split('\n').filter((l) => l.trim());

        let sessionId = '';
        for (const line of lines) {
          try {
            const d = JSON.parse(line) as Record<string, unknown>;
            if (d['type'] === 'session_meta') {
              const p = d['payload'] as Record<string, unknown>;
              sessionId = p['id'] as string;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!sessionId) continue;

        const prev = state.sessions[`codex:${sessionId}`];
        if (prev && prev.lines >= lines.length && prev.mtime >= stat.mtimeMs) continue;

        const session = parseCodexSession(sessionId, lines);
        if (session) sessions.push(session);

        state.sessions[`codex:${sessionId}`] = { lines: lines.length, mtime: stat.mtimeMs };
      } catch {
        continue;
      }
    }

    return sessions;
  }
}

function parseCodexSession(sessionId: string, lines: string[]): ParsedSession | null {
  const session: ParsedSession = {
    id: `codex:${sessionId}`,
    source: 'codex',
    started_at: '',
    token_usage: [],
    tool_calls: [],
  };

  let lastTokenTotal: Record<string, number> | null = null;
  let lastTokenTs = '';

  for (const line of lines) {
    try {
      const d = JSON.parse(line) as Record<string, unknown>;
      const t = d['type'] as string;
      const p = d['payload'] as Record<string, unknown>;
      const ts = (d['timestamp'] as string) || '';

      if (t === 'session_meta') {
        session.started_at = (p['timestamp'] as string) || ts;
        session.cwd = p['cwd'] as string | undefined;
        session.model = p['model_provider'] as string | undefined;
      }

      if (t === 'event_msg') {
        const etype = (p['type'] as string) || '';

        if (etype === 'token_count') {
          const info = p['info'] as Record<string, unknown> | null;
          if (info) {
            const last = info['last_token_usage'] as Record<string, number> | undefined;
            if (last) {
              session.token_usage.push({
                model: session.model || 'codex',
                input_tokens: last['input_tokens'] ?? 0,
                output_tokens: last['output_tokens'] ?? 0,
                cache_read: last['cached_input_tokens'] ?? 0,
                cache_write: 0,
                timestamp: ts,
              });
            }
            const total = info['total_token_usage'] as Record<string, number> | undefined;
            if (total) {
              lastTokenTotal = total;
              lastTokenTs = ts;
            }
          }
        }

        if (etype === 'mcp_tool_call_end') {
          const inv = p['invocation'] as Record<string, unknown> | undefined;
          const dur = p['duration'] as { secs?: number; nanos?: number } | undefined;
          const result = p['result'] as Record<string, unknown> | undefined;
          const durationMs = dur
            ? (dur.secs ?? 0) * 1000 + Math.round((dur.nanos ?? 0) / 1e6)
            : undefined;
          const isError = !!result?.['Err'];

          let errorText: string | undefined;
          if (isError) {
            errorText = JSON.stringify(result['Err']).slice(0, 500);
          } else if (result?.['Ok']) {
            const ok = result['Ok'] as Record<string, unknown>;
            if (ok['isError']) {
              const content = ok['content'] as Array<Record<string, unknown>> | undefined;
              errorText = content?.[0]?.['text'] as string | undefined;
            }
          }

          session.tool_calls.push({
            tool_name: inv ? `${inv['server']}:${inv['tool']}` : 'unknown',
            success:
              !isError && !(result?.['Ok'] as Record<string, unknown> | undefined)?.['isError'],
            duration_ms: durationMs,
            timestamp: ts,
            args: inv?.['arguments'] as Record<string, unknown> | undefined,
            error: errorText?.slice(0, 500),
          });
        }

        if (etype === 'exec_command_end') {
          const dur = p['duration'] as { secs?: number; nanos?: number } | undefined;
          const exit = p['exit_code'] as number | undefined;
          const durationMs = dur
            ? (dur.secs ?? 0) * 1000 + Math.round((dur.nanos ?? 0) / 1e6)
            : undefined;

          session.tool_calls.push({
            tool_name: 'exec_command',
            success: exit === 0,
            duration_ms: durationMs,
            timestamp: ts,
            args: p['command'] ? { command: (p['command'] as string).slice(0, 200) } : undefined,
            error: exit !== 0 ? `exit code ${exit}` : undefined,
          });
        }

        if (etype === 'turn_aborted' || etype === 'turn_completed') {
          session.ended_at =
            ts ||
            (p['completed_at']
              ? new Date((p['completed_at'] as number) * 1000).toISOString()
              : undefined);
        }
      }
    } catch {
      continue;
    }
  }

  if (!session.started_at) return null;

  if (session.token_usage.length === 0 && lastTokenTotal) {
    session.token_usage.push({
      model: session.model || 'codex',
      input_tokens: lastTokenTotal['input_tokens'] ?? 0,
      output_tokens: lastTokenTotal['output_tokens'] ?? 0,
      cache_read: lastTokenTotal['cached_input_tokens'] ?? 0,
      cache_write: 0,
      timestamp: lastTokenTs || session.started_at,
    });
  }

  if (session.token_usage.length === 0 && session.tool_calls.length === 0) return null;
  return session;
}

export function createCodexTelemetry(): TelemetryExtractor {
  return new CodexTelemetry();
}
