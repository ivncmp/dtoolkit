import { randomBytes } from 'node:crypto';

import type { EntityType, ParaCategory } from '@dtoolkit/core';
import type Database from 'better-sqlite3';
import pc from 'picocolors';

import { isLlmConfigured, llmAsk } from './llm.js';

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: string;
}

interface ConversationRow {
  id: string;
  source: string;
  started_at: string;
}

interface ExtractedEntity {
  name: string;
  type: EntityType;
  category: ParaCategory;
}

interface ExtractedFact {
  entity: string;
  fact: string;
  category: string;
}

interface Extraction {
  entities: ExtractedEntity[];
  facts: ExtractedFact[];
}

export interface ProcessOptions {
  db: Database.Database;
  limit?: number;
  dryRun?: boolean;
  onProgress?: (msg: string) => void;
}

export interface ProcessResult {
  conversationsProcessed: number;
  messagesProcessed: number;
  entitiesCreated: number;
  factsCreated: number;
}

const SYSTEM_PROMPT = `You extract structured knowledge from AI assistant conversations.

Given a conversation, identify:
1. **Entities** — people, projects, systems, events, or resources mentioned
2. **Facts** — specific, atomic pieces of information worth remembering

Entity rules:
- Only create entities for SIGNIFICANT things: projects the user works on, systems they maintain, people they interact with regularly, organizations they belong to
- Do NOT create entities for: minor mentions, celebrities, cultural references, family members (store those as facts on the user entity), individual services/containers running inside a system, hardware components of a system, files, config keys, or one-off references
- If something is a component/part of a bigger system, add it as a fact on that system instead of creating a separate entity
- Prefer fewer, meaningful entities over many granular ones

Fact rules:
- Only extract facts that are meaningful and worth storing long-term
- Skip greetings, filler, debugging noise, and transient task details
- Each fact should be one atomic statement, not a paragraph
- Use the entity name exactly as it appears in the conversation
- For the user, use their name if mentioned, otherwise use "user"
- Do NOT extract sensitive data: children's ages, private IDs, tokens, passwords
- Categorize entities using PARA: projects, areas, resources, archives
- Fact categories: preference, decision, milestone, context, skill, relationship

Respond with ONLY valid JSON, no markdown fences:
{"entities":[{"name":"...","type":"person|project|system|event|resource","category":"projects|areas|resources|archives"}],"facts":[{"entity":"...","fact":"...","category":"preference|decision|milestone|context|skill|relationship"}]}

If nothing worth extracting, respond: {"entities":[],"facts":[]}`;

