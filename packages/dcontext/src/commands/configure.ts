import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import type { DcontextConfig } from '../core/config.js';
import { getDataDir, loadConfig, saveConfig } from '../core/config.js';

import {
  connectToDbrain,
  connectToDops,
  connectToDwork,
  mapDworkProjects,
  mapEntity,
} from './helpers.js';

export function createConfigureCommand(): Command {
  return new Command('config').description('Modify dcontext configuration').action(async () => {
    try {
      await runConfigure();
    } catch (err) {
      if ((err as Error).message?.includes('cancelled')) process.exit(0);
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });
}

async function runConfigure() {
  const config = await loadConfig();
  const cwd = process.cwd();

  p.intro(pc.cyan('dcontext') + ' config');

  const section = await p.select({
    message: 'What do you want to configure?',
    options: [
      { value: 'dbrain', label: 'dbrain', hint: config.dbrain.url || 'not configured' },
      { value: 'dwork', label: 'dwork', hint: config.dwork?.url || 'not connected' },
      { value: 'dops', label: 'dops', hint: config.dops?.url || 'not connected' },
      {
        value: 'briefing',
        label: 'Briefing settings',
        hint: `${config.briefing.maxFacts} facts, ${config.briefing.maxChars} chars`,
      },
      { value: 'all', label: 'Everything' },
    ],
  });

  if (p.isCancel(section)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (section === 'dbrain' || section === 'all') await configureDbrain(config);
  if (section === 'dwork' || section === 'all') await configureDwork(config);
  if (section === 'dops' || section === 'all') await configureDops(config);
  if (section === 'briefing' || section === 'all') await configureBriefing(config);

  await saveConfig(config);

  const lines = [
    `dbrain:    ${config.dbrain.url ? pc.green(config.dbrain.url) : pc.dim('not configured')}`,
    config.dwork ? `dwork:     ${pc.green(config.dwork.url)}` : '',
    config.dops ? `dops:      ${pc.green(config.dops.url)}` : '',
    config.projects[cwd] ? `Entity:    ${pc.dim(cwd)} → ${pc.green(config.projects[cwd])}` : '',
    config.dworkProjects[cwd]?.length
      ? `Projects:  ${pc.green(config.dworkProjects[cwd].join(', '))}`
      : '',
    `Config:    ${pc.dim(getDataDir() + '/config.json')}`,
  ];
  p.note(lines.filter(Boolean).join('\n'), 'Configuration');

  p.outro(pc.green('Config updated.'));
}

// ---------------------------------------------------------------------------
// dbrain — 4 modes: keep / connect / local / remap entity
// ---------------------------------------------------------------------------

async function configureDbrain(config: DcontextConfig) {
  const cwd = process.cwd();
  const currentEntity = config.projects[cwd];

  const options: { value: string; label: string; hint?: string }[] = [];

  if (config.dbrain.url) {
    options.push({ value: 'keep', label: 'Keep current connection', hint: config.dbrain.url });
  }

  options.push(
    { value: 'remap', label: 'Change entity mapping', hint: currentEntity || 'not mapped' },
    { value: 'connect', label: 'Connect to server' },
  );

  if (config.dbrain.url) {
    options.push({ value: 'disconnect', label: 'Disconnect' });
  }

  const mode = await p.select({ message: 'dbrain', options });
  if (p.isCancel(mode)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (mode === 'keep') return;

  if (mode === 'connect') {
    const ok = await connectToDbrain(config);
    if (!ok) p.log.warn('Keeping current dbrain connection.');
  } else if (mode === 'remap') {
    await mapEntity(config);
  } else if (mode === 'disconnect') {
    config.dbrain = { url: '', token: '' };
    config.projects[cwd] = '';
    p.log.info('dbrain disconnected.');
  }
}

// ---------------------------------------------------------------------------
// dwork — 4 modes: keep / connect / remap projects / disconnect
// ---------------------------------------------------------------------------

async function configureDwork(config: DcontextConfig) {
  const cwd = process.cwd();
  const currentProjects = config.dworkProjects[cwd];

  const options: { value: string; label: string; hint?: string }[] = [];

  if (config.dwork?.url) {
    options.push({ value: 'keep', label: 'Keep current connection', hint: config.dwork.url });
  }

  options.push({
    value: 'remap',
    label: 'Change project mapping',
    hint: currentProjects?.length ? currentProjects.join(', ') : 'not mapped',
  });

  options.push({ value: 'connect', label: 'Connect to server' });

  if (config.dwork?.url) {
    options.push({ value: 'disconnect', label: 'Disconnect' });
  }

  const mode = await p.select({ message: 'dwork', options });
  if (p.isCancel(mode)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (mode === 'keep') return;

  if (mode === 'connect') {
    const ok = await connectToDwork(config);
    if (ok) await mapDworkProjects(config);
    else p.log.warn('Keeping current dwork connection.');
  } else if (mode === 'remap') {
    await mapDworkProjects(config);
  } else if (mode === 'disconnect') {
    config.dwork = undefined;
    config.dworkProjects[cwd] = [];
    p.log.info('dwork disconnected.');
  }
}

// ---------------------------------------------------------------------------
// dops — 3 modes: keep / connect / disconnect
// ---------------------------------------------------------------------------

async function configureDops(config: DcontextConfig) {
  const options: { value: string; label: string; hint?: string }[] = [];

  if (config.dops?.url) {
    options.push({ value: 'keep', label: 'Keep current connection', hint: config.dops.url });
  }

  options.push({ value: 'connect', label: 'Connect to server' });

  if (config.dops?.url) {
    options.push({ value: 'disconnect', label: 'Disconnect' });
  }

  const mode = await p.select({ message: 'dops', options });
  if (p.isCancel(mode)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (mode === 'keep') return;

  if (mode === 'connect') {
    const ok = await connectToDops(config);
    if (!ok) p.log.warn('Keeping current dops connection.');
  } else if (mode === 'disconnect') {
    config.dops = undefined;
    p.log.info('dops disconnected.');
  }
}

// ---------------------------------------------------------------------------
// Briefing — flat p.group() following the dbrain configure pattern
// ---------------------------------------------------------------------------

async function configureBriefing(config: DcontextConfig) {
  const answers = await p.group(
    {
      maxFacts: () =>
        p.text({
          message: 'Max facts per briefing',
          initialValue: String(config.briefing.maxFacts),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
          },
        }),
      maxChars: () =>
        p.text({
          message: 'Max total characters',
          initialValue: String(config.briefing.maxChars),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 100) return 'Must be at least 100';
          },
        }),
      maxCharsPerFact: () =>
        p.text({
          message: 'Max characters per fact',
          initialValue: String(config.briefing.maxCharsPerFact),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 10) return 'Must be at least 10';
          },
        }),
      includeIdentity: () =>
        p.confirm({
          message: 'Include identity docs in briefing?',
          initialValue: config.briefing.includeIdentity,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Cancelled.');
        process.exit(0);
      },
    },
  );

  config.briefing = {
    maxFacts: parseInt(answers.maxFacts, 10),
    maxChars: parseInt(answers.maxChars, 10),
    maxCharsPerFact: parseInt(answers.maxCharsPerFact, 10),
    includeIdentity: answers.includeIdentity as boolean,
  };
}
