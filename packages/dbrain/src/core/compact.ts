import { computeTier, diceCoefficient } from '@dtoolkit/core';
import type { TierConfig } from '@dtoolkit/core';
import type Database from 'better-sqlite3';

import { processConversations } from './process.js';

export type CompactStep = 'dedup' | 'tiers' | 'process';

export interface CompactOptions {
  db: Database.Database;
  tiers: TierConfig;
  threshold?: number;
  limit?: number;
  dryRun?: boolean;
  steps?: CompactStep[];
  onProgress?: (msg: string) => void;
}

export interface CompactResult {
  factsDeduped: number;
  factsProcessed: number;
  tiersUpdated: number;
  conversationsProcessed: number;
  messagesProcessed: number;
  entitiesCreated: number;
  factsExtracted: number;
}

interface FactRow {
  id: string;
  entity_id: string;
  fact: string;
  last_accessed: string;
  access_count: number;
  tier: string;
  compacted_at: string | null;
}

export async function compact(opts: CompactOptions): Promise<CompactResult> {
  const {
    db,
    tiers,
    threshold = 0.85,
    limit = 1000,
    dryRun = false,
    steps = ['dedup', 'tiers'],
    onProgress,
  } = opts;

  const result: CompactResult = {
    factsDeduped: 0,
    factsProcessed: 0,
    tiersUpdated: 0,
    conversationsProcessed: 0,
    messagesProcessed: 0,
    entitiesCreated: 0,
    factsExtracted: 0,
  };

  if (steps.includes('process')) {
    const proc = await processConversations({ db, dryRun, onProgress });
    result.conversationsProcessed = proc.conversationsProcessed;
    result.messagesProcessed = proc.messagesProcessed;
    result.entitiesCreated = proc.entitiesCreated;
    result.factsExtracted = proc.factsCreated;
  }

  if (steps.includes('dedup')) {
    const dedup = deduplicateFacts(db, threshold, limit, dryRun, onProgress);
    result.factsDeduped = dedup.archived;
    result.factsProcessed = dedup.processed;
  }

  if (steps.includes('tiers')) {
    result.tiersUpdated = recalculateTiers(db, tiers, dryRun, onProgress);
  }

  return result;
}

function deduplicateFacts(
  db: Database.Database,
  threshold: number,
  limit: number,
  dryRun: boolean,
  onProgress?: (msg: string) => void,
): { archived: number; processed: number } {
  const facts = db
    .prepare(
      `SELECT id, entity_id, fact, last_accessed, access_count, tier, compacted_at
       FROM facts
       WHERE status = 'active' AND tier = 'cold' AND compacted_at IS NULL
       ORDER BY last_accessed ASC
       LIMIT ?`,
    )
    .all(limit) as FactRow[];

  onProgress?.(`Found ${facts.length} uncompacted cold facts`);

  if (facts.length === 0) return { archived: 0, processed: 0 };

  const byEntity = new Map<string, FactRow[]>();
  for (const f of facts) {
    const group = byEntity.get(f.entity_id) ?? [];
    group.push(f);
    byEntity.set(f.entity_id, group);
  }

  const toArchive: string[] = [];
  const toMark: string[] = [];
  const now = new Date().toISOString();

  for (const [entityId, group] of byEntity) {
    if (group.length < 2) {
      toMark.push(group[0].id);
      continue;
    }

    const dominated = new Set<string>();

    for (let i = 0; i < group.length; i++) {
      const fi = group[i];
      if (dominated.has(fi.id)) continue;

      for (let j = i + 1; j < group.length; j++) {
        const fj = group[j];
        if (dominated.has(fj.id)) continue;

        const score = diceCoefficient(fi.fact, fj.fact);
        if (score >= threshold) {
          const [keep, drop] = pickWinner(fi, fj);
          dominated.add(drop.id);

          onProgress?.(
            `[${entityId}] ${(score * 100).toFixed(0)}% match:\n` +
              `  keep: "${keep.fact}"\n` +
              `  drop: "${drop.fact}"`,
          );

          toArchive.push(drop.id);
        }
      }
    }

    for (const f of group) {
      if (!dominated.has(f.id)) toMark.push(f.id);
    }
  }

  if (!dryRun && (toArchive.length > 0 || toMark.length > 0)) {
    const tx = db.transaction(() => {
      const archiveStmt = db.prepare("UPDATE facts SET status = 'archived' WHERE id = ?");
      for (const id of toArchive) archiveStmt.run(id);

      const markStmt = db.prepare('UPDATE facts SET compacted_at = ? WHERE id = ?');
      for (const id of toMark) markStmt.run(now, id);
    });
    tx();
  }

  onProgress?.(
    dryRun
      ? `Dry run: would archive ${toArchive.length} duplicates, mark ${toMark.length} as compacted`
      : `Archived ${toArchive.length} duplicates, marked ${toMark.length} as compacted`,
  );

  return { archived: toArchive.length, processed: toMark.length };
}

function pickWinner(a: FactRow, b: FactRow): [FactRow, FactRow] {
  if (a.access_count !== b.access_count) {
    return a.access_count > b.access_count ? [a, b] : [b, a];
  }
  return a.last_accessed >= b.last_accessed ? [a, b] : [b, a];
}

function recalculateTiers(
  db: Database.Database,
  tiers: TierConfig,
  dryRun: boolean,
  onProgress?: (msg: string) => void,
): number {
  const facts = db
    .prepare(
      "SELECT id, last_accessed, access_count, tier, compacted_at FROM facts WHERE status = 'active'",
    )
    .all() as FactRow[];

  const updates: { id: string; newTier: string; resetCompacted: boolean }[] = [];

  for (const f of facts) {
    const newTier = computeTier(f.last_accessed, f.access_count, tiers);
    if (newTier !== f.tier) {
      const resetCompacted = newTier === 'cold' && f.tier !== 'cold';
      updates.push({ id: f.id, newTier, resetCompacted });
    }
  }

  if (!dryRun && updates.length > 0) {
    const tx = db.transaction(() => {
      const resetStmt = db.prepare('UPDATE facts SET tier = ?, compacted_at = NULL WHERE id = ?');
      const keepStmt = db.prepare('UPDATE facts SET tier = ? WHERE id = ?');
      for (const u of updates) {
        if (u.resetCompacted) resetStmt.run(u.newTier, u.id);
        else keepStmt.run(u.newTier, u.id);
      }
    });
    tx();
  }

  onProgress?.(
    dryRun
      ? `Dry run: would update ${updates.length} tier assignments`
      : `Updated ${updates.length} tier assignments`,
  );

  return updates.length;
}
