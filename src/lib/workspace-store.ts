import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadConfig } from './config.js';

// Default bootstrap files — can be overridden via config.workspace.files
const DEFAULT_BOOTSTRAP_FILES = [
  { file: 'IDENTITY.md', header: '## Identity' },
  { file: 'SOUL.md', header: '## Soul / Personality' },
  { file: 'USER.md', header: '## User Profile' },
  { file: 'MEMORY.md', header: '## System Memory' },
];

/**
 * Read workspace bootstrap files (IDENTITY.md, SOUL.md, etc.) from the configured directory
 * and assemble them into a context string. Returns empty if workspace is disabled.
 */
export async function buildWorkspaceContext(maxChars?: number): Promise<string> {
  const config = await loadConfig();
  const ws = config.workspace;

  if (!ws?.enabled || !ws?.dir) return '';

  const dir = ws.dir;
  const files = ws.files?.length ? ws.files : DEFAULT_BOOTSTRAP_FILES;
  const limit = maxChars ?? ws.maxInjectionChars ?? 16000;

  const parts: string[] = [];
  let totalChars = 0;

  for (const { file, header } of files) {
    try {
      const content = (await readFile(join(dir, file), 'utf-8')).trim();
      if (!content) continue;

      const section = `${header}\n\n${content}`;
      if (totalChars + section.length > limit) break;

      parts.push(section);
      totalChars += section.length;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT' && config.debug) {
        console.error(`[cw debug] workspace file ${file} error:`, err);
      }
    }
  }

  if (parts.length === 0) return '';
  return parts.join('\n\n---\n\n');
}
