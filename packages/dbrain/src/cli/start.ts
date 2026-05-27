import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { Cron } from 'croner';
import pc from 'picocolors';

import { compact } from '../core/compact.js';
import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import { initLlm } from '../core/llm.js';
import { startDashboard } from '../dashboard/server.js';
import { createServer } from '../server/index.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export async function start(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);
  const config = { ...loadConfig(dataPath), dataPath };
  const db = createDatabase(config);
  initLlm(config);
  const app = createServer(config, db);

  const address = await app.listen({ port: config.port, host: config.host });

  const dashboardPort = config.port + 1;
  startDashboard(dashboardPort);

  const identity = db.prepare("SELECT content FROM documents WHERE key = 'identity'").get() as
    | { content: string }
    | undefined;
  const name = identity?.content?.match(/\*\*Name:\*\* (.+)/)?.[1] || 'dbrain';

  let compactLine = '';
  if (config.compact.schedule) {
    const job = new Cron(config.compact.schedule, () => {
      console.log(`\n${pc.dim('[compact]')} Starting scheduled compaction...`);
      try {
        const result = compact({
          db,
          tiers: config.tiers,
          threshold: config.compact.threshold,
          limit: config.compact.limit,
          steps: ['dedup', 'tiers'],
          onProgress: (msg) => console.log(`  ${pc.dim('[compact]')} ${msg}`),
        });

        const now = new Date().toISOString();
        const payload = JSON.stringify({ ...result, at: now });
        db.prepare(
          `INSERT INTO documents (key, title, content, updated_at)
           VALUES ('compact_last_run', 'Last Compact Run', ?, ?)
           ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
        ).run(payload, now);

        console.log(
          `${pc.dim('[compact]')} Done — ` +
            `${result.factsDeduped} deduped, ${result.tiersUpdated} tiers updated`,
        );
      } catch (err) {
        console.error(`${pc.red('[compact]')} Error: ${(err as Error).message}`);
      }
    });

    const next = job.nextRun();
    compactLine = `\n  ${pc.green('Compact')}:   ${config.compact.schedule} (next: ${next?.toLocaleString() ?? 'unknown'})`;
  }

  console.log(`
${pc.cyan(name)} is awake

  ${pc.green('API')}:       ${address}
  ${pc.green('MCP')}:       ${address}/mcp
  ${pc.green('Dashboard')}: http://localhost:${dashboardPort}
  ${pc.green('Brain')}:     ${config.dataPath}
  ${pc.green('Token')}:     ${config.token.slice(0, 16)}...${compactLine}
  ${pc.green('LLM')}:       ${config.llm.dproxyUrl ? `${config.llm.dproxyUrl} (dproxy)` : pc.dim('not configured')}
`);
}
