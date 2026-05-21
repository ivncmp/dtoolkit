import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import { compact } from '../core/compact.js';
import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export interface CompactCliOptions {
  path?: string;
  dedup?: boolean;
  tiers?: boolean;
  dryRun?: boolean;
  threshold?: string;
  limit?: string;
}

export async function compactCommand(opts: CompactCliOptions) {
  const dataPath = resolveDataPath(opts.path);
  const config = loadConfig(dataPath);
  const db = createDatabase(config);

  const steps: ('dedup' | 'tiers')[] = [];
  if (opts.dedup) steps.push('dedup');
  if (opts.tiers) steps.push('tiers');
  if (steps.length === 0) steps.push('dedup', 'tiers');

  const threshold = opts.threshold ? parseFloat(opts.threshold) : config.compact.threshold;
  const limit = opts.limit ? parseInt(opts.limit, 10) : config.compact.limit;

  console.log(`\n${pc.cyan('dbrain')} compact${opts.dryRun ? pc.dim(' (dry run)') : ''}\n`);
  console.log(`  ${pc.dim('Threshold')}: ${threshold}`);
  console.log(`  ${pc.dim('Batch limit')}: ${limit}`);
  console.log(`  ${pc.dim('Steps')}: ${steps.join(', ')}\n`);

  const result = compact({
    db,
    tiers: config.tiers,
    threshold,
    limit,
    dryRun: opts.dryRun,
    steps,
    onProgress: (msg) => console.log(`  ${pc.dim('>')} ${msg}`),
  });

  console.log(`\n${pc.green('Results')}:`);
  console.log(`  ${pc.green('Duplicates archived')}: ${result.factsDeduped}`);
  console.log(`  ${pc.green('Facts compacted')}:     ${result.factsProcessed}`);
  console.log(`  ${pc.green('Tiers updated')}:       ${result.tiersUpdated}\n`);

  db.close();
}
