import { readFile } from 'node:fs/promises';

import chalk from 'chalk';
import { Command } from 'commander';
import { parse } from 'yaml';

import { readStdin } from '../claude.js';
import {
  getTemplate,
  saveTemplate,
  listTemplates,
  deleteTemplate,
  renderTemplate,
} from '../lib/template-store.js';
import type { TemplateDefinition } from '../lib/types.js';

import { runAsk } from './ask.js';

/** Create the `cw template` Commander command with list/show/add/run/delete subcommands. */
export function createTemplateCommand(): Command {
  const cmd = new Command('template').description('Manage prompt templates');

  cmd
    .command('list')
    .description('List all templates')
    .action(async () => {
      const templates = await listTemplates();
      if (templates.length === 0) {
        console.log(chalk.dim("No templates. Use 'cw template add <name>' to create one."));
        return;
      }
      for (const t of templates) {
        const desc = t.description ? chalk.dim(` — ${t.description}`) : '';
        console.log(`${chalk.blue(t.name)}${desc}`);
      }
    });

  cmd
    .command('show <name>')
    .description('Show template details')
    .action(async (name: string) => {
      const t = await getTemplate(name);
      if (!t) {
        console.error(chalk.red(`Template "${name}" not found.`));
        process.exit(1);
      }
      console.log(chalk.bold(t.name));
      if (t.description) console.log(chalk.dim(t.description));
      console.log();
      console.log(chalk.bold('Prompt:'));
      console.log(t.prompt);
      if (t.variables?.length) {
        console.log();
        console.log(chalk.bold('Variables:'));
        for (const v of t.variables) {
          const req = v.required ? chalk.red('*') : '';
          const def = v.default ? chalk.dim(` (default: ${v.default})`) : '';
          const src = v.source ? chalk.dim(` [${v.source}]`) : '';
          console.log(`  {{${v.name}}}${req}${def}${src}`);
        }
      }
    });

  cmd
    .command('add <name>')
    .description('Add a template from a YAML file or interactively')
    .option('-f, --file <path>', 'Import from YAML file')
    .option('-d, --description <text>', 'Template description')
    .option('-p, --prompt <text>', 'Template prompt text')
    .action(async (name: string, opts) => {
      let template: TemplateDefinition;

      if (opts.file) {
        const raw = await readFile(opts.file, 'utf-8');
        template = parse(raw) as TemplateDefinition;
        template.name = name;
      } else if (opts.prompt) {
        template = {
          name,
          description: opts.description,
          prompt: opts.prompt,
        };
      } else {
        console.error(chalk.red('Provide --file or --prompt'));
        process.exit(1);
      }

      await saveTemplate(template);
      console.log(chalk.green(`Template "${name}" saved.`));
    });

  cmd
    .command('run <name>')
    .description('Run a template')
    .option('--var <pairs...>', 'Variables as key=value pairs')
    .option('-m, --model <model>', 'Model override')
    .option('--raw', 'Print raw JSON response')
    .action(async (name: string, opts) => {
      const t = await getTemplate(name);
      if (!t) {
        console.error(chalk.red(`Template "${name}" not found.`));
        process.exit(1);
      }

      // Parse variables
      const vars: Record<string, string> = {};
      if (opts.var) {
        for (const pair of opts.var as string[]) {
          const eq = pair.indexOf('=');
          if (eq === -1) continue;
          vars[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
      }

      // Check for stdin variable
      const stdinVar = t.variables?.find((v) => v.source === 'stdin');
      if (stdinVar) {
        const stdinContent = await readStdin();
        if (stdinContent) {
          vars[stdinVar.name] = stdinContent;
        }
      }

      // Apply defaults
      if (t.variables) {
        for (const v of t.variables) {
          if (!(v.name in vars) && v.default) {
            vars[v.name] = v.default;
          }
          if (v.required && !(v.name in vars)) {
            console.error(chalk.red(`Missing required variable: {{${v.name}}}`));
            process.exit(1);
          }
        }
      }

      const rendered = renderTemplate(t, vars);

      await runAsk([rendered], {
        model: opts.model ?? t.claudeOptions?.model,
        maxTurns: t.claudeOptions?.maxTurns,
        maxBudgetUsd: t.claudeOptions?.maxBudgetUsd,
        raw: opts.raw,
        memory: true,
        history: true,
        templateUsed: name,
      });
    });

  cmd
    .command('delete <name>')
    .description('Delete a template')
    .action(async (name: string) => {
      const deleted = await deleteTemplate(name);
      if (deleted) {
        console.log(chalk.green(`Template "${name}" deleted.`));
      } else {
        console.error(chalk.red(`Template "${name}" not found.`));
      }
    });

  return cmd;
}
