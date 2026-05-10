import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getDataDir, atomicWriteFile } from './config.js';

interface SessionState {
  [sessionId: string]: {
    totalTokens: number;
    updatedAt: string;
  };
}

function getStateFile(): string {
  return join(getDataDir(), 'session-state.json');
}

async function loadState(): Promise<SessionState> {
  try {
    const raw = await readFile(getStateFile(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveState(state: SessionState): Promise<void> {
  await atomicWriteFile(getStateFile(), JSON.stringify(state, null, 2));
}

/** Get the total token count for a given session. Returns 0 if session is unknown. */
export async function getSessionTokens(sessionId: string): Promise<number> {
  const state = await loadState();
  return state[sessionId]?.totalTokens ?? 0;
}

/** Update token count for a session and prune sessions older than 7 days. */
export async function updateSessionTokens(sessionId: string, totalTokens: number): Promise<void> {
  const state = await loadState();
  state[sessionId] = { totalTokens, updatedAt: new Date().toISOString() };

  // Prune sessions older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const pruned = Object.fromEntries(
    Object.entries(state).filter(([, s]) => new Date(s.updatedAt).getTime() >= cutoff),
  ) as SessionState;

  await saveState(pruned);
}
