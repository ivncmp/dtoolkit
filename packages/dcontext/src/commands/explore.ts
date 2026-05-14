import { Command } from 'commander';
import pc from 'picocolors';

import { generateBriefing } from '../core/briefing.js';
import { loadConfig } from '../core/config.js';

export function createExploreCommand(): Command {
  return new Command('explore')
    .description('Preview the context that would be injected for a directory')
    .argument('[path]', 'Directory to explore (defaults to cwd)')
    .action(async (path?: string) => {
      try {
        await runExplore(path);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    });
}

async function runExplore(path?: string) {
  const cwd = path || process.cwd();
  const config = await loadConfig();

  if (!config.dbrain.url) {
    console.error(pc.red('dcontext not configured. Run: dcontext init'));
    process.exit(1);
  }

  const entity = config.projects[cwd];
  if (!entity) {
    console.log(pc.dim(`No entity mapped for ${cwd}`));
    console.log();

    const projects = Object.entries(config.projects);
    if (projects.length > 0) {
      console.log(pc.bold('Mapped directories:'));
      for (const [p, e] of projects) {
        console.log(`  ${pc.dim(p)} → ${pc.blue(e)}`);
      }
    } else {
      console.log(`Run ${pc.cyan('dcontext init')} in a project directory to map it.`);
    }
    return;
  }

  console.log(pc.bold('Context preview') + pc.dim(` — ${cwd} → ${entity}`));
  console.log();

  const briefing = await generateBriefing(entity, config);

  if (!briefing) {
    console.log(pc.dim('No context found in dbrain for this project.'));
    return;
  }

  console.log(briefing);
  console.log();
  console.log(pc.dim(`${briefing.length} chars — max ${config.briefing.maxChars}`));
}
