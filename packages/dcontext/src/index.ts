declare const __VERSION__: string;

import { Command } from 'commander';
import pc from 'picocolors';

import { createExploreCommand } from './commands/explore.js';
import { createHookCommand } from './commands/hook.js';
import { createInitCommand, requireInit } from './commands/init.js';
import { createInstallCommand } from './commands/install.js';
import { createStatusCommand } from './commands/status.js';
import { createUninstallCommand } from './commands/uninstall.js';

const program = new Command();

const banner = `\
     _                 _            _
    | |               | |          | |
  __| | ___ ___  _ __ | |_ _____  _| |_
 / _\` |/ __/ _ \\| '_ \\| __/ _ \\ \\/ / __|
| (_| | (_| (_) | | | | ||  __/>  <| |_
 \\__,_|\\___\\___/|_| |_|\\__\\___/_/\\_\\\\__|`;

const description = `${pc.green(banner)}\n\n${pc.green('dbrain hooks for AI coding CLIs')}\n${pc.dim('Part of the dtoolkit suite')}`;

program.name('dcontext').description(description).version(__VERSION__);

const guarded = (cmd: Command): Command => {
  cmd.hook('preAction', async () => {
    await requireInit();
  });
  return cmd;
};

program.addCommand(createInitCommand());
program.addCommand(guarded(createInstallCommand()));
program.addCommand(guarded(createUninstallCommand()));
program.addCommand(guarded(createStatusCommand()));
program.addCommand(guarded(createExploreCommand()));
program.addCommand(createHookCommand());

program.parse();
