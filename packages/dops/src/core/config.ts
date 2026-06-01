import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const ModelPricingSchema = z.object({
  input: z.number(),
  output: z.number(),
  cache_read: z.number().default(0),
  cache_write: z.number().default(0),
});

const DEFAULT_PRICING: Record<string, z.infer<typeof ModelPricingSchema>> = {
  'claude-opus-4-6': { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  'claude-opus-4-5-20250620': { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-sonnet-4-5-20250514': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1 },
  'gpt-4o': { input: 2.5, output: 10, cache_read: 1.25, cache_write: 2.5 },
  'gpt-4.1': { input: 2, output: 8, cache_read: 0.5, cache_write: 2 },
  o3: { input: 2, output: 8, cache_read: 0.5, cache_write: 2 },
  'gemini-3-flash-preview': { input: 0.15, output: 0.6, cache_read: 0.04, cache_write: 0.15 },
};

export const ConfigSchema = z.object({
  dataPath: z.string(),
  port: z.number().default(7883),
  host: z.string().default('0.0.0.0'),
  token: z.string(),
  pricing: z.record(z.string(), ModelPricingSchema).default(DEFAULT_PRICING),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(dataPath: string): Config {
  const configPath = join(dataPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run 'dops init' first.`);
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  raw.dataPath = dataPath;
  if (process.env.DOPS_PORT) raw.port = parseInt(process.env.DOPS_PORT, 10);
  if (process.env.DOPS_HOST) raw.host = process.env.DOPS_HOST;
  if (process.env.DOPS_TOKEN) raw.token = process.env.DOPS_TOKEN;
  return ConfigSchema.parse(raw);
}
