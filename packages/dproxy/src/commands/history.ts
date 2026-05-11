import { Command } from 'commander';
import pc from 'picocolors';

import { listHistory, getHistoryEntry, searchHistory, clearHistory } from '../lib/history-store.js';
import type { HistoryEntry } from '../lib/types.js';

function printEntryList(entries: HistoryEntry[], showCost = true): void {
  if (entries.length === 0) {
    console.log(pc.dim('No history entries.'));
    return;
  }
  for (const e of entries) {
    const date = new Date(e.timestamp).toLocaleString();
    const prompt = e.prompt.length > 60 ? e.prompt.slice(0, 60) + '\u2026' : e.prompt;
    const cost = showCost && e.costUsd ? pc.dim(`$${e.costUsd.toFixed(4)}`) : '';
    console.log(`${pc.dim(e.id.slice(0, 8))}  ${pc.blue(date)}  ${prompt}  ${cost}`);
  }
}

/** Create the `dproxy history` Commander command with list/show/search/clear subcommands. */
export function createHistoryCommand(): Command {
  const cmd = new Command('history').description('Manage query history');

  cmd
    .command('list')
    .description('List recent queries')
    .option('-l, --limit <n>', 'Number of entries', parseInt, 20)
    .action(async (opts) => {
      const entries = await listHistory(opts.limit);
      printEntryList(entries);
    });

  cmd
    .command('show <id>')
    .description('Show a specific history entry')
    .action(async (id: string) => {
      const entry = await getHistoryEntry(id);
      if (!entry) {
        console.error(pc.red(`Entry not found: ${id}`));
        process.exit(1);
      }
      console.log(pc.bold('Prompt:'));
      console.log(entry.prompt);
      console.log();
      console.log(pc.bold('Response:'));
      console.log(entry.result);
      console.log();
      console.log(
        pc.dim(
          `Session: ${entry.sessionId || 'n/a'} | Cost: $${entry.costUsd.toFixed(4)} | Duration: ${entry.durationMs}ms | ${entry.timestamp}`,
        ),
      );
    });

  cmd
    .command('search <query>')
    .description('Search history')
    .action(async (query: string) => {
      const entries = await searchHistory(query);
      printEntryList(entries, false);
    });

  cmd
    .command('clear')
    .description('Clear history')
    .option('--before <date>', 'Clear entries before this date')
    .action(async (opts) => {
      const removed = await clearHistory(opts.before);
      console.log(pc.green(`Cleared ${removed} entries.`));
    });

  // Default: list
  cmd.action(async () => {
    const entries = await listHistory(20);
    printEntryList(entries);
  });

  return cmd;
}
