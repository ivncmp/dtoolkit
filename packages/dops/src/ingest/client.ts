import type { ParsedSession } from '@dtoolkit/core';

export interface DopsClientConfig {
  url: string;
  token: string;
}

async function post(config: DopsClientConfig, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${config.url}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function patch(config: DopsClientConfig, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${config.url}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function pushSession(config: DopsClientConfig, session: ParsedSession): Promise<void> {
  // 1. Create session
  await post(config, '/sessions', {
    id: session.id,
    source: session.source,
    model: session.model,
    started_at: session.started_at,
    metadata: session.cwd ? { cwd: session.cwd } : undefined,
  });

  // 2. Push token usage in batches
  for (const tu of session.token_usage) {
    await post(config, '/token-usage', {
      session_id: session.id,
      model: tu.model,
      input_tokens: tu.input_tokens,
      output_tokens: tu.output_tokens,
      cache_read: tu.cache_read,
      cache_write: tu.cache_write,
      timestamp: tu.timestamp,
    });
  }

  // 3. Push tool calls in batches
  for (const tc of session.tool_calls) {
    await post(config, '/tool-calls', {
      session_id: session.id,
      tool_name: tc.tool_name,
      success: tc.success,
      duration_ms: tc.duration_ms,
      timestamp: tc.timestamp,
      args: tc.args,
      error: tc.error,
    });
  }

  // 4. End session if it has an end time
  if (session.ended_at) {
    await patch(config, `/sessions/${session.id}`, {
      status: 'completed',
      ended_at: session.ended_at,
    });
  }
}
