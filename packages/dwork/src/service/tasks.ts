import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';
import { parseBacklog, parseFrontmatter, serializeBacklog } from '../core/parser.js';

import { createDocFile } from './docs.js';
import { genId, genTaskId } from './utils.js';

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

export interface TaskWithDetail extends TaskRow {
  detail_body: string | null;
}

export function enrichTasksWithDetails(db: Database.Database, tasks: TaskRow[]): TaskWithDetail[] {
  const projectPaths = new Map<string, string>();

  return tasks.map((task) => {
    if (!task.detail_path) return { ...task, detail_body: null };

    let projectPath = projectPaths.get(task.project_slug);
    if (projectPath === undefined) {
      const row = db.prepare('SELECT path FROM projects WHERE slug = ?').get(task.project_slug) as
        | { path: string }
        | undefined;
      projectPath = row?.path ?? '';
      projectPaths.set(task.project_slug, projectPath);
    }

    if (!projectPath) return { ...task, detail_body: null };

    try {
      const content = readFileSync(join(projectPath, task.detail_path), 'utf-8');
      return { ...task, detail_body: content };
    } catch {
      return { ...task, detail_body: null };
    }
  });
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

  const taskId = genTaskId();
  const metadata: Record<string, string> = {};
  if (opts.type) metadata.type = opts.type;
  if (opts.estimate) metadata.estimate = opts.estimate;
  if (opts.deadline) metadata.deadline = opts.deadline;
  if (detailPath) metadata.detail = detailPath;
  if (status !== 'todo') metadata.status = status;

  tasks.push({
    id: taskId,
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
    project?: string;
  },
): boolean {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  if (!task) return false;

  const sourceProjectRow = db
    .prepare('SELECT path FROM projects WHERE slug = ?')
    .get(task.project_slug) as { path: string } | undefined;
  if (!sourceProjectRow) return false;

  const backlogPath = join(sourceProjectRow.path, 'BACKLOG.md');
  const content = readFileSync(backlogPath, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);
  const tasks = parseBacklog(content, task.project_slug);

  const target = tasks.find((t) => t.id === taskId) ?? tasks.find((t) => t.title === task.title);
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

  if (changes.project && changes.project !== task.project_slug) {
    const destProjectRow = db
      .prepare('SELECT path FROM projects WHERE slug = ?')
      .get(changes.project) as { path: string } | undefined;
    if (!destProjectRow) return false;

    const remaining = tasks.filter((t) => t !== target);
    const serializedSource = serializeBacklog(remaining, frontmatter);
    writeFileSync(backlogPath, serializedSource);

    const destBacklogPath = join(destProjectRow.path, 'BACKLOG.md');
    const destContent = readFileSync(destBacklogPath, 'utf-8');
    const { frontmatter: destFrontmatter } = parseFrontmatter(destContent);
    const destTasks = parseBacklog(destContent, changes.project);

    destTasks.push({ ...target, lineNumber: 0 });
    const serializedDest = serializeBacklog(destTasks, destFrontmatter);
    writeFileSync(destBacklogPath, serializedDest);

    indexProject(db, task.project_slug, sourceProjectRow.path);
    indexProject(db, changes.project, destProjectRow.path);
  } else {
    const serialized = serializeBacklog(tasks, frontmatter);
    writeFileSync(backlogPath, serialized);
    indexProject(db, task.project_slug, sourceProjectRow.path);
  }

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

  const targetIdx = tasks.findIndex((t) => t.id === taskId);
  const filtered =
    targetIdx >= 0
      ? tasks.filter((_, i) => i !== targetIdx)
      : tasks.filter((t) => t.title !== task.title);
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
