import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Config } from '../core/config.js';
import { indexProject } from '../core/indexer.js';
import { scaffoldBacklog } from '../core/templates.js';

import { createDocFile, getDocByPath } from './docs.js';
import { addTask, enrichTasksWithDetails, getTasks, updateTask } from './tasks.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  status TEXT DEFAULT 'active', path TEXT NOT NULL, source_path TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL, type TEXT DEFAULT 'task', status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'P2', estimate TEXT, deadline TEXT, source TEXT DEFAULT 'manual',
  detail_path TEXT, tags TEXT DEFAULT '[]', line_number INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY, project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL, type TEXT NOT NULL, file_path TEXT NOT NULL,
  body_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
  title, body, project_slug, type, content='', contentless_delete=1
);
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  title, description, project_slug, content='', contentless_delete=1
);
`;

let db: Database.Database;
let config: Config;
let projectPath: string;
let tmpDir: string;

function setupProject(slug = 'test-project') {
  projectPath = join(tmpDir, 'projects', slug);
  mkdirSync(join(projectPath, 'docs'), { recursive: true });

  const backlog = scaffoldBacklog(slug);
  writeFileSync(join(projectPath, 'BACKLOG.md'), backlog);

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (slug, name, description, status, path, source_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(slug, 'Test Project', null, 'active', projectPath, null, now, now);

  indexProject(db, slug, projectPath);
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `dwork-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });

  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  config = {
    dataPath: tmpDir,
    port: 7881,
    host: '0.0.0.0',
    token: 'test-token',
  };

  setupProject();
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('addTask', () => {
  it('creates a basic task', () => {
    const task = addTask(db, config, 'test-project', 'My task');

    expect(task.title).toBe('My task');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('P2');
    expect(task.detail_path).toBeNull();
  });

  it('creates a task with all options', () => {
    const task = addTask(db, config, 'test-project', 'Full task', {
      type: 'feature',
      priority: 'P0',
      status: 'doing',
      estimate: '2d',
      deadline: '2026-06-01',
    });

    expect(task.title).toBe('Full task');
    expect(task.type).toBe('feature');
    expect(task.priority).toBe('P0');
    expect(task.status).toBe('doing');
    expect(task.estimate).toBe('2d');
    expect(task.deadline).toBe('2026-06-01');
  });

  it('creates a task with detail string (existing doc path)', () => {
    const task = addTask(db, config, 'test-project', 'Task with detail', {
      detail: 'docs/001_existing.md',
    });

    expect(task.detail_path).toBe('docs/001_existing.md');
  });

  it('creates a task with detail_doc atomically', () => {
    const task = addTask(db, config, 'test-project', 'Atomic task', {
      priority: 'P1',
      type: 'feature',
      detail_doc: {
        title: 'Design for Atomic Task',
        body: '## Context\n\nThis is the detail document.',
        type: 'planning',
      },
    });

    expect(task.detail_path).toMatch(/^docs\/\d{3}_design-for-atomic-task\.md$/);

    expect(task.detail_path).toBeTruthy();
    const docFile = join(projectPath, task.detail_path as string);
    expect(existsSync(docFile)).toBe(true);

    const content = readFileSync(docFile, 'utf-8');
    expect(content).toContain('title: Design for Atomic Task');
    expect(content).toContain('type: planning');
    expect(content).toContain('## Context');

    const backlog = readFileSync(join(projectPath, 'BACKLOG.md'), 'utf-8');
    expect(backlog).toContain('Atomic task');
    expect(backlog).toContain(`detail: ${task.detail_path}`);

    const docs = db
      .prepare("SELECT * FROM docs WHERE project_slug = 'test-project' AND file_path = ?")
      .get(task.detail_path) as { title: string; type: string } | undefined;
    expect(docs).toBeDefined();
    expect(docs?.title).toBe('Design for Atomic Task');
    expect(docs?.type).toBe('planning');
  });

  it('detail string takes precedence over detail_doc', () => {
    const task = addTask(db, config, 'test-project', 'Precedence task', {
      detail: 'docs/manual-path.md',
      detail_doc: {
        title: 'Should not create',
        body: 'Ignored',
        type: 'note',
      },
    });

    expect(task.detail_path).toBe('docs/manual-path.md');

    const docs = db
      .prepare(
        "SELECT * FROM docs WHERE project_slug = 'test-project' AND title = 'Should not create'",
      )
      .all();
    expect(docs).toHaveLength(0);
  });

  it('auto-increments doc number with detail_doc', () => {
    createDocFile(db, 'test-project', projectPath, 'First doc', 'body', 'note');
    indexProject(db, 'test-project', projectPath);

    const task = addTask(db, config, 'test-project', 'Second doc task', {
      detail_doc: {
        title: 'Second doc',
        body: 'body',
        type: 'planning',
      },
    });

    expect(task.detail_path).toBe('docs/002_second-doc.md');
  });

  it('throws on unknown project', () => {
    expect(() => addTask(db, config, 'nope', 'Task')).toThrow("Project 'nope' not found");
  });

  it('task appears in getTasks after creation', () => {
    addTask(db, config, 'test-project', 'Visible task', { status: 'doing' });

    const tasks = getTasks(db, 'test-project', 'doing');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Visible task');
  });
});

