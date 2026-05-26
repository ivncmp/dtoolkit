import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';

import { genId } from './utils.js';

export interface DocRow {
  id: string;
  project_slug: string;
  title: string;
  type: string;
  file_path: string;
  body_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocWithContent extends DocRow {
  content: string;
}

export function listDocs(db: Database.Database, project: string, type?: string): DocRow[] {
  let sql = 'SELECT * FROM docs WHERE project_slug = ?';
  const params: string[] = [project];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY file_path';
  return db.prepare(sql).all(...params) as DocRow[];
}

export function getDoc(
  db: Database.Database,
  config: Config,
  docId: string,
): DocWithContent | null {
  const doc = db.prepare('SELECT * FROM docs WHERE id = ?').get(docId) as DocRow | undefined;
  if (!doc) return null;

  const project = db.prepare('SELECT path FROM projects WHERE slug = ?').get(doc.project_slug) as
    | { path: string }
    | undefined;
  if (!project) return null;

  let content = '';
  try {
    content = readFileSync(join(project.path, doc.file_path), 'utf-8');
  } catch {
    // file may not exist
  }

  return { ...doc, content };
}

export function getDocByPath(
  db: Database.Database,
  projectSlug: string,
  filePath: string,
): DocWithContent | null {
  const doc = db
    .prepare('SELECT * FROM docs WHERE project_slug = ? AND file_path = ?')
    .get(projectSlug, filePath) as DocRow | undefined;
  if (!doc) return null;

  const project = db.prepare('SELECT path FROM projects WHERE slug = ?').get(projectSlug) as
    | { path: string }
    | undefined;
  if (!project) return null;

  let content = '';
  try {
    content = readFileSync(join(project.path, doc.file_path), 'utf-8');
  } catch {
    // file may not exist
  }

  return { ...doc, content };
}

export function createDocFile(
  db: Database.Database,
  projectSlug: string,
  projectPath: string,
  title: string,
  body: string,
  type: string,
): string {
  const existingDocs = db
    .prepare("SELECT file_path FROM docs WHERE project_slug = ? AND file_path LIKE 'docs/%'")
    .all(projectSlug) as { file_path: string }[];

  let maxNum = 0;
  for (const d of existingDocs) {
    const match = d.file_path.match(/^docs\/(\d+)_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = String(maxNum + 1).padStart(3, '0');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const fileName = `${nextNum}_${slug}.md`;
  const relPath = `docs/${fileName}`;

  const fm = { title, type };
  const content = ['---', stringifyYaml(fm).trimEnd(), '---', '', body, ''].join('\n');

  writeFileSync(join(projectPath, relPath), content);
  return relPath;
}

export function addDoc(
  db: Database.Database,
  config: Config,
  project: string,
  title: string,
  body: string,
  type: string,
): DocRow {
  const projectRow = db.prepare('SELECT path FROM projects WHERE slug = ?').get(project) as
    | { path: string }
    | undefined;
  if (!projectRow) throw new Error(`Project '${project}' not found`);

  const relPath = createDocFile(db, project, projectRow.path, title, body, type);
  indexProject(db, project, projectRow.path);

  const inserted = db
    .prepare('SELECT * FROM docs WHERE project_slug = ? AND file_path = ?')
    .get(project, relPath) as DocRow | undefined;

  return (
    inserted || {
      id: genId('doc'),
      project_slug: project,
      title,
      type,
      file_path: relPath,
      body_hash: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
}

export function updateDoc(
  db: Database.Database,
  config: Config,
  docId: string,
  changes: { title?: string; body?: string; type?: string },
): boolean {
  const doc = db.prepare('SELECT * FROM docs WHERE id = ?').get(docId) as DocRow | undefined;
  if (!doc) return false;

  const projectRow = db
    .prepare('SELECT path FROM projects WHERE slug = ?')
    .get(doc.project_slug) as { path: string } | undefined;
  if (!projectRow) return false;

  const filePath = join(projectRow.path, doc.file_path);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return false;
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let fmObj: Record<string, unknown> = {};
  let body = content;

  if (fmMatch) {
    fmObj = (parseYaml(fmMatch[1]) as Record<string, unknown>) || {};
    body = fmMatch[2];
  }

  if (changes.title) fmObj.title = changes.title;
  if (changes.type) fmObj.type = changes.type;
  if (changes.body !== undefined) body = changes.body;

  const newContent = ['---', stringifyYaml(fmObj).trimEnd(), '---', '', body].join('\n');
  writeFileSync(filePath, newContent);
  indexProject(db, doc.project_slug, projectRow.path);

  return true;
}

export function deleteDoc(db: Database.Database, config: Config, docId: string): boolean {
  const doc = db.prepare('SELECT * FROM docs WHERE id = ?').get(docId) as DocRow | undefined;
  if (!doc) return false;

  const projectRow = db
    .prepare('SELECT path FROM projects WHERE slug = ?')
    .get(doc.project_slug) as { path: string } | undefined;
  if (!projectRow) return false;

  try {
    unlinkSync(join(projectRow.path, doc.file_path));
  } catch {
    // file may already be gone
  }

  indexProject(db, doc.project_slug, projectRow.path);
  return true;
}

export function getRoadmap(db: Database.Database, config: Config, project: string): string | null {
  const projectRow = db.prepare('SELECT path FROM projects WHERE slug = ?').get(project) as
    | { path: string }
    | undefined;
  if (!projectRow) return null;

  try {
    return readFileSync(join(projectRow.path, 'ROADMAP.md'), 'utf-8');
  } catch {
    return null;
  }
}