export async function processConversations(opts: ProcessOptions): Promise<ProcessResult> {
  const { db, limit = 1, dryRun = false, onProgress } = opts;

  if (!isLlmConfigured()) {
    throw new Error('LLM not configured. Run: dbrain configure');
  }

  const result: ProcessResult = {
    conversationsProcessed: 0,
    messagesProcessed: 0,
    entitiesCreated: 0,
    factsCreated: 0,
  };

  const conversations = db
    .prepare(
      `SELECT DISTINCT c.id, c.source, c.started_at
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id AND m.processed = 0
       ORDER BY c.started_at ASC
       LIMIT ?`,
    )
    .all(limit) as ConversationRow[];

  onProgress?.(`${pc.dim(`${conversations.length} conversation(s) with unprocessed messages`)}`);

  if (conversations.length === 0) return result;

  for (const conv of conversations) {
    const messages = db
      .prepare(
        `SELECT id, conversation_id, role, content, timestamp
         FROM messages
         WHERE conversation_id = ? AND processed = 0
         ORDER BY timestamp ASC`,
      )
      .all(conv.id) as MessageRow[];

    if (messages.length === 0) continue;

    const date = conv.started_at.split('T')[0];
    onProgress?.(
      `\n${pc.bold(date)} ${pc.dim(`· ${messages.length} msgs · ${conv.source}`)}`,
    );

    const transcript = messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n\n');

    let extraction: Extraction;
    try {
      const response = await llmAsk({
        prompt: `Extract entities and facts from this conversation:\n\n${transcript}`,
        systemPrompt: SYSTEM_PROMPT,
      });
      extraction = parseExtraction(response.text);
    } catch (err) {
      onProgress?.(pc.red(`  Error: ${(err as Error).message}`));
      continue;
    }

    const newEntities = extraction.entities.filter((e) => {
      const exists = db
        .prepare("SELECT id FROM entities WHERE LOWER(name) = ? AND status = 'active'")
        .get(e.name.toLowerCase());
      return !exists;
    });
    const matchedFacts = extraction.facts.filter((f) => {
      const inExtracted = extraction.entities.some((e) => e.name === f.entity);
      const inDb = db
        .prepare("SELECT id FROM entities WHERE LOWER(name) = ? AND status = 'active'")
        .get(f.entity.toLowerCase());
      return inExtracted || inDb;
    });

    onProgress?.(
      `  ${pc.blue(`+${newEntities.length} entities`)} ${pc.dim(`(${extraction.entities.length - newEntities.length} exist)`)}  ${pc.blue(`+${matchedFacts.length} facts`)}`,
    );
    for (const e of newEntities) {
      onProgress?.(`  ${pc.green('+')} ${e.name} ${pc.dim(`(${e.type}, ${e.category})`)}`);
    }
    for (const e of extraction.entities.filter((e) => !newEntities.includes(e))) {
      onProgress?.(`  ${pc.dim('·')} ${pc.dim(e.name)}`);
    }
    for (const f of matchedFacts) {
      onProgress?.(`  ${pc.dim('›')} ${pc.dim(`[${f.entity}]`)} ${f.fact}`);
    }

    if (dryRun) {
      result.conversationsProcessed++;
      result.messagesProcessed += messages.length;
      result.entitiesCreated += newEntities.length;
      result.factsCreated += matchedFacts.length;
      continue;
    }

    const entityMap = resolveEntities(db, extraction.entities);
    const factsCreated = insertFacts(db, extraction.facts, entityMap);
    markProcessed(db, messages.map((m) => m.id));

    result.conversationsProcessed++;
    result.messagesProcessed += messages.length;
    result.entitiesCreated += entityMap.created;
    result.factsCreated += factsCreated;
  }

  return result;
}

function parseExtraction(text: string): Extraction {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Extraction;
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    };
  } catch {
    return { entities: [], facts: [] };
  }
}

function resolveEntities(
  db: Database.Database,
  entities: ExtractedEntity[],
): { map: Map<string, string>; created: number } {
  const map = new Map<string, string>();
  let created = 0;
  const now = new Date().toISOString();

  for (const entity of entities) {
    const nameLower = entity.name.toLowerCase();

    const existing = db
      .prepare("SELECT id FROM entities WHERE LOWER(name) = ? AND status = 'active'")
      .get(nameLower) as { id: string } | undefined;

    if (existing) {
      map.set(entity.name, existing.id);
    } else {
      const id = genId('ent');
      db.prepare(
        'INSERT INTO entities (id, name, type, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, entity.name, entity.type, entity.category, now, now);
      map.set(entity.name, id);
      created++;
    }
  }

  return { map, created };
}

function insertFacts(
  db: Database.Database,
  facts: ExtractedFact[],
  entityMap: { map: Map<string, string> },
): number {
  const now = new Date().toISOString().split('T')[0];
  let count = 0;

  const stmt = db.prepare(
    "INSERT INTO facts (id, entity_id, fact, category, timestamp, last_accessed, access_count, tier, source, related_entities) VALUES (?, ?, ?, ?, ?, ?, 1, 'warm', 'compact', '[]')",
  );

  for (const f of facts) {
    const entityId = entityMap.map.get(f.entity);
    if (!entityId) continue;

    stmt.run(genId('fact'), entityId, f.fact, f.category || 'context', now, now);
    count++;
  }

  return count;
}

function markProcessed(db: Database.Database, messageIds: string[]): void {
  const stmt = db.prepare('UPDATE messages SET processed = 1 WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of messageIds) stmt.run(id);
  });
  tx();
}
