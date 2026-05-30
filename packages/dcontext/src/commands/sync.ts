import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';

import * as p from '@clack/prompts';
import type { CodeGraph as CodeGraphInstance } from '@dtoolkit/codegraph-sdk';
import { DWorkClient } from '@dtoolkit/sdk';
import { Command } from 'commander';
import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

const require = createRequire(import.meta.url);
const { CodeGraph, getDatabasePath, isInitialized } = require('@dtoolkit/codegraph-sdk') as {
  CodeGraph: {
    init(path: string, opts?: { index?: boolean }): Promise<CodeGraphInstance>;
    open(path: string): Promise<CodeGraphInstance>;
    openSync(path: string): CodeGraphInstance;
    isInitialized(path: string): boolean;
  };
  getDatabasePath: (projectRoot: string) => string;
  isInitialized: (path: string) => boolean;
};

function deriveGraphName(cwd: string): string {
  try {
    const { execSync } = require('node:child_process');
    const remote = (execSync('git remote get-url origin', { cwd, encoding: 'utf-8' }) as string).trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match?.[1]) return match[1];
  } catch {
    // not a git repo or no remote
  }
  return basename(cwd);
}

export function createSyncCommand(): Command {
  return new Command('sync')
    .description('Index codebase and upload graph to dwork')
    .option('--name <name>', 'Graph name (default: derived from git remote or directory name)')
    .action(async (opts: { name?: string }) => {
      try {
        await runSync(opts);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runSync(opts: { name?: string }) {
  const config = await loadConfig();

  if (!config.dwork?.url || !config.dwork?.token) {
    console.error(pc.red('dwork not configured. Run dcontext init and set up dwork connection.'));
    process.exit(1);
  }

  const cwd = resolve(process.cwd());
  const graphName = opts.name || deriveGraphName(cwd);

  p.intro(`${pc.cyan('dcontext sync')} ${pc.dim('→')} ${pc.blue(graphName)}`);

  const s = p.spinner();

  // --- Index ---
  let cg: CodeGraphInstance;
  if (isInitialized(cwd)) {
    s.start('Syncing existing index');
    cg = await CodeGraph.open(cwd);
    const result = await cg.sync({
      onProgress: (progress) => {
        s.message(`${progress.phase} ${progress.current}/${progress.total}`);
      },
    });
    s.stop(
      `Synced — ${result.filesAdded} added, ${result.filesModified} updated, ${result.filesRemoved} removed`,
    );
  } else {
    s.start('Indexing codebase (first time)');
    cg = await CodeGraph.init(cwd, { index: false });
    await cg.indexAll({
      onProgress: (progress) => {
        s.message(`${progress.phase} ${progress.current}/${progress.total}`);
      },
    });
    const stats = cg.getStats();
    s.stop(`Indexed — ${stats.nodeCount} symbols, ${stats.edgeCount} edges, ${stats.fileCount} files`);
  }

  // --- Upload ---
  s.start('Uploading graph to dwork');

  const dbPath = getDatabasePath(cwd);
  const dbBuffer = readFileSync(dbPath);

  const dwork = new DWorkClient(config.dwork.url, config.dwork.token);
  const result = await dwork.uploadGraph(graphName, dbBuffer);

  s.stop(
    `Uploaded — ${result.nodeCount} nodes, ${result.edgeCount} edges, ${result.fileCount} files`,
  );

  // --- Link projects ---
  const slugs = config.dworkProjects?.[cwd];
  if (slugs && slugs.length > 0) {
    try {
      await dwork.linkGraphProjects(graphName, slugs);
      p.log.info(`Linked to projects: ${slugs.map((s) => pc.blue(s)).join(', ')}`);
    } catch {
      p.log.warn(`Could not link projects (${slugs.join(', ')}) — they may not exist in dwork yet`);
    }
  }

  cg.close();

  p.outro(pc.green(`Graph ${pc.bold(graphName)} synced to dwork`));
}
