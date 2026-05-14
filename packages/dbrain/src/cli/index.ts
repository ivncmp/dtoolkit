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
     _ _               _
    | | |             (_)
  __| | |__  _ __ __ _ _ _ __
 / _\` | '_ \\| '__/ _\` | | '_ \\
| (_| | |_) | | | (_| | | | | |
 \\__,_|_.__/|_|  \\__,_|_|_| |_|`;

const description = `${pc.green(banner)}\n\n${pc.green('Your distributed mind. Wherever you go, I remember.')}\n${pc.dim('Part of the dtoolkit suite')}`;

program
  .name('dbrain')
  .description(description)
  .version(pkg.version);

program
  .command('init')
  .description('Initialize a new brain (server)')
  .argument('[path]', 'Data path')
  .option('--non-interactive', 'Non-interactive mode (for Docker/CI)')
  .action(async (path: string | undefined, opts: { nonInteractive?: boolean }) => {
    const { init } = await import('./init.js');
    await init(path, { nonInteractive: opts.nonInteractive });
  });

program
  .command('start')
  .description('Wake up')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { start } = await import('./start.js');
    await start(path);
  });

program
  .command('connect')
  .description('Connect a client to a brain')
  .argument('<client>', 'Client to configure (claude, codex, gemini, opencode)')
  .argument('[url]', 'Brain URL')
  .option('--token <token>', 'Access token')
  .action(async (client: string, url: string | undefined, opts: { token?: string }) => {
    const { connect } = await import('./connect.js');
    await connect(client, url, opts.token);
  });

program
  .command('status')
  .description('Check brain status')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { status } = await import('./status.js');
    await status(path);
  });

program.parse();
