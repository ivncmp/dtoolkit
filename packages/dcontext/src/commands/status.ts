import { DBrainClient, DWorkClient } from '@dtoolkit/sdk';
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

function section(title: string) {
  console.log(`  ${pc.bold(pc.blue(title))}`);
}

function row(label: string, value: string) {
  console.log(`    ${pc.dim(label.padEnd(12))} ${value}`);
}

function sep() {
  console.log();
}

async function runStatus() {
  const config = await loadConfig();
  const stats = await loadStats();
  const { url, token } = config.dbrain;

  console.log();
  console.log(`  ${pc.bold('dcontext')} ${pc.dim('status')}`);
  console.log(`  ${pc.dim('─'.repeat(40))}`);
  sep();

  // ── Services ──
  section('Services');
  sep();

  if (url) {
    try {
      const client = new DBrainClient(url, token);
      const health = await client.health();
      const brainType = health.brainType ?? 'personal';
      row(
        'dbrain',
        `${pc.green('●')} ${url} ${pc.dim('—')} ${health.entities} entities, ${health.facts} facts ${pc.dim(`(${brainType})`)}`,
      );
      if (health.connectedBrains && health.connectedBrains > 0) {
        try {
          const conns = await client.listConnections();
          for (const c of conns) {
            const s = c.online ? pc.green('●') : pc.red('●');
            row('', `${s} ${c.name}`);
          }
        } catch {
          // skip
        }
      }
    } catch {
      row('dbrain', `${pc.red('●')} ${url} ${pc.dim('(unreachable)')}`);
    }
  } else {
    row('dbrain', `${pc.red('●')} ${pc.dim('not configured')}`);
  }

  if (config.dwork?.url) {
    try {
      const dworkClient = new DWorkClient(config.dwork.url, config.dwork.token);
      const overview = await dworkClient.overview();
      row(
        'dwork',
        `${pc.green('●')} ${config.dwork.url} ${pc.dim('—')} ${overview.totalProjects} projects, ${overview.totalTasks} tasks`,
      );
    } catch {
      row('dwork', `${pc.red('●')} ${config.dwork.url} ${pc.dim('(unreachable)')}`);
    }
  } else {
    row('dwork', `${pc.dim('—')} ${pc.dim('not configured')}`);
  }

  if (config.dops?.url) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (config.dops.token) headers['Authorization'] = `Bearer ${config.dops.token}`;
      const res = await fetch(`${config.dops.url}/health`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        row('dops', `${pc.green('●')} ${config.dops.url}`);
      } else {
        row('dops', `${pc.red('●')} ${config.dops.url} ${pc.dim(`(HTTP ${res.status})`)}`);
      }
    } catch {
      row('dops', `${pc.red('●')} ${config.dops.url} ${pc.dim('(unreachable)')}`);
    }
  } else {
    row('dops', `${pc.dim('—')} ${pc.dim('not configured')}`);
  }
  sep();

  // ── Targets ──
  section('Targets');
  sep();
  for (const name of ['claude', 'gemini', 'opencode'] as const) {
    const target = resolveTarget(name);
    if (!target) continue;
    const installed = await target.isInstalled();
    const cfg = config.targets[name];
    if (installed) {
      const since = cfg?.installedAt ? pc.dim(` since ${cfg.installedAt.split('T')[0]}`) : '';
      row(name, `${pc.green('●')} installed${since}`);
    } else {
      row(name, `${pc.dim('○')} ${pc.dim('not installed')}`);
    }
  }
  sep();

  // ── Context ──
  const cwd = process.cwd();
  const entity = config.projects[cwd];
  const dworkSlugs = config.dworkProjects?.[cwd];
  section('Context');
  row('cwd', pc.dim(cwd));
  sep();

  if (entity) {
    row('entity', pc.blue(entity));
    if (url) {
      try {
        const client = new DBrainClient(url, token);
        const results = await client.search(`"${entity}"`, { limit: 5 });
        if (results.length > 0) {
          row('facts', `${pc.green(String(results.length))}+ matching`);
          for (const r of results.slice(0, 3)) {
            console.log(`    ${pc.dim('             · ' + r.fact.fact.slice(0, 72))}`);
          }
          if (results.length > 3) {
            console.log(`    ${pc.dim(`             … and ${results.length - 3} more`)}`);
          }
        } else {
          row('facts', pc.dim('none'));
        }
      } catch {
        row('facts', pc.dim('could not query'));
      }
    }
  } else {
    row('entity', `${pc.dim('not mapped')} — run ${pc.cyan('dcontext init')}`);
  }
  if (dworkSlugs && dworkSlugs.length > 0) {
    row('dwork', dworkSlugs.map((s) => pc.blue(s)).join(pc.dim(', ')));
    if (config.dwork?.url) {
      try {
        const dworkClient = new DWorkClient(config.dwork.url, config.dwork.token);
        let totalTasks = 0;
        let totalDocs = 0;
        for (const slug of dworkSlugs) {
          const tasks = await dworkClient.listTasks(slug).catch(() => []);
          const docs = await dworkClient.listDocs(slug).catch(() => []);
          totalTasks += tasks.length;
          totalDocs += docs.length;
        }
        row('tasks', String(totalTasks));
        row('docs', String(totalDocs));
      } catch {
        // skip
      }
    }
  }
  sep();

  // ── Other projects ──
  const projects = Object.entries(config.projects).filter(([path]) => path !== cwd);
  if (projects.length > 0) {
    section('Other projects');
    sep();
    for (const [path, ent] of projects) {
      const short = path.replace(/^\/Users\/[^/]+/, '~');
      row(ent, pc.dim(short));
    }
    sep();
  }

  // ── Stats ──
  section('Stats');
  sep();
  const lastBriefing = stats.briefings.lastAt
    ? pc.dim(` last ${stats.briefings.lastAt.split('T')[0]}`)
    : '';
  row('briefings', `${stats.briefings.total}${lastBriefing}`);
  const msgCount = stats.extractions.messagesSaved
    ? ` ${pc.dim(`(${stats.extractions.messagesSaved} msgs)`)}`
    : '';
  const lastExtraction = stats.extractions.lastAt
    ? pc.dim(` last ${stats.extractions.lastAt.split('T')[0]}`)
    : '';
  row('extractions', `${stats.extractions.total}${msgCount}${lastExtraction}`);
  if (config.dwork?.url) {
    try {
      const dworkClient = new DWorkClient(config.dwork.url, config.dwork.token);
      const overview = await dworkClient.overview();
      const activeTasks = overview.totalTasks;
      row(
        'tasks',
        `${activeTasks} ${pc.dim(`across ${overview.totalProjects} projects, ${overview.totalDocs} docs`)}`,
      );
    } catch {
      // skip
    }
  }
  sep();

  console.log(`  ${pc.dim(`Config: ${getDataDir()}/config.json`)}`);
  console.log();
}
