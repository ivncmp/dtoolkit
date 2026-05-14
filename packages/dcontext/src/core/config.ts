import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TargetName = 'claude' | 'codex' | 'gemini' | 'opencode';

export interface TargetConfig {
  installed: boolean;
  installedAt?: string;
}

export interface DcontextConfig {
  initialized: boolean;
  dbrain: {
    url: string;
    token: string;
  };
  projects: Record<string, string>;
  briefing: {
    maxFacts: number;
    includeIdentity: boolean;
    maxChars: number;
    maxCharsPerFact: number;
  };
  targets: Record<TargetName, TargetConfig>;
}

export interface StatsData {
  briefings: { total: number; lastAt?: string };
  extractions: { total: number; lastAt?: string; messagesSaved: number };
  byTarget: Record<string, { briefings: number; extractions: number }>;
}

const DATA_DIR = process.env.DCONTEXT_DATA_DIR || join(homedir(), '.dcontext');

const DEFAULT_CONFIG: DcontextConfig = {
  initialized: false,
  dbrain: {
    url: '',
    token: '',
  },
  projects: {},
  briefing: {
    maxFacts: 15,
    includeIdentity: true,
    maxChars: 8000,
    maxCharsPerFact: 200,
  },
  targets: {
    claude: { installed: false },
    codex: { installed: false },
    gemini: { installed: false },
    opencode: { installed: false },
  },
};

const DEFAULT_STATS: StatsData = {
  briefings: { total: 0 },
  extractions: { total: 0, messagesSaved: 0 },
  byTarget: {},
};

export function getDataDir(): string {
  return DATA_DIR;
}

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

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

async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filePath);
}

export async function loadConfig(): Promise<DcontextConfig> {
  try {
    const raw = await readFile(join(DATA_DIR, 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as DcontextConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: DcontextConfig): Promise<void> {
  await ensureDataDir();
  await atomicWriteFile(join(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2) + '\n');
}

export async function loadStats(): Promise<StatsData> {
  try {
    const raw = await readFile(join(DATA_DIR, 'stats.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return deepMerge(
      DEFAULT_STATS as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as StatsData;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function updateStats(fn: (stats: StatsData) => void): Promise<void> {
  const stats = await loadStats();
  fn(stats);
  await ensureDataDir();
  await atomicWriteFile(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
}

export async function logError(message: string): Promise<void> {
  try {
    await ensureDataDir();
    const line = `[${new Date().toISOString()}] ${message}\n`;
    await appendFile(join(DATA_DIR, 'error.log'), line, 'utf-8');
  } catch {
    // never crash on logging
  }
}
