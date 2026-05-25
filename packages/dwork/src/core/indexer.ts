import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type Database from 'better-sqlite3';

import { parseBacklog, parseFrontmatter } from './parser.js';

export interface IndexResult {
  docsIndexed: number;
  tasksIndexed: number;
  docsRemoved: number;
}

export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function genId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Buffer.from(bytes).toString('base64url')}`;
}

export function indexProject(
  db: Database.Database,
  projectSlug: string,
  projectPath: string,
): IndexResult {
  const result: IndexResult = { docsIndexed: 0, tasksIndexed: 0, docsRemoved: 0 };

  const mdFiles = walkMdFiles(projectPath);

  const existingDocs = db
    .prepare('SELECT id, file_path, body_hash FROM docs WHERE project_slug = ?')
    .all(projectSlug) as { id: string; file_path: string; body_hash: string | null }[];
  const existingByPath = new Map(existingDocs.map((d) => [d.file_path, d]));
  const seenPaths = new Set<string>();

  const transaction = db.transaction(() => {
    for (const absPath of mdFiles) {
      const relPath = relative(projectPath, absPath);
      seenPaths.add(relPath);
      const content = readFileSync(absPath, 'utf-8');
      const hash = computeHash(content);
      const existing = existingByPath.get(relPath);

      if (existing && existing.body_hash === hash) continue;

      const { frontmatter, body } = parseFrontmatter(content);
      const title = (frontmatter.title as string) || relPath;
      const docType = inferDocType(relPath, frontmatter);
      const now = new Date().toISOString();

      if (existing) {
        deleteFtsDoc(db, existing.id);
        db.prepare(
          'UPDATE docs SET title = ?, type = ?, body_hash = ?, updated_at = ? WHERE id = ?',
        ).run(title, docType, hash, now, existing.id);
        insertFtsDoc(db, existing.id, title, body, projectSlug, docType);
      } else {
        const id = genId('doc');
        db.prepare(
          'INSERT INTO docs (id, project_slug, title, type, file_path, body_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(id, projectSlug, title, docType, relPath, hash, now, now);
        insertFtsDoc(db, id, title, body, projectSlug, docType);
      }
      result.docsIndexed++;

      if (relPath === 'BACKLOG.md') {
        result.tasksIndexed = indexBacklogTasks(db, projectSlug, content);
      }
    }

    for (const existing of existingDocs) {
      if (!seenPaths.has(existing.file_path)) {
        deleteFtsDoc(db, existing.id);
        db.prepare('DELETE FROM docs WHERE id = ?').run(existing.id);
        result.docsRemoved++;
      }
    }
  });

  transaction();
  return result;
}

function deleteFtsTask(db: Database.Database, taskId: string): void {
  const row = db.prepare('SELECT rowid FROM tasks WHERE id = ?').get(taskId) as
    | { rowid: number }
    | undefined;
  if (!row) return;
  db.prepare('DELETE FROM tasks_fts WHERE rowid = ?').run(row.rowid);
}

function indexBacklogTasks(db: Database.Database, projectSlug: string, content: string): number {
  const parsed = parseBacklog(content, projectSlug);

  const existingTasks = db
    .prepare('SELECT id FROM tasks WHERE project_slug = ?')
    .all(projectSlug) as { id: string }[];
  for (const t of existingTasks) {
    deleteFtsTask(db, t.id);
  }
  db.prepare('DELETE FROM tasks WHERE project_slug = ?').run(projectSlug);

  const insertTask = db.prepare(
    'INSERT INTO tasks (id, project_slug, title, type, status, priority, estimate, deadline, source, detail_path, tags, line_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const now = new Date().toISOString();

  for (const task of parsed) {
    const id = genId('task');
    const type = task.metadata.type || 'task';
    const estimate = task.metadata.estimate || null;
    const deadline = task.metadata.deadline || null;
    const detailPath = task.metadata.detail || null;
    const tags = task.metadata.tags || '[]';

    insertTask.run(
      id,
      projectSlug,
      task.title,
      type,
      task.status,
      task.priority,
      estimate,
      deadline,
      'manual',
      detailPath,
      tags,
      task.lineNumber,
      now,
      now,
    );

    insertFtsTask(db, id, task.title, '', projectSlug);
  }

  return parsed.length;
}

function insertFtsDoc(
  db: Database.Database,
  docId: string,
  title: string,
  body: string,
  projectSlug: string,
  type: string,
): void {
  const rowid = getRowid(db, 'docs', docId);
  if (rowid == null) return;
  db.prepare(
    'INSERT INTO docs_fts(rowid, title, body, project_slug, type) VALUES (?, ?, ?, ?, ?)',
  ).run(rowid, title, body, projectSlug, type);
}

function deleteFtsDoc(db: Database.Database, docId: string): void {
  const row = db.prepare('SELECT rowid FROM docs WHERE id = ?').get(docId) as
    | { rowid: number }
    | undefined;
  if (!row) return;
  db.prepare('DELETE FROM docs_fts WHERE rowid = ?').run(row.rowid);
}

function insertFtsTask(
  db: Database.Database,
  taskId: string,
  title: string,
  description: string,
  projectSlug: string,
): void {
  const rowid = getRowid(db, 'tasks', taskId);
  if (rowid == null) return;
  db.prepare(
    'INSERT INTO tasks_fts(rowid, title, description, project_slug) VALUES (?, ?, ?, ?)',
  ).run(rowid, title, description, projectSlug);
}

function getRowid(db: Database.Database, table: string, id: string): number | null {
  const row = db.prepare(`SELECT rowid FROM ${table} WHERE id = ?`).get(id) as
    | { rowid: number }
    | undefined;
  return row?.rowid ?? null;
}

function inferDocType(relPath: string, frontmatter: Record<string, unknown>): string {
  if (frontmatter.type && typeof frontmatter.type === 'string') return frontmatter.type;
  const lower = relPath.toLowerCase();
  if (lower === 'readme.md') return 'readme';
  if (lower === 'tech.md') return 'tech';
  if (lower === 'roadmap.md') return 'roadmap';
  if (lower === 'backlog.md') return 'backlog';
  return 'note';
}

function walkMdFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...walkMdFiles(full));
      } else if (entry.endsWith('.md')) {
        files.push(full);
      }
    }
  } catch {
    // directory may not exist
  }
  return files;
}
