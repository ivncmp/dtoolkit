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

program.name('dbrain').description(description).version(pkg.version);

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

program
  .command('keys')
  .description('Manage API keys (shared brains only)')
  .argument('<action>', 'create | list | revoke')
  .option('--url <url>', 'Brain URL (or DBRAIN_URL env)')
  .option('--token <token>', 'Admin token (or DBRAIN_TOKEN env)')
  .option('--user-id <userId>', 'User ID (create)')
  .option('--user-name <userName>', 'User display name (create)')
  .option('--permissions <perms>', 'read | write | read+write (create, default: read+write)')
  .option('--key-id <keyId>', 'Key ID (revoke)')
  .action(
    async (
      action: string,
      opts: {
        url?: string;
        token?: string;
        userId?: string;
        userName?: string;
        permissions?: string;
        keyId?: string;
      },
    ) => {
      const { keys } = await import('./keys.js');
      await keys(action, opts);
    },
  );

program
  .command('compact')
  .description('Compact the brain (deduplicate facts, recalculate tiers)')
  .option('--path <path>', 'Data path')
  .option('--dedup', 'Deduplicate cold facts only')
  .option('--tiers', 'Recalculate tiers only')
  .option('--dry-run', 'Preview without writing')
  .option('--threshold <n>', 'Similarity threshold (0-1, default 0.85)')
  .option('--limit <n>', 'Max facts per batch (default 1000)')
  .action(async (opts: Record<string, string | boolean | undefined>) => {
    const { compactCommand } = await import('./compact.js');
    await compactCommand(opts);
  });

program
  .command('configure')
  .description('Reconfigure the brain (interactive)')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { configure } = await import('./configure.js');
    await configure(path);
  });

program
  .command('link')
  .description('Link to a shared brain')
  .argument('<url>', 'Shared brain URL')
  .option('--token <token>', 'Access token for the shared brain')
  .option('--name <name>', 'Connection name (defaults to remote brain name)')
  .option('--path <path>', 'Local brain data path')
  .action(async (url: string, opts: { token?: string; name?: string; path?: string }) => {
    const { link } = await import('./link.js');
    await link(url, opts);
  });

program
  .command('unlink')
  .description('Remove a connection to a shared brain')
  .argument('<name>', 'Connection name')
  .option('--path <path>', 'Local brain data path')
  .action(async (name: string, opts: { path?: string }) => {
    const { unlink } = await import('./link.js');
    await unlink(name, opts);
  });

program
  .command('connections')
  .description('List connected brains with health status')
  .option('--path <path>', 'Local brain data path')
  .action(async (opts: { path?: string }) => {
    const { connections } = await import('./link.js');
    await connections(opts);
  });

program.parse();
