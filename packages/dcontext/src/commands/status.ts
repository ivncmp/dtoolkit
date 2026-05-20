import { DBrainClient } from '@dtoolkit/sdk';
import { Command } from 'commander';
import pc from 'picocolors';

import { getDataDir, loadConfig, loadStats } from '../core/config.js';

import { resolveTarget } from './targets.js';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show configuration, context, and stats')
    .action(async () => {
      try {
        await runStatus();
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runStatus() {
  const config = await loadConfig();
  const stats = await loadStats();

  console.log(pc.bold('dcontext status'));
  console.log();

  // dbrain connection
  console.log(pc.bold('dbrain'));
  const { url, token } = config.dbrain;
  if (url) {
    try {
      const client = new DBrainClient(url, token);
      const health = await client.health();
      console.log(`  ${pc.green(url)} — ${health.entities} entities, ${health.facts} facts`);
      const brainType = health.brainType ?? 'personal';
      console.log(`  Type: ${brainType === 'shared' ? pc.green(brainType) : pc.blue(brainType)}`);
      if (health.connectedBrains && health.connectedBrains > 0) {
        console.log(`  Connected: ${pc.green(String(health.connectedBrains))} brain(s)`);
        try {
          const conns = await client.listConnections();
          for (const c of conns) {
            const s = c.online ? pc.green('online') : pc.red('offline');
            console.log(`    ${pc.bold(c.name)} ${s}`);
          }
        } catch {
          // skip connection details if endpoint fails
        }
      }
    } catch {
      console.log(`  ${pc.red(url)} (unreachable)`);
    }
  } else {
    console.log(`  ${pc.red('not configured')} — run ${pc.cyan('dcontext init')}`);
  }
  console.log();

  // targets
  console.log(pc.bold('Targets'));
  for (const name of ['claude', 'gemini', 'opencode'] as const) {
    const target = resolveTarget(name);
    if (!target) continue;
    const installed = await target.isInstalled();
    const cfg = config.targets[name];
    if (installed) {
      const since = cfg?.installedAt ? ` (since ${cfg.installedAt.split('T')[0]})` : '';
      console.log(`  ${name}: ${pc.green('installed')}${pc.dim(since)}`);
    } else {
      console.log(`  ${name}: ${pc.dim('not installed')}`);
    }
  }
  console.log();

  // context for current directory
  const cwd = process.cwd();
  const entity = config.projects[cwd];
  console.log(pc.bold('Context') + pc.dim(` (${cwd})`));
  if (entity) {
    console.log(`  Entity: ${pc.blue(entity)}`);
    if (url) {
      try {
        const client = new DBrainClient(url, token);
        const results = await client.search(`"${entity}"`, { limit: 5 });
        if (results.length > 0) {
          console.log(`  Facts:  ${pc.green(String(results.length))}+ matching`);
          for (const r of results.slice(0, 3)) {
            console.log(`    ${pc.dim('·')} ${r.fact.fact.slice(0, 80)}`);
          }
          if (results.length > 3) {
            console.log(`    ${pc.dim(`... and ${results.length - 3} more`)}`);
          }
        } else {
          console.log(`  Facts:  ${pc.dim('none found')}`);
        }
      } catch {
        console.log(`  Facts:  ${pc.dim('could not query')}`);
      }
    }
  } else {
    console.log(
      `  ${pc.dim('no entity mapped')} — run ${pc.cyan('dcontext init')} in this directory`,
    );
  }
  console.log();

  // other mapped projects
  const projects = Object.entries(config.projects).filter(([path]) => path !== cwd);
  if (projects.length > 0) {
    console.log(pc.bold('Other projects'));
    for (const [path, ent] of projects) {
      console.log(`  ${pc.dim(path)} → ${pc.blue(ent)}`);
    }
    console.log();
  }

  // stats
  console.log(pc.bold('Stats'));
  console.log(
    `  Briefings:    ${stats.briefings.total}${stats.briefings.lastAt ? pc.dim(` (last: ${stats.briefings.lastAt.split('T')[0]})`) : ''}`,
  );
  console.log(
    `  Extractions:  ${stats.extractions.total}${stats.extractions.messagesSaved ? ` (${stats.extractions.messagesSaved} messages)` : ''}${stats.extractions.lastAt ? pc.dim(` (last: ${stats.extractions.lastAt.split('T')[0]})`) : ''}`,
  );

  console.log();
  console.log(pc.dim(`Config: ${getDataDir()}/config.json`));
}
