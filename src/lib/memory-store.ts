import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { getDataDir, ensureDataDir } from './config.js';

function getMemoryDir(): string {
  return join(getDataDir(), 'memory');
}

function slugify(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function keyToFile(key: string): string {
  return join(getMemoryDir(), `${slugify(key)}.md`);
}

/** Save a named memory snippet to disk as a markdown file. */
export async function setMemory(key: string, value: string): Promise<void> {
  await ensureDataDir();
  await writeFile(keyToFile(key), value, 'utf-8');
}

/** Read a memory snippet by key. Returns null if not found. */
export async function getMemory(key: string): Promise<string | null> {
  try {
    return await readFile(keyToFile(key), 'utf-8');
  } catch {
    return null;
  }
}

/** List all stored memory keys (derived from .md filenames). */
export async function listMemoryKeys(): Promise<string[]> {
  try {
    const files = await readdir(getMemoryDir());
    return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

/** Search memory snippets by key name or content (case-insensitive substring match). */
export async function searchMemory(query: string): Promise<{ key: string; content: string }[]> {
  const keys = await listMemoryKeys();
  const lower = query.toLowerCase();
  const results: { key: string; content: string }[] = [];

  for (const key of keys) {
    const content = await getMemory(key);
    if (content && (key.toLowerCase().includes(lower) || content.toLowerCase().includes(lower))) {
      results.push({ key, content });
    }
  }
  return results;
}

/** Delete a memory snippet by key. Returns true if it existed. */
export async function deleteMemory(key: string): Promise<boolean> {
  try {
    await unlink(keyToFile(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * Assemble memory snippets into a single context string for system prompt injection.
 * If `keys` is provided, only those snippets are included; otherwise all are used.
 * Output is truncated to `maxChars`.
 */
export async function buildMemoryContext(keys?: string[], maxChars = 4000): Promise<string> {
  const allKeys = keys?.length ? keys : await listMemoryKeys();
  if (allKeys.length === 0) return '';

  const parts: string[] = [];
  let totalChars = 0;

  for (const key of allKeys) {
    const content = await getMemory(key);
    if (!content) continue;

    const section = `## ${key}\n${content}`;
    if (totalChars + section.length > maxChars) break;

    parts.push(section);
    totalChars += section.length;
  }

  if (parts.length === 0) return '';

  return `You have the following memory/context notes:\n\n${parts.join('\n\n')}`;
}
