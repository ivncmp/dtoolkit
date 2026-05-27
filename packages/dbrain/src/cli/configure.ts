import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export async function configure(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  let config;
  try {
    config = loadConfig(dataPath);
  } catch {
    console.log(`${pc.red('Not initialized.')} Run: ${pc.cyan('dbrain init')}`);
    return;
  }

  p.intro(pc.cyan('dbrain') + ' configure');

  const answers = await p.group(
    {
      port: () =>
        p.text({
          message: 'API port',
          initialValue: String(config.port),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1 || n > 65535) return 'Invalid port';
          },
        }),
      host: () =>
        p.select({
          message: 'Bind address',
          options: [
            { value: '0.0.0.0', label: '0.0.0.0 — All interfaces (accessible from network)' },
            { value: '127.0.0.1', label: '127.0.0.1 — Localhost only' },
          ],
          initialValue: config.host,
        }),
      brainName: () =>
        p.text({
          message: 'Brain name',
          initialValue: config.brainName || 'dBrain',
        }),
      hotDays: () =>
        p.text({
          message: 'Hot tier: days threshold',
          initialValue: String(config.tiers.hotDays),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
          },
        }),
      hotMinAccess: () =>
        p.text({
          message: 'Hot tier: minimum access count',
          initialValue: String(config.tiers.hotMinAccess),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
          },
        }),
      warmDays: () =>
        p.text({
          message: 'Warm tier: days threshold',
          initialValue: String(config.tiers.warmDays),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
          },
        }),
      compactThreshold: () =>
        p.text({
          message: 'Compact: similarity threshold (0-1)',
          initialValue: String(config.compact.threshold),
          validate: (v) => {
            const n = parseFloat(v ?? '');
            if (isNaN(n) || n < 0 || n > 1) return 'Must be between 0 and 1';
          },
        }),
      compactLimit: () =>
        p.text({
          message: 'Compact: batch limit',
          initialValue: String(config.compact.limit),
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
          },
        }),
      compactSchedule: () =>
        p.text({
          message: 'Compact: cron schedule (empty to disable)',
          initialValue: config.compact.schedule || '',
          placeholder: '0 3 * * *',
        }),
      dproxyUrl: () =>
        p.text({
          message: 'LLM: dproxy server URL (empty to disable)',
          initialValue: config.llm.dproxyUrl || '',
          placeholder: 'http://localhost:7880',
        }),
      dproxyToken: ({ results }) =>
        results.dproxyUrl
          ? p.text({
              message: 'LLM: dproxy auth token',
              initialValue: config.llm.dproxyToken || '',
              placeholder: 'sk-dproxy_...',
            })
          : Promise.resolve(''),
      llmProvider: ({ results }) =>
        results.dproxyUrl
          ? p.text({
              message: 'LLM: provider (empty for dproxy default)',
              initialValue: config.llm.provider || '',
              placeholder: 'claude',
            })
          : Promise.resolve(''),
      llmModel: ({ results }) =>
        results.dproxyUrl
          ? p.text({
              message: 'LLM: model (empty for provider default)',
              initialValue: config.llm.model || '',
              placeholder: 'claude-haiku-4-5-20251001',
            })
          : Promise.resolve(''),
    },
    {
      onCancel: () => {
        p.cancel('Configuration cancelled.');
        process.exit(0);
      },
    },
  );

  const raw = JSON.parse(readFileSync(join(dataPath, 'config.json'), 'utf-8'));

  const updated = {
    ...raw,
    port: parseInt(answers.port, 10),
    host: answers.host as string,
    brainName: answers.brainName,
    tiers: {
      hotDays: parseInt(answers.hotDays, 10),
      hotMinAccess: parseInt(answers.hotMinAccess, 10),
      warmDays: parseInt(answers.warmDays, 10),
    },
    compact: {
      ...raw.compact,
      threshold: parseFloat(answers.compactThreshold),
      limit: parseInt(answers.compactLimit, 10),
      schedule: answers.compactSchedule || undefined,
    },
    llm: answers.dproxyUrl
      ? {
          dproxyUrl: answers.dproxyUrl,
          dproxyToken: (answers.dproxyToken as string) || undefined,
          provider: (answers.llmProvider as string) || undefined,
          model: (answers.llmModel as string) || undefined,
        }
      : undefined,
  };

  if (JSON.stringify(updated) === JSON.stringify(raw)) {
    p.outro(pc.dim('No changes.'));
    return;
  }

  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(updated, null, 2) + '\n', 'utf-8');

  p.outro(pc.green('Config updated. Restart the server to apply changes.'));
}
