import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  category    TEXT NOT NULL,
  status      TEXT DEFAULT 'active',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  metadata    TEXT
);

CREATE TABLE IF NOT EXISTS facts (
  id              TEXT PRIMARY KEY,
  entity_id       TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  fact            TEXT NOT NULL,
  category        TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  status          TEXT DEFAULT 'active',
  superseded_by   TEXT,
  related_entities TEXT DEFAULT '[]',
  last_accessed   TEXT NOT NULL,
  access_count    INTEGER DEFAULT 0,
  tier            TEXT DEFAULT 'warm',
  source          TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
  fact, entity_id, category,
  content='facts', content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS documents (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  summary     TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  processed       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_unprocessed ON messages(processed) WHERE processed = 0;

CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_facts_tier ON facts(tier, last_accessed DESC);

CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, fact, entity_id, category)
    VALUES (new.rowid, new.fact, new.entity_id, new.category);
END;

CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, fact, entity_id, category)
    VALUES('delete', old.rowid, old.fact, old.entity_id, old.category);
END;

CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, fact, entity_id, category)
    VALUES('delete', old.rowid, old.fact, old.entity_id, old.category);
  INSERT INTO facts_fts(rowid, fact, entity_id, category)
    VALUES (new.rowid, new.fact, new.entity_id, new.category);
END;
`;

export function createDatabase(config: Config): Database.Database {
  const dbPath = join(config.dataPath, 'dbrain.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
