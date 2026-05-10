import chalk from 'chalk';
import { Command } from 'commander';

import {
  setMemory,
  getMemory,
  listMemoryKeys,
  searchMemory,
  deleteMemory,
} from '../lib/memory-store.js';

function printKeyList(keys: string[]): void {
  if (keys.length === 0) {
    console.log(chalk.dim('No memory entries.'));
    return;
  }
  for (const key of keys) {
    console.log(chalk.blue(key));
  }
}

/** Create the `cw memory` Commander command with set/get/list/search/delete subcommands. */
export function createMemoryCommand(): Command {
  const cmd = new Command('memory').description('Manage persistent memory');

  cmd
    .command('set <key> <value...>')
    .description('Set a memory entry')
    .action(async (key: string, valueParts: string[]) => {
      const value = valueParts.join(' ');
      await setMemory(key, value);
      console.log(chalk.green(`Memory "${key}" saved.`));
    });

  cmd
    .command('get <key>')
    .description('Get a memory entry')
    .action(async (key: string) => {
      const value = await getMemory(key);
      if (value === null) {
        console.error(chalk.red(`Memory "${key}" not found.`));
        process.exit(1);
      }
      console.log(value);
    });

  cmd
    .command('list')
    .description('List all memory keys')
    .action(async () => {
      const keys = await listMemoryKeys();
      printKeyList(keys);
    });

  cmd
    .command('search <query>')
    .description('Search memory entries')
    .action(async (query: string) => {
      const results = await searchMemory(query);
      if (results.length === 0) {
        console.log(chalk.dim('No matches.'));
        return;
      }
      for (const { key, content } of results) {
        const preview = content.length > 80 ? content.slice(0, 80) + '\u2026' : content;
        console.log(`${chalk.blue(key)}: ${preview}`);
      }
    });

  cmd
    .command('delete <key>')
    .description('Delete a memory entry')
    .action(async (key: string) => {
      const deleted = await deleteMemory(key);
      if (deleted) {
        console.log(chalk.green(`Memory "${key}" deleted.`));
      } else {
        console.error(chalk.red(`Memory "${key}" not found.`));
      }
    });

  // Default: list
  cmd.action(async () => {
    const keys = await listMemoryKeys();
    printKeyList(keys);
  });

  return cmd;
}