describe('updateTask', () => {
  it('updates status', () => {
    const task = addTask(db, config, 'test-project', 'Status task');
    const ok = updateTask(db, config, task.id, { status: 'doing' });

    expect(ok).toBe(true);

    const tasks = getTasks(db, 'test-project', 'doing');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Status task');
  });

  it('links a detail doc via update', () => {
    const task = addTask(db, config, 'test-project', 'Linkable task');
    const ok = updateTask(db, config, task.id, { detail: 'docs/001_design.md' });

    expect(ok).toBe(true);

    const backlog = readFileSync(join(projectPath, 'BACKLOG.md'), 'utf-8');
    expect(backlog).toContain('detail: docs/001_design.md');

    const updated = getTasks(db, 'test-project');
    const found = updated.find((t) => t.title === 'Linkable task');
    expect(found?.detail_path).toBe('docs/001_design.md');
  });

  it('returns false for unknown task', () => {
    const ok = updateTask(db, config, 'task_nonexistent', { status: 'done' });
    expect(ok).toBe(false);
  });

  it('updates multiple fields at once', () => {
    const task = addTask(db, config, 'test-project', 'Multi update');
    updateTask(db, config, task.id, {
      title: 'Renamed',
      priority: 'P0',
      status: 'blocked',
      type: 'bug',
    });

    const tasks = getTasks(db, 'test-project', 'blocked');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Renamed');
    expect(tasks[0].priority).toBe('P0');
    expect(tasks[0].type).toBe('bug');
  });
});

describe('createDocFile', () => {
  it('creates a numbered doc file', () => {
    const relPath = createDocFile(db, 'test-project', projectPath, 'My Doc', '# Hello', 'note');

    expect(relPath).toBe('docs/001_my-doc.md');
    expect(existsSync(join(projectPath, relPath))).toBe(true);

    const content = readFileSync(join(projectPath, relPath), 'utf-8');
    expect(content).toContain('title: My Doc');
    expect(content).toContain('type: note');
    expect(content).toContain('# Hello');
  });

  it('increments number from existing docs', () => {
    createDocFile(db, 'test-project', projectPath, 'First', 'a', 'note');
    indexProject(db, 'test-project', projectPath);

    const second = createDocFile(db, 'test-project', projectPath, 'Second', 'b', 'note');
    expect(second).toBe('docs/002_second.md');
  });

  it('handles special characters in title', () => {
    const relPath = createDocFile(
      db,
      'test-project',
      projectPath,
      'MCP: add_task — detail_doc (v2)',
      'body',
      'planning',
    );

    expect(relPath).toMatch(/^docs\/001_mcp-add-task-detail-doc-v2\.md$/);
  });
});

describe('enrichTasksWithDetails', () => {
  it('returns detail_body: null when task has no detail_path', () => {
    addTask(db, config, 'test-project', 'No detail');
    const tasks = getTasks(db, 'test-project');
    const enriched = enrichTasksWithDetails(db, tasks);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].detail_body).toBeNull();
  });

  it('includes detail body when task has a detail doc', () => {
    const task = addTask(db, config, 'test-project', 'With detail', {
      detail_doc: {
        title: 'Design doc',
        body: '## Plan\n\nDo the thing.',
        type: 'planning',
      },
    });

    const tasks = getTasks(db, 'test-project');
    const enriched = enrichTasksWithDetails(db, tasks);
    const found = enriched.find((t) => t.id === task.id);

    expect(found).toBeDefined();
    expect(found!.detail_body).toContain('## Plan');
    expect(found!.detail_body).toContain('Do the thing.');
  });

  it('returns detail_body: null when detail file is missing', () => {
    addTask(db, config, 'test-project', 'Broken detail', {
      detail: 'docs/999_nonexistent.md',
    });

    const tasks = getTasks(db, 'test-project');
    const enriched = enrichTasksWithDetails(db, tasks);
    const found = enriched.find((t) => t.title === 'Broken detail');

    expect(found).toBeDefined();
    expect(found!.detail_body).toBeNull();
  });
});

describe('getDocByPath', () => {
  it('returns doc with content by project + file_path', () => {
    addTask(db, config, 'test-project', 'Doc task', {
      detail_doc: {
        title: 'Test doc',
        body: '# Content here',
        type: 'planning',
      },
    });

    const result = getDocByPath(db, 'test-project', 'docs/001_test-doc.md');

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Test doc');
    expect(result!.content).toContain('# Content here');
  });

  it('returns null for unknown file_path', () => {
    const result = getDocByPath(db, 'test-project', 'docs/999_nope.md');
    expect(result).toBeNull();
  });

  it('returns null for unknown project', () => {
    const result = getDocByPath(db, 'nonexistent', 'docs/001_test.md');
    expect(result).toBeNull();
  });
});
