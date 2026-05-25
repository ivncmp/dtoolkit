import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DProxyClient } from '@dtoolkit/sdk';
import type { ProviderName } from '@dtoolkit/sdk';
import type Database from 'better-sqlite3';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';

export interface SyncResult {
  success: boolean;
  message: string;
  updatedFiles?: string[];
}

export async function syncProject(
  db: Database.Database,
  config: Config,
  slug: string,
): Promise<SyncResult> {
  if (!config.dproxy) {
    return {
      success: false,
      message: 'dproxy not configured. Add dproxy settings to config.json or run dwork configure.',
    };
  }

  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as
    | { slug: string; name: string; path: string; source_path: string | null }
    | undefined;

  if (!project) {
    return { success: false, message: `Project '${slug}' not found` };
  }

  if (!project.source_path) {
    return {
      success: false,
      message: `Project '${slug}' has no source_path configured. Set it via update_project or dwork configure.`,
    };
  }

  let sourceContext = '';
  try {
    const pkgPath = join(project.source_path, 'package.json');
    const pkg = readFileSync(pkgPath, 'utf-8');
    sourceContext += `package.json:\n${pkg}\n\n`;
  } catch {
    // no package.json
  }

  try {
    const readmePath = join(project.source_path, 'README.md');
    const readme = readFileSync(readmePath, 'utf-8');
    sourceContext += `README.md:\n${readme}\n\n`;
  } catch {
    // no README
  }

  if (!sourceContext) {
    return {
      success: false,
      message: `No readable source files found at ${project.source_path}`,
    };
  }

  const client = new DProxyClient(config.dproxy.url, config.dproxy.token);

  const prompt = `Analyze this project and generate updated documentation in markdown.

Project: ${project.name} (${slug})
Source path: ${project.source_path}

Source context:
${sourceContext}

Generate a concise TECH.md with:
- Stack section (table with Layer | Technology)
- Architecture section (brief description)
- Development section (build/test/run commands)

Respond ONLY with the markdown content, no explanation.`;

  try {
    const response = await client.ask(prompt, {
      provider: config.dproxy.provider as ProviderName,
    });
    const content = response.text || '';

    if (content) {
      const techPath = join(project.path, 'TECH.md');
      const existingTech = readFileSync(techPath, 'utf-8');
      const hasFrontmatter = existingTech.startsWith('---');

      let newTech: string;
      if (hasFrontmatter) {
        const fmEnd = existingTech.indexOf('---', 4);
        const frontmatter = existingTech.slice(0, fmEnd + 3);
        newTech = `${frontmatter}\n\n${content}\n`;
      } else {
        newTech = content;
      }

      writeFileSync(techPath, newTech);
      indexProject(db, slug, project.path);

      return {
        success: true,
        message: `Synced TECH.md for ${slug} from source at ${project.source_path}`,
        updatedFiles: ['TECH.md'],
      };
    }

    return { success: false, message: 'dproxy returned empty response' };
  } catch (err) {
    return {
      success: false,
      message: `Sync failed: ${(err as Error).message}`,
    };
  }
}
