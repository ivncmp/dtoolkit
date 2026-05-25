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
     _                  _
    | |                | |
  __| |_      _____  __| | __
 / _\` \\ \\ /\\ / / _ \\| '__| |/ /
| (_| |\\ V  V / (_) | |  |   <
 \\__,_| \\_/\\_/ \\___/|_|  |_|\\_\\`;

const description = `${pc.green(banner)}\n\n${pc.green('AI-native, MD-driven project manager')}\n${pc.dim('Part of the dtoolkit suite')}`;

program.name('dwork').description(description).version(pkg.version);

program
  .command('init')
  .description('Initialize dwork (config, database, optional first project)')
  .argument('[path]', 'Data path')
  .option('--non-interactive', 'Non-interactive mode (for Docker/CI)')
  .action(async (path: string | undefined, opts: { nonInteractive?: boolean }) => {
    const { init } = await import('./init.js');
    await init(path, { nonInteractive: opts.nonInteractive });
  });

program
  .command('start')
  .description('Start the dwork server')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { start } = await import('./start.js');
    await start(path);
  });

program
  .command('status')
  .description('Check dwork status')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { status } = await import('./status.js');
    await status(path);
  });

program.parse();
