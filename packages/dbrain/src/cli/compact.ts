import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import type { CompactStep } from '../core/compact.js';
import { compact } from '../core/compact.js';
import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import { initLlm } from '../core/llm.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export interface CompactCliOptions {
  path?: string;
  dedup?: boolean;
  tiers?: boolean;
  process?: boolean;
  dryRun?: boolean;
  threshold?: string;
  limit?: string;
}

export async function compactCommand(opts: CompactCliOptions) {
  const dataPath = resolveDataPath(opts.path);
  const config = loadConfig(dataPath);
  const db = createDatabase(config);
  initLlm(config);

  const steps: CompactStep[] = [];
  if (opts.process) steps.push('process');
  if (opts.dedup) steps.push('dedup');
  if (opts.tiers) steps.push('tiers');
  if (steps.length === 0) steps.push('dedup', 'tiers');

  const threshold = opts.threshold ? parseFloat(opts.threshold) : config.compact.threshold;
  const limit = opts.limit ? parseInt(opts.limit, 10) : config.compact.limit;

  console.log(`\n${pc.cyan('dbrain')} compact${opts.dryRun ? pc.dim(' (dry run)') : ''}\n`);
  console.log(`  ${pc.dim('Threshold')}: ${threshold}`);
  console.log(`  ${pc.dim('Batch limit')}: ${limit}`);
  console.log(`  ${pc.dim('Steps')}: ${steps.join(', ')}\n`);

  const result = await compact({
    db,
    tiers: config.tiers,
    threshold,
    limit,
    dryRun: opts.dryRun,
    steps,
    onProgress: (msg) => console.log(`  ${msg}`),
  });

  console.log(`\n${pc.bold('Results')}\n`);
  if (steps.includes('process')) {
    console.log(`  ${pc.green('Conversations')}:  ${result.conversationsProcessed}`);
    console.log(`  ${pc.green('Messages')}:       ${result.messagesProcessed}`);
    console.log(`  ${pc.green('Entities')}:       ${result.entitiesCreated}`);
    console.log(`  ${pc.green('Facts')}:          ${result.factsExtracted}`);
  }
  if (steps.includes('dedup')) {
    console.log(`  ${pc.green('Deduped')}:        ${result.factsDeduped}`);
  }
  if (steps.includes('tiers')) {
    console.log(`  ${pc.green('Tiers updated')}:  ${result.tiersUpdated}`);
  }
  console.log();

  db.close();
}
