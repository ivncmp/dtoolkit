import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { getDataDir, loadConfig, saveConfig } from '../core/config.js';

import {
  connectToDbrain,
  connectToDops,
  connectToDwork,
  mapDworkProjects,
  mapEntity,
  startLocalDbrain,
} from './helpers.js';

export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize dcontext for the current directory')
    .action(async () => {
      try {
        await runInit();
      } catch (err) {
        if ((err as Error).message?.includes('cancelled')) process.exit(0);
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runInit() {
  const config = await loadConfig();
  const cwd = process.cwd();

  if (config.initialized && config.projects[cwd]) {
    console.log(`\n${pc.yellow('⚠')}  This directory is already initialized.\n`);
    console.log(`   dbrain:  ${pc.blue(config.projects[cwd])}`);
    if (config.dworkProjects[cwd]?.length) {
      console.log(`   dwork:   ${pc.blue(config.dworkProjects[cwd].join(', '))}`);
    }
    console.log(`\n   Run ${pc.cyan('dcontext config')} to modify.\n`);
    return;
  }

  p.intro(pc.cyan('dcontext') + ' init');

  // --- dbrain ---
  if (!config.dbrain.url) {
    const mode = await p.select({
      message: 'How do you want to connect to dbrain?',
      options: [
        { value: 'connect', label: 'Connect to existing dbrain', hint: 'I have a dbrain running' },
        { value: 'local', label: 'Start a local dbrain', hint: 'Initialize and start a new brain' },
      ],
    });

    if (p.isCancel(mode)) {
      p.cancel('Init cancelled.');
      process.exit(0);
    }

    const ok = mode === 'local' ? await startLocalDbrain(config) : await connectToDbrain(config);
    if (!ok) {
      p.outro(pc.red('Could not connect to dbrain. Try again.'));
      process.exit(1);
    }
  } else {
    p.log.info(`dbrain: ${pc.green(config.dbrain.url)}`);
  }

  // --- entity mapping ---
  await mapEntity(config);

  // --- dwork ---
  if (!config.dwork?.url) {
    const connect = await p.confirm({
      message: 'Connect to a dwork server? (project management)',
      initialValue: false,
    });
    if (!p.isCancel(connect) && connect) {
      const ok = await connectToDwork(config);
      if (ok) await mapDworkProjects(config);
    }
  } else {
    p.log.info(`dwork: ${pc.green(config.dwork.url)}`);
    await mapDworkProjects(config);
  }

  // --- dops ---
  if (!config.dops?.url) {
    const connect = await p.confirm({
      message: 'Connect to a dops server? (observability)',
      initialValue: false,
    });
    if (!p.isCancel(connect) && connect) {
      await connectToDops(config);
    }
  } else {
    p.log.info(`dops: ${pc.green(config.dops.url)}`);
  }

  // --- save ---
  config.initialized = true;
  await saveConfig(config);

  const lines = [
    `dbrain:  ${pc.green(config.dbrain.url)}`,
    config.dwork ? `dwork:   ${pc.green(config.dwork.url)}` : '',
    config.dops ? `dops:    ${pc.green(config.dops.url)}` : '',
    config.projects[cwd] ? `dbrain:  ${pc.dim(cwd)} → ${pc.green(config.projects[cwd])}` : '',
    `Config:  ${pc.dim(getDataDir() + '/config.json')}`,
  ];
  p.note(lines.filter(Boolean).join('\n'), 'Configuration');

  p.outro(`Next: ${pc.cyan('dcontext install claude')}`);
}

export async function requireInit(): Promise<void> {
  const config = await loadConfig();
  if (!config.initialized) {
    console.error(pc.red('dcontext is not initialized. Run: dcontext init'));
    process.exit(1);
  }
}
