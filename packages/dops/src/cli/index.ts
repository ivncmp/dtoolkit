#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
  version: string;
};

const program = new Command();

const banner = `\
     _
    | |
  __| | ___  _ __  ___
 / _\` |/ _ \\| '_ \\/ __|
| (_| | (_) | |_) \\__ \\
 \\__,_|\\___/| .__/|___/
            | |
            |_|`;

const description = `${pc.green(banner)}\n\n${pc.green('Agent observability for the dtoolkit suite')}\n${pc.dim('Part of the dtoolkit suite')}`;

program.name('dops').description(description).version(pkg.version);

program
  .command('init')
  .description('Initialize dops (config + database)')
  .argument('[path]', 'Data path')
  .option('--non-interactive', 'Non-interactive mode (for Docker/CI)')
  .action(async (path: string | undefined, opts: { nonInteractive?: boolean }) => {
    const { init } = await import('./init.js');
    await init(path, { nonInteractive: opts.nonInteractive });
  });

program
  .command('start')
  .description('Start the dops server')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { start } = await import('./start.js');
    await start(path);
  });

program
  .command('status')
  .description('Check dops status')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { status } = await import('./status.js');
    await status(path);
  });

program
  .command('ingest')
  .description('Scan local CLI transcripts and push telemetry to dops server')
  .requiredOption('--url <url>', 'dops server URL (e.g. http://localhost:7883)')
  .requiredOption('--token <token>', 'dops access token')
  .option('--days <n>', 'Scan last N days', '30')
  .option('--dry-run', 'Scan and report without pushing data')
  .option('--source <names...>', 'Sources to scan (claude, codex, gemini, opencode)')
  .action(
    async (opts: {
      url: string;
      token: string;
      days: string;
      dryRun?: boolean;
      source?: string[];
    }) => {
      const { ingest } = await import('./ingest.js');
      await ingest({
        url: opts.url,
        token: opts.token,
        days: parseInt(opts.days, 10),
        dryRun: opts.dryRun,
        sources: opts.source,
      });
    },
  );

program
  .command('stats')
  .description('Show agent usage statistics')
  .requiredOption('--url <url>', 'dops server URL')
  .requiredOption('--token <token>', 'dops access token')
  .option('--days <n>', 'Last N days', '30')
  .option('--source <name>', 'Filter by source (claude, codex, gemini, opencode)')
  .action(async (opts: { url: string; token: string; days: string; source?: string }) => {
    const { stats } = await import('./stats.js');
    await stats({
      url: opts.url,
      token: opts.token,
      days: parseInt(opts.days, 10),
      source: opts.source,
    });
  });

program
  .command('costs')
  .description('Show estimated costs by model')
  .requiredOption('--url <url>', 'dops server URL')
  .requiredOption('--token <token>', 'dops access token')
  .option('--days <n>', 'Last N days', '30')
  .action(async (opts: { url: string; token: string; days: string }) => {
    const { costs } = await import('./costs.js');
    await costs({
      url: opts.url,
      token: opts.token,
      days: parseInt(opts.days, 10),
    });
  });

program.parse();
