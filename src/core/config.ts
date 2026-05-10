import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

export const ConfigSchema = z.object({
  dataPath: z.string(),
  port: z.number().default(7878),
  host: z.string().default('0.0.0.0'),
  token: z.string(),
  tiers: z
    .object({
      hotDays: z.number().default(7),
      hotMinAccess: z.number().default(10),
      warmDays: z.number().default(30),
    })
    .default({ hotDays: 7, hotMinAccess: 10, warmDays: 30 }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(dataPath: string): Config {
  const configPath = join(dataPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run 'dbrain init' first.`);
  }
  return ConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf-8')));
}
