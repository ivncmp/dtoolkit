import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { IngestState, ParsedSession, TelemetryExtractor } from '@dtoolkit/core';

const CLAUDE_PROJECTS = join(homedir(), '.claude', 'projects');

class ClaudeTelemetry implements TelemetryExtractor {
  readonly name = 'claude';

  scan(state: IngestState, since: Date): ParsedSession[] {
    const sessions: ParsedSession[] = [];

    let projectDirs: string[];
    try {
      projectDirs = readdirSync(CLAUDE_PROJECTS);
    } catch {
      return sessions;
    }

    for (const projDir of projectDirs) {
      const projPath = join(CLAUDE_PROJECTS, projDir);
      let files: string[];
      try {
        const entries = readdirSync(projPath);
        files = entries.filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = join(projPath, file);
        const sessionId = file.replace('.jsonl', '');

        try {
          const stat = statSync(filePath);
          if (stat.mtimeMs < since.getTime()) continue;

          const prev = state.sessions[`claude:${sessionId}`];
          const raw = readFileSync(filePath, 'utf-8');
          const allLines = raw.split('\n').filter((l) => l.trim());
          if (prev && prev.lines >= allLines.length && prev.mtime >= stat.mtimeMs) continue;

          const startLine = prev?.lines ?? 0;
          const newLines = allLines.slice(startLine);
          if (newLines.length === 0) continue;

          const session = parseClaudeSession(sessionId, projDir, allLines, startLine);
          if (session) sessions.push(session);

          state.sessions[`claude:${sessionId}`] = { lines: allLines.length, mtime: stat.mtimeMs };
        } catch {
          continue;
        }
      }
    }

    return sessions;
  }
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > 200) {
      summary[key] = value.slice(0, 200) + '…';
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

function parseClaudeSession(
  sessionId: string,
  projectDir: string,
  allLines: string[],
  startLine: number,
): ParsedSession | null {
  const session: ParsedSession = {
    id: `claude:${sessionId}`,
    source: 'claude',
    started_at: '',
    cwd: projectDir.replace(/-/g, '/').replace(/^\//, ''),
    token_usage: [],
    tool_calls: [],
  };

  const toolResults = new Map<string, { isError: boolean; errorText?: string }>();
  for (const line of allLines) {
    try {
      const d = JSON.parse(line) as Record<string, unknown>;
      if (d['type'] !== 'user') continue;
      const content = (d['message'] as Record<string, unknown>)?.['content'] as
        | Array<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block['type'] === 'tool_result' && block['tool_use_id']) {
          const isError = !!block['is_error'];
          let errorText: string | undefined;
          if (isError) {
            const c = block['content'];
            if (typeof c === 'string') errorText = c.slice(0, 500);
            else if (Array.isArray(c)) {
              const txt = (c as Array<Record<string, unknown>>).find((b) => b['type'] === 'text');
              if (txt) errorText = ((txt['text'] as string) || '').slice(0, 500);
            }
          }
          toolResults.set(block['tool_use_id'] as string, { isError, errorText });
        }
      }
    } catch {
      continue;
    }
  }

  for (let i = 0; i < allLines.length; i++) {
    try {
      const d = JSON.parse(allLines[i]) as Record<string, unknown>;
      const ts = d['timestamp'] as string | undefined;

      if (i === 0 && ts) {
        session.started_at = ts;
      }

      if (i < startLine) {
        if (d['type'] === 'assistant') {
          const msg = d['message'] as Record<string, unknown> | undefined;
          if (msg?.['model'] && !session.model) {
            session.model = msg['model'] as string;
          }
        }
        continue;
      }

      if (d['type'] === 'assistant') {
        const msg = d['message'] as Record<string, unknown> | undefined;
        if (!msg) continue;

        if (msg['model'] && !session.model) {
          session.model = msg['model'] as string;
        }

        const usage = msg['usage'] as Record<string, number> | undefined;
        if (usage && ts) {
          session.token_usage.push({
            model: (msg['model'] as string) || session.model || 'unknown',
            input_tokens: usage['input_tokens'] ?? 0,
            output_tokens: usage['output_tokens'] ?? 0,
            cache_read: usage['cache_read_input_tokens'] ?? 0,
            cache_write: usage['cache_creation_input_tokens'] ?? 0,
            timestamp: ts,
          });
        }

        const content = msg['content'] as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content) && ts) {
          for (const block of content) {
            if (block['type'] === 'tool_use') {
              const toolId = block['id'] as string | undefined;
              const result = toolId ? toolResults.get(toolId) : undefined;
              const args = block['input'] as Record<string, unknown> | undefined;

              session.tool_calls.push({
                tool_name: (block['name'] as string) || 'unknown',
                success: result ? !result.isError : true,
                timestamp: ts,
                args: args ? summarizeArgs(args) : undefined,
                error: result?.errorText,
              });
            }
          }
        }
      }

      if (i === allLines.length - 1 && ts) {
        session.ended_at = ts;
      }
    } catch {
      continue;
    }
  }

  if (!session.started_at) return null;
  if (session.token_usage.length === 0 && session.tool_calls.length === 0) return null;
  return session;
}

export function createClaudeTelemetry(): TelemetryExtractor {
  return new ClaudeTelemetry();
}
