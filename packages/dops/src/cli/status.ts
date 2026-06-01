import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dops');
}

export async function status(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  try {
    const config = loadConfig(dataPath);
    const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;

    const res = await fetch(`${url}/health`);
    if (!res.ok) {
      console.log(pc.red('dops is not responding'));
      return;
    }

    const data = (await res.json()) as {
      status: string;
      stats: {
        sessions: number;
        events: number;
        tool_calls: number;
        errors: number;
        token_records: number;
      };
    };

    console.log(`
${pc.cyan('dops')}

  ${pc.green('Status')}:     ${data.status}
  ${pc.green('URL')}:        ${url}
  ${pc.green('Sessions')}:   ${data.stats.sessions}
  ${pc.green('Events')}:     ${data.stats.events}
  ${pc.green('Tool calls')}: ${data.stats.tool_calls}
  ${pc.green('Errors')}:     ${data.stats.errors}
`);
  } catch {
    console.log(pc.red('dops is not running'));
    console.log(pc.dim(`Expected config at ${dataPath}/config.json`));
  }
}
