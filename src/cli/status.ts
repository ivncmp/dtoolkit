import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dbrain');
}

export async function status(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  if (!existsSync(join(dataPath, 'config.json'))) {
    console.log(`${pc.red('Not initialized.')} Run: dbrain init`);
    return;
  }

  const config = loadConfig(dataPath);
  const dbPath = join(dataPath, 'dbrain.db');
  const dbExists = existsSync(dbPath);
  const dbSize = dbExists ? statSync(dbPath).size : 0;

  console.log(`
${pc.cyan('dbrain')} status

  ${pc.green('Data')}:     ${config.dataPath}
  ${pc.green('Port')}:     ${config.port}
  ${pc.green('Host')}:     ${config.host}
  ${pc.green('Database')}: ${dbExists ? `${(dbSize / 1024).toFixed(1)} KB` : 'not created'}
`);
}
