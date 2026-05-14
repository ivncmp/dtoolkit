import { DBrainClient } from '@dtoolkit/sdk';

import type { DcontextConfig } from './config.js';


function cleanDocContent(content: string, sectionTitle: string): string {
  const lines = content.split('\n');
  const cleaned: string[] = [];
  let prevEmpty = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#+\s*/, '').trim().toLowerCase();
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
): Promise<string | null> {
  const client = new DBrainClient(config.dbrain.url, config.dbrain.token);

  const safeQuery = `"${projectEntity}"`;
  const [results, documents] = await Promise.all([
    client.search(safeQuery, { limit: config.briefing.maxFacts }).catch(() => []),
    config.briefing.includeIdentity ? client.listDocuments() : Promise.resolve([]),
  ]);

  if (results.length === 0 && documents.length === 0) return null;

  const parts: string[] = [];
  parts.push('## Session Context (from dbrain)');
  parts.push('> **DO NOT call `recall` or `wake_up`.** Your identity, soul, user profile, and project facts are already below. This context was injected by dcontext at session start.');

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

  let briefing = parts.join('\n');
  if (briefing.length > config.briefing.maxChars) {
    briefing = briefing.slice(0, config.briefing.maxChars - 3) + '…';
  }

  return briefing;
}
