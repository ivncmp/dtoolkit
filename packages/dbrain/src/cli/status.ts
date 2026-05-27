import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

import pc from 'picocolors';

import type { CompactResult } from '../core/compact.js';
import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export async function status(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  if (!existsSync(join(dataPath, 'config.json'))) {
    console.log(`${pc.red('Not initialized.')} Run: dbrain init`);
    return;
  }

  const config = loadConfig(dataPath);
  const dbPath = join(dataPath, 'dbrain.db');
  const dbExists = existsSync(dbPath);
  const dbSize = dbExists ? statSync(dbPath).size : 0;

  let compactLines = '';
  if (config.compact.schedule) {
    compactLines += `\n  ${pc.green('Compact')}:  ${config.compact.schedule}`;
  }

  if (dbExists) {
    try {
      const db = createDatabase(config);
      const row = db
        .prepare("SELECT content FROM documents WHERE key = 'compact_last_run'")
        .get() as { content: string } | undefined;
      db.close();

      if (row) {
        const last = JSON.parse(row.content) as CompactResult & { at: string };
        const date = new Date(last.at).toLocaleString();
        compactLines += `\n  ${pc.green('Last run')}: ${date} — ${last.factsDeduped} deduped, ${last.tiersUpdated} tiers updated`;
      }
    } catch {
      // db read failed, skip compact info
    }
  }

  const llmLine = config.llm.dproxyUrl
    ? `\n  ${pc.green('LLM')}:      ${config.llm.dproxyUrl} (dproxy)`
    : `\n  ${pc.green('LLM')}:      ${pc.dim('not configured')}`;

  console.log(`
${pc.cyan('dbrain')} status

  ${pc.green('Data')}:     ${config.dataPath}
  ${pc.green('Port')}:     ${config.port}
  ${pc.green('Host')}:     ${config.host}
  ${pc.green('Database')}: ${dbExists ? `${(dbSize / 1024).toFixed(1)} KB` : 'not created'}${compactLines}${llmLine}
`);
}
