import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dwork');
}

export async function status(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);

  try {
    const config = loadConfig(dataPath);
    const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;

    const res = await fetch(`${url}/health`);
    if (!res.ok) {
      console.log(pc.red('dwork is not responding'));
      return;
    }

    const data = (await res.json()) as {
      status: string;
      version: string;
      projects: number;
      tasks: number;
      docs: number;
    };

    console.log(`
${pc.cyan('dwork')} ${pc.dim(`v${data.version}`)}

  ${pc.green('Status')}:   ${data.status}
  ${pc.green('URL')}:      ${url}
  ${pc.green('Projects')}: ${data.projects}
  ${pc.green('Tasks')}:    ${data.tasks}
  ${pc.green('Docs')}:     ${data.docs}
`);
  } catch {
    console.log(pc.red('dwork is not running'));
    console.log(pc.dim(`Expected config at ${dataPath}/config.json`));
  }
}
