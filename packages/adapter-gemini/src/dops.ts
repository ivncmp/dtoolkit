import { globSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type {
  IngestState,
  ParsedSession,
  ParsedToolCall,
  TelemetryExtractor,
} from '@dtoolkit/core';

const GEMINI_TMP = join(homedir(), '.gemini', 'tmp');

class GeminiTelemetry implements TelemetryExtractor {
  readonly name = 'gemini';

  scan(state: IngestState, since: Date): ParsedSession[] {
    const sessions: ParsedSession[] = [];

    let files: string[];
    try {
      files = globSync(join(GEMINI_TMP, '**', 'chats', '*.jsonl'));
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
            if (d['sessionId']) {
              sessionId = d['sessionId'] as string;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!sessionId) continue;

        const prev = state.sessions[`gemini:${sessionId}`];
        if (prev && prev.lines >= lines.length && prev.mtime >= stat.mtimeMs) continue;

        const session = parseGeminiSession(sessionId, lines);
        if (session) sessions.push(session);

        state.sessions[`gemini:${sessionId}`] = { lines: lines.length, mtime: stat.mtimeMs };
      } catch {
        continue;
      }
    }

    return sessions;
  }
}

function parseGeminiSession(sessionId: string, lines: string[]): ParsedSession | null {
  const session: ParsedSession = {
    id: `gemini:${sessionId}`,
    source: 'gemini',
    started_at: '',
    token_usage: [],
    tool_calls: [],
  };

  for (const line of lines) {
    try {
      const d = JSON.parse(line) as Record<string, unknown>;

      if (d['kind'] && !d['type']) {
        session.started_at = (d['startTime'] as string) || '';
        continue;
      }

      if (d['type'] === 'gemini') {
        const ts = (d['timestamp'] as string) || '';
        const model = (d['model'] as string) || '';

        if (model && !session.model) {
          session.model = model;
        }

        const tokens = d['tokens'] as Record<string, number> | undefined;
        if (tokens && ts) {
          session.token_usage.push({
            model: model || session.model || 'gemini',
            input_tokens: tokens['input'] ?? 0,
            output_tokens: tokens['output'] ?? 0,
            cache_read: tokens['cached'] ?? 0,
            cache_write: 0,
            timestamp: ts,
          });
        }

        const content = d['content'] as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content) && ts) {
          for (const block of content) {
            const fc = block['functionCall'] as Record<string, unknown> | undefined;
            if (fc) {
              session.tool_calls.push({
                tool_name: (fc['name'] as string) || 'unknown',
                success: true,
                timestamp: ts,
                args: fc['args'] as Record<string, unknown> | undefined,
              });
            }

            const fr = block['functionResponse'] as Record<string, unknown> | undefined;
            if (fr?.['error']) {
              const name = (fr['name'] as string) || 'unknown';
              const lastCall = [...session.tool_calls]
                .reverse()
                .find((tc: ParsedToolCall) => tc.tool_name === name);
              if (lastCall) {
                lastCall.success = false;
                lastCall.error = (
                  ((fr['error'] as Record<string, unknown>)?.['message'] as string) ||
                  JSON.stringify(fr['error'])
                ).slice(0, 500);
              }
            }
          }
        }

        if (ts) session.ended_at = ts;
      }
    } catch {
      continue;
    }
  }

  if (!session.started_at) return null;
  if (session.token_usage.length === 0 && session.tool_calls.length === 0) return null;
  return session;
}

export function createGeminiTelemetry(): TelemetryExtractor {
  return new GeminiTelemetry();
}
