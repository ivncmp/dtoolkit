import { execFile } from 'node:child_process';
import { readFile, readdir, stat, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { getDataDir, loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let debugEnabled: boolean | null = null;

async function debugLog(msg: string): Promise<void> {
  if (debugEnabled === null) {
    const config = await loadConfig();
    debugEnabled = config.debug ?? false;
  }
  if (!debugEnabled) return;
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFile(join(getDataDir(), 'debug.log'), line).catch(() => {});
}

const execFileAsync = promisify(execFile);

const SEARCH_SCRIPT = process.env.LIFE_SEARCH_BIN || join(__dirname, 'scripts', 'search_facts.py');

interface LifeEntity {
  name: string;
  collection: string; // "projects", "areas/people", etc.
  summaryPath: string;
}

interface SearchResult {
  entity: string;
  entity_type: string;
  score: number;
  fact: string;
  fact_id: string;
  category: string;
}

/**
 * Calls search_facts.py to find entities relevant to the query.
 * Returns unique entity names ranked by relevance.
 */
async function searchRelevantEntities(
  query: string,
  lifeDir: string,
  limit: number = 10,
): Promise<{ entities: string[]; facts: SearchResult[] }> {
  const config = await loadConfig();
  const pythonBin = config.life.pythonBin || 'python3';
  const { stdout } = await execFileAsync(pythonBin, [
    SEARCH_SCRIPT,
    query,
    '--json',
    '--limit',
    String(limit),
    '--life-dir',
    lifeDir,
  ]);

  const results: SearchResult[] = JSON.parse(stdout);

  // Deduplicate entity names preserving rank order
  const seen = new Set<string>();
  const entities: string[] = [];
  for (const r of results) {
    if (!seen.has(r.entity)) {
      seen.add(r.entity);
      entities.push(r.entity);
    }
  }

  return { entities, facts: results };
}

/** Recursively discover PARA entities (directories with summary.md) under projects/, areas/, resources/. */
async function discoverEntities(lifeDir: string): Promise<LifeEntity[]> {
  const entities: LifeEntity[] = [];

  async function scanDir(dir: string, collection: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const summaryPath = join(fullPath, 'summary.md');

      try {
        await stat(summaryPath);
        entities.push({
          name: entry,
          collection,
          summaryPath,
        });
      } catch {
        // No summary.md — check if it's a nested directory (e.g. areas/people/, areas/systems/)
        try {
          const s = await stat(fullPath);
          if (s.isDirectory()) {
            await scanDir(fullPath, `${collection}/${entry}`);
          }
        } catch (err) {
          await debugLog(`scanDir: skipping ${fullPath}: ${err}`);
        }
      }
    }
  }

  for (const topLevel of ['projects', 'areas', 'resources']) {
    await scanDir(join(lifeDir, topLevel), topLevel);
  }

  return entities;
}

/**
 * Build PARA knowledge base context for system prompt injection.
 * Uses semantic search when a query is provided, falls back to full scan.
 * Returns empty if `life.dir` is not configured.
 */
export async function buildLifeContext(query?: string, maxChars?: number): Promise<string> {
  const config = await loadConfig();
  const lifeDir = config.life.dir;
  if (!lifeDir) return '';

  const limit = maxChars ?? config.life.maxInjectionChars;
  await debugLog(
    `buildLifeContext called — lifeDir: ${lifeDir}, query: ${query?.slice(0, 80)}, limit: ${limit}`,
  );

  // If we have a query, use PARA search for targeted context
  if (query) {
    try {
      return await buildSearchedLifeContext(query, lifeDir, limit);
    } catch (err: unknown) {
      await debugLog(`PARA search failed, falling back to full scan: ${err}`);
    }
  } else {
    await debugLog(`No query provided, skipping search`);
  }

  // Fallback: full scan (no query, or search failed)
  try {
    const result = await buildFullLifeContext(lifeDir, limit);
    await debugLog(`PARA full scan returned ${result.length} chars from dir: ${lifeDir}`);
    return result;
  } catch (err) {
    await debugLog(`PARA full scan failed for dir ${lifeDir}: ${err}`);
    return '';
  }
}

/**
 * Find the owner entity by checking items.json for category: "owner".
 */
async function findOwnerEntity(allEntities: LifeEntity[]): Promise<string | null> {
  for (const entity of allEntities) {
    const itemsPath = join(dirname(entity.summaryPath), 'items.json');
    try {
      const raw = await readFile(itemsPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.category === 'owner') return entity.name;
    } catch {
      // skip
    }
  }
  return null;
}

/**
 * Targeted context: search for relevant entities and inject only their summaries + top facts.
 */
async function buildSearchedLifeContext(
  query: string,
  lifeDir: string,
  limit: number,
): Promise<string> {
  const { entities: relevantNames, facts } = await searchRelevantEntities(query, lifeDir);
  await debugLog(`PARA search returned ${relevantNames.length} entities, ${facts.length} facts`);

  // Discover all entities so we can map names to summary paths
  const allEntities = await discoverEntities(lifeDir);
  const entityMap = new Map<string, LifeEntity>();
  for (const e of allEntities) {
    entityMap.set(e.name, e);
  }

  // Always include the owner entity first for identity resolution
  const ownerName = await findOwnerEntity(allEntities);
  if (ownerName && !relevantNames.includes(ownerName)) {
    relevantNames.unshift(ownerName);
    await debugLog(`PARA injected owner entity: ${ownerName}`);
  }

  if (relevantNames.length === 0) return '';

  const config = await loadConfig();
  const maxEntityChars = config.life.maxEntityChars ?? 1500;
  const parts: string[] = [];
  let totalChars = 0;

  // Inject summaries of relevant entities (owner first if present)
  for (const name of relevantNames) {
    const entity = entityMap.get(name);
    if (!entity) continue;

    try {
      const content = await readFile(entity.summaryPath, 'utf-8');
      const trimmed =
        content.length > maxEntityChars
          ? content.slice(0, maxEntityChars) + '\n...(truncated)'
          : content;

      const section = `## [${entity.collection}] ${entity.name}\n${trimmed}`;
      if (totalChars + section.length > limit) break;

      parts.push(section);
      totalChars += section.length;
    } catch (err) {
      await debugLog(`buildSearchedLifeContext: failed to read ${entity.summaryPath}: ${err}`);
    }
  }

  // Append top relevant facts as quick-reference
  const topFacts = facts.slice(0, 15);
  if (topFacts.length > 0) {
    const factsSection = `## Relevant Facts\n${topFacts
      .map((f) => `- [${f.entity}] ${f.fact}`)
      .join('\n')}`;

    if (totalChars + factsSection.length <= limit) {
      parts.push(factsSection);
    }
  }

  await debugLog(`PARA searched context: ${parts.length} parts, ${totalChars} chars`);
  if (parts.length === 0) return '';

  return `You have the following life/PARA knowledge context relevant to this query:\n\n${parts.join('\n\n')}`;
}

/**
 * Full scan fallback: read all summaries up to char limit (original behavior).
 */
async function buildFullLifeContext(lifeDir: string, limit: number): Promise<string> {
  const config = await loadConfig();
  const maxEntityChars = config.life.maxEntityChars ?? 1500;
  const entities = await discoverEntities(lifeDir);
  if (entities.length === 0) return '';

  const parts: string[] = [];
  let totalChars = 0;

  // Read index.md first as overview
  try {
    const index = await readFile(join(lifeDir, 'index.md'), 'utf-8');
    const section = `## Life Overview\n${index}`;
    if (section.length <= limit) {
      parts.push(section);
      totalChars += section.length;
    }
  } catch {
    // no index.md
  }

  for (const entity of entities) {
    try {
      const content = await readFile(entity.summaryPath, 'utf-8');
      const trimmed =
        content.length > maxEntityChars
          ? content.slice(0, maxEntityChars) + '\n...(truncated)'
          : content;

      const section = `## [${entity.collection}] ${entity.name}\n${trimmed}`;
      if (totalChars + section.length > limit) break;

      parts.push(section);
      totalChars += section.length;
    } catch (err) {
      await debugLog(`buildFullLifeContext: failed to read ${entity.summaryPath}: ${err}`);
    }
  }

  if (parts.length === 0) return '';

  return `You have the following life/PARA knowledge context about the user:\n\n${parts.join('\n\n')}`;
}
