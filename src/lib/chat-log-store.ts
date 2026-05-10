import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadConfig } from './config.js';

function getTodayFile(dir: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return join(dir, `${today}.md`);
}

/** Read today's chat log file and return it as a context string. Returns empty if disabled. */
export async function buildDayChatContext(): Promise<string> {
  const config = await loadConfig();
  const cl = config.chatLog;

  if (!cl?.enabled || !cl?.dir) return '';

  try {
    const content = await readFile(getTodayFile(cl.dir), 'utf-8');
    const trimmed = content.trim();
    if (!trimmed) return '';
    const header = cl.sectionHeader ?? "## Today's conversation";
    return `${header}\n\n${trimmed}`;
  } catch {
    return '';
  }
}

/** Append a user/assistant exchange to today's daily chat log file. */
export async function addChatLog(userPrompt: string, assistantResponse: string): Promise<void> {
  const config = await loadConfig();
  const cl = config.chatLog;

  if (!cl?.enabled || !cl?.dir) return;

  const userMsg = userPrompt.trim();
  const assistantMsg = assistantResponse.trim();

  if (!userMsg || !assistantMsg) return;

  const userPrefix = cl.userPrefix ?? 'User:';
  const assistantPrefix = cl.assistantPrefix ?? 'Assistant:';

  await mkdir(cl.dir, { recursive: true });
  const entry = `${userPrefix} ${userMsg}\n${assistantPrefix} ${assistantMsg}\n\n`;
  await appendFile(getTodayFile(cl.dir), entry, 'utf-8');
}
