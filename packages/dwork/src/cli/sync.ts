import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import { syncProject } from '../service/sync.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dwork');
}

export async function sync(project: string, opts: { path?: string }) {
  const dataPath = resolveDataPath(opts.path);

  let config;
  try {
    config = loadConfig(dataPath);
  } catch {
    console.log(`${pc.red('Not initialized.')} Run: ${pc.cyan('dwork init')}`);
    return;
  }

  const db = createDatabase({ ...config, dataPath });

  console.log(`${pc.dim('Syncing')} ${pc.green(project)}${pc.dim('...')}`);

  const result = await syncProject(db, config, project);

  db.close();

  if (result.success) {
    console.log(`${pc.green('Synced:')} ${result.message}`);
    if (result.updatedFiles) {
      for (const f of result.updatedFiles) {
        console.log(`  ${pc.dim('updated')} ${f}`);
      }
    }
  } else {
    console.log(`${pc.red('Failed:')} ${result.message}`);
  }
}
