import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active',
  path        TEXT NOT NULL,
  source_path TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title        TEXT NOT NULL,
  type         TEXT DEFAULT 'task',
  status       TEXT DEFAULT 'todo',
  priority     TEXT DEFAULT 'P2',
  estimate     TEXT,
  deadline     TEXT,
  source       TEXT DEFAULT 'manual',
  detail_path  TEXT,
  tags         TEXT DEFAULT '[]',
  line_number  INTEGER,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS docs (
  id           TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  body_hash    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
  title, body, project_slug, type,
  content='',
  contentless_delete=1
);

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  title, description, project_slug,
  content='',
  contentless_delete=1
);

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);

CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT 'read+write',
  created_at  TEXT NOT NULL,
  last_used   TEXT,
  status      TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_slug);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_docs_project ON docs(project_slug);
CREATE INDEX IF NOT EXISTS idx_docs_type ON docs(type);
CREATE INDEX IF NOT EXISTS idx_api_keys_token ON api_keys(token);
`;

function migrate(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
    | { v: number | null }
    | undefined;
  const _current = row?.v ?? 0;
  // Future migrations go here
}

export function createDatabase(config: Config): Database.Database {
  const dbPath = join(config.dataPath, 'dwork.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
