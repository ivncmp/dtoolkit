import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';
import { parseBacklog, parseFrontmatter, serializeBacklog } from '../core/parser.js';

import { createDocFile } from './docs.js';
import { genId } from './utils.js';

export interface TaskRow {
  id: string;
  project_slug: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimate: string | null;
  deadline: string | null;
  source: string;
  detail_path: string | null;
  tags: string;
  line_number: number | null;
  created_at: string;
  updated_at: string;
}

export function getTasks(
  db: Database.Database,
  project: string,
  status?: string,
  priority?: string,
): TaskRow[] {
  let sql = 'SELECT * FROM tasks WHERE project_slug = ?';
  const params: string[] = [project];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    sql += ' AND priority = ?';
    params.push(priority);
  }

  sql +=
    " ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 END, deadline ASC NULLS LAST";

  return db.prepare(sql).all(...params) as TaskRow[];
}

export function addTask(
  db: Database.Database,
  config: Config,
  project: string,
  title: string,
  opts: {
    type?: string;
    priority?: string;
    status?: string;
    estimate?: string;
    deadline?: string;
    detail?: string;
    detail_doc?: { title: string; body: string; type: string };
    source?: string;
  } = {},
): TaskRow {
  const projectRow = db.prepare('SELECT path FROM projects WHERE slug = ?').get(project) as
    | { path: string }
    | undefined;
  if (!projectRow) throw new Error(`Project '${project}' not found`);

  const detailPath =
    opts.detail ??
    (opts.detail_doc
      ? createDocFile(
          db,
          project,
          projectRow.path,
          opts.detail_doc.title,
          opts.detail_doc.body,
          opts.detail_doc.type,
        )
      : null);

  const backlogPath = join(projectRow.path, 'BACKLOG.md');
  const content = readFileSync(backlogPath, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);
  const tasks = parseBacklog(content, project);

  const priority = opts.priority || 'P2';
  const status = opts.status || 'todo';

  const metadata: Record<string, string> = {};
  if (opts.type) metadata.type = opts.type;
  if (opts.estimate) metadata.estimate = opts.estimate;
  if (opts.deadline) metadata.deadline = opts.deadline;
  if (detailPath) metadata.detail = detailPath;
  if (status !== 'todo') metadata.status = status;

  tasks.push({
    title,
    done: false,
    status,
    priority,
    metadata,
    lineNumber: 0,
  });

  const serialized = serializeBacklog(tasks, frontmatter);
  writeFileSync(backlogPath, serialized);
  indexProject(db, project, projectRow.path);

  const inserted = db
    .prepare(
      'SELECT * FROM tasks WHERE project_slug = ? AND title = ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(project, title) as TaskRow | undefined;

  return (
    inserted || {
      id: genId('task'),
      project_slug: project,
      title,
      type: opts.type || 'task',
      status,
      priority,
      estimate: opts.estimate || null,
      deadline: opts.deadline || null,
      source: opts.source || 'manual',
      detail_path: detailPath,
      tags: '[]',
      line_number: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
}

export function updateTask(
  db: Database.Database,
  config: Config,
  taskId: string,
  changes: {
    title?: string;
    status?: string;
    priority?: string;
    type?: string;
    estimate?: string;
    deadline?: string;
    detail?: string;
  },
): boolean {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  if (!task) return false;

  const projectRow = db
    .prepare('SELECT path FROM projects WHERE slug = ?')
    .get(task.project_slug) as { path: string } | undefined;
  if (!projectRow) return false;

  const backlogPath = join(projectRow.path, 'BACKLOG.md');
  const content = readFileSync(backlogPath, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);
  const tasks = parseBacklog(content, task.project_slug);

  const target = tasks.find((t) => t.title === task.title);
  if (!target) return false;

  if (changes.title) target.title = changes.title;
  if (changes.status) {
    target.status = changes.status;
    target.done = changes.status === 'done';
    if (changes.status !== 'todo' && changes.status !== 'done') {
      target.metadata.status = changes.status;
    } else {
      delete target.metadata.status;
    }
  }
  if (changes.priority) target.priority = changes.priority;
  if (changes.type) target.metadata.type = changes.type;
  if (changes.estimate) target.metadata.estimate = changes.estimate;
  if (changes.deadline) target.metadata.deadline = changes.deadline;
  if (changes.detail) target.metadata.detail = changes.detail;

  const serialized = serializeBacklog(tasks, frontmatter);
  writeFileSync(backlogPath, serialized);
  indexProject(db, task.project_slug, projectRow.path);

  return true;
}

export function deleteTask(db: Database.Database, config: Config, taskId: string): boolean {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  if (!task) return false;

  const projectRow = db
    .prepare('SELECT path FROM projects WHERE slug = ?')
    .get(task.project_slug) as { path: string } | undefined;
  if (!projectRow) return false;

  const backlogPath = join(projectRow.path, 'BACKLOG.md');
  const content = readFileSync(backlogPath, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);
  const tasks = parseBacklog(content, task.project_slug);

  const filtered = tasks.filter((t) => t.title !== task.title);
  if (filtered.length === tasks.length) return false;

  const serialized = serializeBacklog(filtered, frontmatter);
  writeFileSync(backlogPath, serialized);
  indexProject(db, task.project_slug, projectRow.path);

  return true;
}

export function whatToDoNext(db: Database.Database, project?: string): TaskRow[] {
  let sql = `SELECT * FROM tasks WHERE status = 'todo'`;
  const params: string[] = [];

  if (project) {
    sql += ' AND project_slug = ?';
    params.push(project);
  }

  sql += ` ORDER BY
    CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 END,
    deadline ASC NULLS LAST,
    CASE estimate
      WHEN '1h' THEN 1 WHEN '2h' THEN 2 WHEN '4h' THEN 4
      WHEN '1d' THEN 8 WHEN '2d' THEN 16 WHEN '3d' THEN 24
      WHEN '1w' THEN 40 WHEN '2w' THEN 80
      ELSE 999
    END
    LIMIT 5`;

  return db.prepare(sql).all(...params) as TaskRow[];
}
