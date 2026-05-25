import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';
import {
  scaffoldBacklog,
  scaffoldReadme,
  scaffoldRoadmap,
  scaffoldTech,
} from '../core/templates.js';

import { genId } from './utils.js';

export interface ProjectWithContext {
  slug: string;
  name: string;
  description: string | null;
  status: string;
  path: string;
  source_path: string | null;
  created_at: string;
  updated_at: string;
  readme?: string;
  tech?: string;
  taskCounts: Record<string, number>;
}

export function createProject(
  db: Database.Database,
  config: Config,
  slug: string,
  name: string,
  description?: string,
  sourcePath?: string,
): ProjectWithContext {
  const projectPath = join(config.dataPath, 'projects', slug);
  mkdirSync(join(projectPath, 'docs'), { recursive: true });

  writeFileSync(join(projectPath, 'README.md'), scaffoldReadme(slug, name, description));
  writeFileSync(join(projectPath, 'TECH.md'), scaffoldTech(slug));
  writeFileSync(join(projectPath, 'ROADMAP.md'), scaffoldRoadmap(slug));
  writeFileSync(join(projectPath, 'BACKLOG.md'), scaffoldBacklog(slug));

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (slug, name, description, status, path, source_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(slug, name, description || null, 'active', projectPath, sourcePath || null, now, now);

  indexProject(db, slug, projectPath);

  const result = getProject(db, config, slug);
  if (!result) throw new Error(`Failed to create project '${slug}'`);
  return result;
}

export function getProject(
  db: Database.Database,
  _config: Config,
  slug: string,
): ProjectWithContext | null {
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as
    | {
        slug: string;
        name: string;
        description: string | null;
        status: string;
        path: string;
        source_path: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!project) return null;

  let readme: string | undefined;
  let tech: string | undefined;
  try {
    readme = readFileSync(join(project.path, 'README.md'), 'utf-8');
  } catch {
    // file may not exist
  }
  try {
    tech = readFileSync(join(project.path, 'TECH.md'), 'utf-8');
  } catch {
    // file may not exist
  }

  const counts = db
    .prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE project_slug = ? GROUP BY status`)
    .all(slug) as { status: string; count: number }[];

  const taskCounts: Record<string, number> = {};
  for (const row of counts) {
    taskCounts[row.status] = row.count;
  }

  return { ...project, readme, tech, taskCounts };
}

export function listProjects(
  db: Database.Database,
  status?: string,
): Array<{
  slug: string;
  name: string;
  description: string | null;
  status: string;
  taskCounts: Record<string, number>;
}> {
  let sql = 'SELECT slug, name, description, status FROM projects';
  const params: string[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY updated_at DESC';

  const projects = db.prepare(sql).all(...params) as {
    slug: string;
    name: string;
    description: string | null;
    status: string;
  }[];

  return projects.map((p) => {
    const counts = db
      .prepare('SELECT status, COUNT(*) as count FROM tasks WHERE project_slug = ? GROUP BY status')
      .all(p.slug) as { status: string; count: number }[];

    const taskCounts: Record<string, number> = {};
    for (const row of counts) {
      taskCounts[row.status] = row.count;
    }

    return { ...p, taskCounts };
  });
}

export function updateProject(
  db: Database.Database,
  slug: string,
  changes: { name?: string; description?: string; status?: string; source_path?: string },
): boolean {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (changes.name !== undefined) {
    sets.push('name = ?');
    params.push(changes.name);
  }
  if (changes.description !== undefined) {
    sets.push('description = ?');
    params.push(changes.description);
  }
  if (changes.status !== undefined) {
    sets.push('status = ?');
    params.push(changes.status);
  }
  if (changes.source_path !== undefined) {
    sets.push('source_path = ?');
    params.push(changes.source_path);
  }

  if (sets.length === 0) return false;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(slug);

  const result = db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE slug = ?`).run(...params);
  return result.changes > 0;
}

export function archiveProject(db: Database.Database, slug: string): boolean {
  return updateProject(db, slug, { status: 'archived' });
}

export { genId };
