import { Command } from 'commander';
import pc from 'picocolors';

import type { TargetName } from '../core/config.js';
import { loadConfig, saveConfig } from '../core/config.js';

import { resolveTarget } from './targets.js';

export function createUninstallCommand(): Command {
  return new Command('uninstall')
    .description('Remove hooks for a target CLI')
    .argument('<target>', 'Target CLI: claude, gemini, opencode')
    .action(async (targetName: string) => {
      try {
        await runUninstall(targetName);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runUninstall(targetName: string) {
  const target = resolveTarget(targetName as TargetName);
  if (!target) {
    console.error(pc.red(`Unknown target: ${targetName}. Use: claude, gemini, opencode`));
    process.exit(1);
  }

  const installed = await target.isInstalled();
  if (!installed) {
    console.log(pc.dim(`dcontext hooks not installed for ${target.name}`));
    return;
  }

  await target.uninstall();

  const config = await loadConfig();
  config.targets[target.name as TargetName] = { installed: false };
  await saveConfig(config);

  console.log(pc.green(`✓ Hooks removed for ${target.name}`));
  if (target.name === 'claude') {
    console.log(
      pc.dim(`  Run ${pc.cyan('dbrain connect claude')} to restore original dbrain instructions`),
    );
  }
}
