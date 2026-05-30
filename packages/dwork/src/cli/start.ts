import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import pc from 'picocolors';

import { loadConfig } from '../core/config.js';
import { createDatabase } from '../core/db.js';
import { indexProject } from '../core/indexer.js';
import { startDashboard } from '../dashboard/server.js';
import { createServer } from '../server/index.js';
import { openAllGraphs } from '../service/codegraph.js';

function resolveDataPath(pathArg?: string): string {
  if (pathArg) return resolve(pathArg.replace('~', homedir()));
  return resolve(homedir(), '.dwork');
}

export async function start(pathArg?: string) {
  const dataPath = resolveDataPath(pathArg);
  const config = { ...loadConfig(dataPath), dataPath };
  const db = createDatabase(config);
  const app = createServer(config, db);

  const projectsDir = join(dataPath, 'projects');
  try {
    const slugs = readdirSync(projectsDir);
    for (const slug of slugs) {
      const projectPath = join(projectsDir, slug);
      try {
        indexProject(db, slug, projectPath);
      } catch {
        // skip broken projects
      }
    }
  } catch {
    // projects dir may not exist
  }

  const graphCount = openAllGraphs(db, config.dataPath);

  const address = await app.listen({ port: config.port, host: config.host });

  const dashboardPort = config.port + 1;
  startDashboard(dashboardPort);

  const { projects } = db.prepare('SELECT COUNT(*) as projects FROM projects').get() as {
    projects: number;
  };
  const { tasks } = db.prepare('SELECT COUNT(*) as tasks FROM tasks').get() as {
    tasks: number;
  };

  console.log(`
${pc.cyan('dwork')} is running

  ${pc.green('API')}:       ${address}
  ${pc.green('MCP')}:       ${address}/mcp
  ${pc.green('Dashboard')}: http://localhost:${dashboardPort}
  ${pc.green('Data')}:      ${config.dataPath}
  ${pc.green('Token')}:     ${config.token.slice(0, 16)}...
  ${pc.green('Projects')}: ${projects}
  ${pc.green('Tasks')}:    ${tasks}
  ${pc.green('Graphs')}:   ${graphCount}
`);
}
