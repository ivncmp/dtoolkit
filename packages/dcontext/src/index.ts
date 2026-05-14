declare const __VERSION__: string;

import { Command } from 'commander';

import { createExploreCommand } from './commands/explore.js';
import { createHookCommand } from './commands/hook.js';
import { createInitCommand, requireInit } from './commands/init.js';
import { createInstallCommand } from './commands/install.js';
import { createStatusCommand } from './commands/status.js';
import { createUninstallCommand } from './commands/uninstall.js';

const program = new Command();

program
  .name('dcontext')
  .description('dbrain hooks for AI coding CLIs')
  .version(__VERSION__);

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
