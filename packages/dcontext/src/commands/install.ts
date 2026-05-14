import { Command } from 'commander';
import pc from 'picocolors';

import type { TargetName } from '../core/config.js';
import { loadConfig, saveConfig } from '../core/config.js';

import { resolveTarget } from './targets.js';

export function createInstallCommand(): Command {
  return new Command('install')
    .description('Install hooks for a target CLI')
    .argument('<target>', 'Target CLI: claude, gemini, opencode')
    .action(async (targetName: string) => {
      try {
        await runInstall(targetName);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runInstall(targetName: string) {
  const target = resolveTarget(targetName as TargetName);
  if (!target) {
    console.error(pc.red(`Unknown target: ${targetName}. Use: claude, gemini, opencode`));
    process.exit(1);
  }

  const already = await target.isInstalled();
  if (already) {
    console.log(pc.dim(`dcontext hooks already installed for ${target.name}`));
    return;
  }

  await target.install();

  const config = await loadConfig();
  config.targets[target.name as TargetName] = {
    installed: true,
    installedAt: new Date().toISOString(),
  };
  await saveConfig(config);

  console.log(pc.green(`✓ Hooks installed for ${target.name}`));
  if (target.name === 'claude') {
    console.log(pc.dim(`  ~/.claude/CLAUDE.md updated with dcontext instructions`));
  }
}
