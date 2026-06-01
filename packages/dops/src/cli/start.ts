import { homedir } from 'node:os';
import { resolve } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import { startDashboard } from '../dashboard/server.js';
import { createServer } from '../server/index.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dops');
}

export async function start(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);
  const config = { ...loadConfig(dataPath), dataPath };
  const db = createDatabase(config);
  const app = createServer(config, db);

  const address = await app.listen({ port: config.port, host: config.host });

  const dashboardPort = config.port + 1;
  startDashboard(dashboardPort);

  console.log(`
${pc.cyan('dops')} is running

  ${pc.green('API')}:        ${address}
  ${pc.green('MCP')}:        ${address}/mcp
  ${pc.green('Dashboard')}: http://localhost:${dashboardPort}
  ${pc.green('Data')}:       ${config.dataPath}
  ${pc.green('Token')}:      ${config.token.slice(0, 16)}...
`);
}
