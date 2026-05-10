import { randomUUID } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getDataDir, ensureDataDir, loadConfig, atomicWriteFile } from './config.js';
import type { HistoryEntry } from './types.js';

function getHistoryPath(): string {
  return join(getDataDir(), 'history.jsonl');
}

/** Append a new entry to the JSONL history file. Prunes oldest entries if maxEntries is exceeded. */
export async function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'>,
): Promise<HistoryEntry> {
  await ensureDataDir();
  const full: HistoryEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await appendFile(getHistoryPath(), JSON.stringify(full) + '\n', 'utf-8');

  // Enforce history.maxEntries
  try {
    const config = await loadConfig();
    const maxEntries = config.history.maxEntries;
    if (maxEntries > 0) {
      const all = await readLines();
      if (all.length > maxEntries) {
        const kept = all.slice(-maxEntries);
        await atomicWriteFile(
          getHistoryPath(),
          kept.map((e) => JSON.stringify(e)).join('\n') + '\n',
        );
      }
    }
  } catch (err) {
    // pruning is best-effort — log if debug enabled
    const cfg = await loadConfig();
    if (cfg.debug) console.error('[cw debug] history pruning failed:', err);
  }

  return full;
}

/** Return the most recent `limit` history entries, newest first. */
export async function listHistory(limit = 20): Promise<HistoryEntry[]> {
  const lines = await readLines();
  return lines.slice(-limit).reverse();
}

/** Find a history entry by full or prefix ID. Returns null if not found. */
export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
  const lines = await readLines();
  return lines.find((e) => e.id === id || e.id.startsWith(id)) ?? null;
}

/** Search history entries by prompt or response content (case-insensitive). */
export async function searchHistory(query: string): Promise<HistoryEntry[]> {
  const lines = await readLines();
  const lower = query.toLowerCase();
  return lines
    .filter((e) => e.prompt.toLowerCase().includes(lower) || e.result.toLowerCase().includes(lower))
    .reverse();
}

/** Clear history entries. If `before` is given, only entries older than that date are removed. */
export async function clearHistory(before?: string): Promise<number> {
  const lines = await readLines();
  if (!before) {
    await atomicWriteFile(getHistoryPath(), '');
    return lines.length;
  }
  const cutoff = new Date(before).getTime();
  if (isNaN(cutoff)) throw new Error(`Invalid date: "${before}"`);
  const kept = lines.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  const removed = lines.length - kept.length;
  await atomicWriteFile(
    getHistoryPath(),
    kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''),
  );
  return removed;
}

async function readLines(): Promise<HistoryEntry[]> {
  try {
    const content = await readFile(getHistoryPath(), 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as HistoryEntry];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
