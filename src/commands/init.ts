import { createInterface } from 'node:readline';

import chalk from 'chalk';
import { Command } from 'commander';

import { loadConfig, saveConfig, getDataDir } from '../lib/config.js';

/**
 * Prompt the user for input via readline.
 * Returns the trimmed answer, or the default if the user presses Enter.
 */
function ask(rl: ReturnType<typeof createInterface>, question: string, def = ''): Promise<string> {
  const suffix = def ? chalk.dim(` (${def})`) : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || def);
    });
  });
}

/**
 * Prompt for a yes/no answer. Returns true for 'y'/'yes', false otherwise.
 */
function askBool(
  rl: ReturnType<typeof createInterface>,
  question: string,
  def = false,
): Promise<boolean> {
  const hint = def ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${question} ${chalk.dim(`[${hint}]`)}: `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (!a) return resolve(def);
      resolve(a === 'y' || a === 'yes');
    });
  });
}

/** Creates the `cw init` Commander command. */
export function createInitCommand(): Command {
  return new Command('init')
    .description('Interactive setup wizard — required before first use')
    .action(async () => {
      try {
        await runInit();
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}

/** Runs the interactive init wizard and saves the resulting configuration. */
async function runInit(): Promise<void> {
  const config = await loadConfig();

  console.log();
  console.log(chalk.bold.blue('cw — Claude Wrapper Setup'));
  console.log(chalk.dim('Configure your environment. Press Enter to accept defaults.\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Claude binary
    config.claude.bin = await ask(rl, 'Claude binary path', config.claude.bin || 'claude');

    // Default model
    const model = await ask(
      rl,
      'Default model (leave empty for CLI default)',
      config.defaults.model || '',
    );
    config.defaults.model = model || undefined;

    // Skip permissions
    config.claude.skipPermissions = await askBool(
      rl,
      'Skip Claude permission prompts (--dangerously-skip-permissions)?',
      config.claude.skipPermissions,
    );

    console.log();
    console.log(chalk.bold('Optional integrations'));
    console.log(chalk.dim('These inject extra context into every prompt.\n'));

    // Workspace
    const enableWorkspace = await askBool(
      rl,
      'Enable workspace context (IDENTITY.md, SOUL.md, USER.md, MEMORY.md)?',
      config.workspace.enabled,
    );
    config.workspace.enabled = enableWorkspace;
    if (enableWorkspace) {
      config.workspace.dir = await ask(rl, '  Workspace directory', config.workspace.dir || '');
    }

    // Chat log
    const enableChatLog = await askBool(rl, 'Enable daily chat log?', config.chatLog.enabled);
    config.chatLog.enabled = enableChatLog;
    if (enableChatLog) {
      config.chatLog.dir = await ask(rl, '  Chat log directory', config.chatLog.dir || '');
    }

    // Life/PARA
    const lifeDir = await ask(
      rl,
      'PARA knowledge base directory (leave empty to skip)',
      config.life.dir || '',
    );
    config.life.dir = lifeDir;

    // Debug
    config.debug = await askBool(rl, 'Enable debug logging?', config.debug);

    // Mark as initialized
    config.initialized = true;

    await saveConfig(config);

    console.log();
    console.log(chalk.green('Configuration saved to ') + chalk.dim(getDataDir() + '/config.json'));
    console.log(chalk.green("You're ready to go! Try: ") + chalk.bold('cw "hello"'));
    console.log();
  } finally {
    rl.close();
  }
}

/**
 * Checks whether `cw init` has been run.
 * Call this before executing any command that requires configuration.
 * Prints a helpful message and exits if not initialized.
 */
export async function requireInit(): Promise<void> {
  const config = await loadConfig();
  if (config.initialized) return;

  console.error(
    chalk.yellow('cw is not configured yet. Run ') +
      chalk.bold('cw init') +
      chalk.yellow(' to set up your environment.'),
  );
  process.exit(1);
}
