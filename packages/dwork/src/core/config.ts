import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

export const DProxyConfigSchema = z.object({
  url: z.string().default('http://localhost:7880'),
  token: z.string().optional(),
  provider: z.string().default('claude'),
});

export type DProxyConfig = z.infer<typeof DProxyConfigSchema>;

export const ConfigSchema = z.object({
  dataPath: z.string(),
  port: z.number().default(7881),
  host: z.string().default('0.0.0.0'),
  token: z.string(),
  dproxy: DProxyConfigSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(dataPath: string): Config {
  const configPath = join(dataPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run 'dwork init' first.`);
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  raw.dataPath = dataPath;
  if (process.env.DWORK_PORT) raw.port = parseInt(process.env.DWORK_PORT, 10);
  if (process.env.DWORK_HOST) raw.host = process.env.DWORK_HOST;
  if (process.env.DWORK_TOKEN) raw.token = process.env.DWORK_TOKEN;
  return ConfigSchema.parse(raw);
}
