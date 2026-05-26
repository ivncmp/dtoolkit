import { DBrainClient, DWorkClient } from '@dtoolkit/sdk';

import type { DcontextConfig } from './config.js';

function cleanDocContent(content: string, sectionTitle: string): string {
  const lines = content.split('\n');
  const cleaned: string[] = [];
  let prevEmpty = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      const headerText = trimmed
        .replace(/^#+\s*/, '')
        .trim()
        .toLowerCase();
      if (headerText === sectionTitle.toLowerCase()) continue;
    }

    if (trimmed === '') {
      if (prevEmpty) continue;
      prevEmpty = true;
    } else {
      prevEmpty = false;
    }

    cleaned.push(line);
  }

  while (cleaned.length > 0 && cleaned[0].trim() === '') cleaned.shift();
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') cleaned.pop();

  return cleaned.join('\n');
}

function truncateFact(fact: string, max: number): string {
  if (fact.length <= max) return fact;
  return fact.slice(0, max - 1) + '…';
}

export async function generateBriefing(
  projectEntity: string,
  config: DcontextConfig,
  cwd?: string,
): Promise<string | null> {
  const client = new DBrainClient(config.dbrain.url, config.dbrain.token);

  const safeQuery = `"${projectEntity}"`;
  const [results, documents, health] = await Promise.all([
    client.search(safeQuery, { limit: config.briefing.maxFacts }).catch(() => []),
    config.briefing.includeIdentity ? client.listDocuments() : Promise.resolve([]),
    client.health().catch(() => null),
  ]);

  if (results.length === 0 && documents.length === 0) return null;

  const parts: string[] = [];
  parts.push('## Session Context (from dbrain)');
  parts.push(
    '> **DO NOT call `recall` or `wake_up`.** Your identity, soul, user profile, and project facts are already below. This context was injected by dcontext at session start.',
  );

  // identity docs first — they're short and always relevant
  if (config.briefing.includeIdentity && documents.length > 0) {
    const identityDocs = documents.filter(
      (d) => d.key === 'identity' || d.key === 'user' || d.key === 'soul',
    );
    for (const doc of identityDocs) {
      try {
        const full = await client.getDocument(doc.key);
        if (full.content) {
          const title = doc.title || doc.key;
          const cleaned = cleanDocContent(full.content, title);
          if (cleaned) {
            parts.push('');
            parts.push(`### ${title}`);
            parts.push(cleaned);
          }
        }
      } catch {
        // skip if individual doc fails
      }
    }
  }

  // project facts after — truncated to keep space
  if (results.length > 0) {
    parts.push('');
    parts.push(`### Project: ${projectEntity}`);
    for (const r of results) {
      const category = r.fact.category || 'context';
      parts.push(`- [${category}] ${truncateFact(r.fact.fact, config.briefing.maxCharsPerFact)}`);
    }
  }

  if (health && health.connectedBrains && health.connectedBrains > 0) {
    try {
      const connections = await client.listConnections();
      parts.push('');
      parts.push(`### Connected Brains (${connections.length})`);
      for (const conn of connections) {
        const status = conn.online ? 'online' : 'offline';
        parts.push(`- **${conn.name}** (${status})${conn.brainName ? ` — ${conn.brainName}` : ''}`);
      }
      parts.push('');
      parts.push(
        '> `recall` automatically searches these brains. Use `share` to push a fact to a connected brain.',
      );
    } catch {
      // skip if connections endpoint fails
    }
  }

  const dworkSlugs = cwd ? config.dworkProjects?.[cwd] : undefined;
  if (config.dwork?.url && dworkSlugs && dworkSlugs.length > 0) {
    try {
      const dwork = new DWorkClient(config.dwork.url, config.dwork.token);
      const allTasks = (
        await Promise.all(dworkSlugs.map((slug) => dwork.listTasks(slug).catch(() => [])))
      ).flat();
      const active = allTasks.filter(
        (t) => t.status === 'doing' || t.status === 'blocked' || t.status === 'todo',
      );
      if (active.length > 0) {
        parts.push('');
        parts.push(`### Tasks (dwork)`);
        const doing = active.filter((t) => t.status === 'doing');
        const blocked = active.filter((t) => t.status === 'blocked');
        const todo = active.filter((t) => t.status === 'todo');
        for (const group of [
          { label: 'doing', items: doing },
          { label: 'blocked', items: blocked },
          { label: 'todo', items: todo },
        ]) {
          for (const t of group.items) {
            const project = t.project_slug;
            const meta = [t.priority, t.estimate, t.deadline].filter(Boolean).join(', ');
            parts.push(
              `- [${group.label}] ${t.id} ${project}: ${truncateFact(t.title, 100)}${meta ? ` (${meta})` : ''}`,
            );
          }
        }
      }
    } catch {
      // dwork unavailable, skip
    }
  }

  let briefing = parts.join('\n');
  if (briefing.length > config.briefing.maxChars) {
    briefing = briefing.slice(0, config.briefing.maxChars - 3) + '…';
  }

  return briefing;
}
