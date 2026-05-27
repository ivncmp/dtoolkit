import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

// Connections only go personal → shared. No chaining.
export const ConnectionSchema = z.object({
  name: z.string(),
  url: z.string(),
  token: z.string(),
});

export type Connection = z.infer<typeof ConnectionSchema>;

export const ConfigSchema = z.object({
  dataPath: z.string(),
  port: z.number().default(7878),
  host: z.string().default('0.0.0.0'),
  token: z.string(),
  brainName: z.string().optional(),
  brainType: z.enum(['personal', 'shared']).default('personal'),
  connections: z.array(ConnectionSchema).default([]),
  tiers: z
    .object({
      hotDays: z.number().default(7),
      hotMinAccess: z.number().default(10),
      warmDays: z.number().default(30),
    })
    .default({ hotDays: 7, hotMinAccess: 10, warmDays: 30 }),
  compact: z
    .object({
      threshold: z.number().min(0).max(1).default(0.85),
      limit: z.number().min(1).default(1000),
      schedule: z.string().optional(),
      provider: z.string().optional(),
    })
    .default({ threshold: 0.85, limit: 1000 }),
  llm: z
    .object({
      dproxyUrl: z.string().optional(),
      dproxyToken: z.string().optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(dataPath: string): Config {
  const configPath = join(dataPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run 'dbrain init' first.`);
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  raw.dataPath = dataPath;
  if (process.env.DBRAIN_BRAIN_NAME) raw.brainName = process.env.DBRAIN_BRAIN_NAME;
  if (process.env.DBRAIN_BRAIN_TYPE) raw.brainType = process.env.DBRAIN_BRAIN_TYPE;
  return ConfigSchema.parse(raw);
}

export function loadConnections(dataPath: string): Connection[] {
  const configPath = join(dataPath, 'config.json');
  if (!existsSync(configPath)) return [];
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return ConfigSchema.parse(raw).connections;
}
