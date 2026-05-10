import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AppConfig } from './types.js';

const DATA_DIR = process.env.CW_DATA_DIR || join(homedir(), '.claude-wrapper');

const DEFAULT_CONFIG: AppConfig = {
  initialized: false,
  memory: {
    autoInject: true,
    defaultKeys: [],
    maxInjectionChars: 4000,
  },
  life: {
    autoInject: true,
    dir: '',
    maxInjectionChars: 12000,
    maxEntityChars: 1500,
    pythonBin: 'python3',
  },
  history: {
    maxEntries: 1000,
  },
  workspace: {
    enabled: false,
    dir: '',
    maxInjectionChars: 16000,
    files: [
      { file: 'IDENTITY.md', header: '## Identity' },
      { file: 'SOUL.md', header: '## Soul / Personality' },
      { file: 'USER.md', header: '## User Profile' },
      { file: 'MEMORY.md', header: '## System Memory' },
    ],
  },
  chatLog: {
    enabled: false,
    dir: '',
    userPrefix: 'User:',
    assistantPrefix: 'Assistant:',
    sectionHeader: "## Today's conversation",
  },
  claude: {
    bin: 'claude',
    skipPermissions: false,
  },
  defaults: {},
  debug: false,
};

/** Returns the data directory path (`~/.claude-wrapper` or `CW_DATA_DIR`). */
export function getDataDir(): string {
  return DATA_DIR;
}

/** Create the data directory and subdirectories (memory/, templates/) if they don't exist. */
export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(join(DATA_DIR, 'memory'), { recursive: true });
  await mkdir(join(DATA_DIR, 'templates'), { recursive: true });
}

/** Recursively merge two objects, preserving nested defaults when overrides are partial. */
function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const key in overrides) {
    if (
      typeof defaults[key] === 'object' &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key]) &&
      typeof overrides[key] === 'object' &&
      overrides[key] !== null &&
      !Array.isArray(overrides[key])
    ) {
      result[key] = deepMerge(
        defaults[key] as Record<string, unknown>,
        overrides[key] as Record<string, unknown>,
      );
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

/** Load config from disk, deep-merging with defaults for any missing keys. */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(join(DATA_DIR, 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as AppConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Persist the full config to disk atomically. */
export async function saveConfig(config: AppConfig): Promise<void> {
  await ensureDataDir();
  await atomicWriteFile(join(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2) + '\n');
}

/**
 * Write a file atomically by writing to a .tmp file first, then renaming.
 * Prevents corruption from concurrent writes or interrupted processes.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filePath);
}

/** Get a nested config value using dot notation (e.g. `"memory.maxInjectionChars"`). */
export async function getConfigValue(key: string): Promise<unknown> {
  const config = await loadConfig();
  const parts = key.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Set a nested config value using dot notation. Auto-parses booleans and numbers. */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  const parts = key.split('.');
  let current: Record<string, unknown> = config as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  // Try to parse as number or boolean
  let parsed: unknown = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (!isNaN(Number(value)) && value !== '') parsed = Number(value);

  current[parts[parts.length - 1]] = parsed;
  await saveConfig(config);
}
