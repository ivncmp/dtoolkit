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

program
  .command('sync')
  .description('Sync project docs from source code via dproxy')
  .argument('<project>', 'Project slug')
  .option('--path <path>', 'Data path')
  .action(async (project: string, opts: { path?: string }) => {
    const { sync } = await import('./sync.js');
    await sync(project, opts);
  });

program
  .command('connect')
  .description('Connect a client to a running dwork server')
  .argument('[client]', 'Client: claude, codex, gemini, opencode')
  .argument('[url]', 'dwork URL')
  .option('--token <token>', 'Access token')
  .action(async (client: string | undefined, url: string | undefined, opts: { token?: string }) => {
    const { connect } = await import('./connect.js');
    await connect(client, url, opts.token);
  });

program
  .command('configure')
  .description('Reconfigure dwork (interactive)')
  .argument('[path]', 'Data path')
  .action(async (path: string | undefined) => {
    const { configure } = await import('./configure.js');
    await configure(path);
  });

program
  .command('keys')
  .description('Manage API keys')
  .argument('<action>', 'create | list | revoke')
  .option('--url <url>', 'dwork URL (or DWORK_URL env)')
  .option('--token <token>', 'Admin token (or DWORK_TOKEN env)')
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

program.parse();
