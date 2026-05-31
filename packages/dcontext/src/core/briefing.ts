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
  const dwork = config.dwork?.url ? new DWorkClient(config.dwork.url, config.dwork.token) : null;

  if (dwork && dworkSlugs && dworkSlugs.length > 0) {
    try {
      const allTasks = (
        await Promise.all(dworkSlugs.map((slug) => dwork.listTasks(slug).catch(() => [])))
      ).flat();
      const active = allTasks.filter(
        (t) => t.status === 'doing' || t.status === 'blocked' || t.status === 'todo',
      );
      if (active.length > 0) {
        parts.push('');
        parts.push(`### Tasks (dwork)`);
        parts.push(
          '> Active tasks are listed below. **Do NOT call `get_tasks` or `list_projects` unless the user explicitly asks.** Use `update_task` only when the user requests a status change.',
        );
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

  if (dwork) {
    try {
      const graphs = await dwork.listGraphs();
      if (graphs.length > 0) {
        parts.push('');
        parts.push('### Code Intelligence (codegraph)');
        parts.push(
          '> Code graph available via dwork MCP: `graph_search`, `graph_trace`, `graph_impact`, `graph_context`',
        );

        for (const g of graphs) {
          const synced = g.synced_at?.split('T')[0] ?? '';
          parts.push(
            `- **${g.name}**: ${g.node_count} symbols, ${g.edge_count} edges, ${g.file_count} files${synced ? ` (synced ${synced})` : ''}`,
          );

          try {
            const [graphStats, subgraph, deadCode, circular] = await Promise.all([
              dwork.graphStats(g.name).catch(() => null),
              dwork.graphGetSubgraph(g.name, { limit: 50 }).catch(() => null),
              dwork.graphDeadCode(g.name, 'function,method').catch(() => null),
              dwork.graphCircularDependencies(g.name).catch(() => null),
            ]);

            if (graphStats?.nodesByKind) {
              const kindEntries = Object.entries(graphStats.nodesByKind)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${v} ${k}s`)
                .join(', ');
              parts.push(`  Composition: ${kindEntries}`);
            }

            if (subgraph?.roots && subgraph.roots.length > 0) {
              const hubNodes = subgraph.roots
                .slice(0, 8)
                .map((rootId) => subgraph.nodes.find((n) => n.id === rootId))
                .filter((n): n is NonNullable<typeof n> => n != null);
              if (hubNodes.length > 0) {
                const hubNames = hubNodes.map((n) => `\`${n.name}\``).join(', ');
                parts.push(`  Key hubs: ${hubNames}`);
              }
            }

            if (circular && circular.length > 0) {
              parts.push(
                `  ⚠ ${circular.length} circular dep${circular.length > 1 ? 's' : ''}: ${circular
                  .slice(0, 3)
                  .map((c) => c.join(' → '))
                  .join('; ')}`,
              );
            }

            if (deadCode && deadCode.length > 0) {
              const deadNames = deadCode
                .slice(0, 5)
                .map((n) => `\`${n.name}\``)
                .join(', ');
              const extra = deadCode.length > 5 ? ` (+${deadCode.length - 5} more)` : '';
              parts.push(`  ⚠ ${deadCode.length} unreachable: ${deadNames}${extra}`);
            }
          } catch {
            // enrichment failed, basic stats are enough
          }
        }
      }
    } catch {
      // dwork unavailable for graphs, skip
    }
  }

  let briefing = parts.join('\n');
  if (briefing.length > config.briefing.maxChars) {
    briefing = briefing.slice(0, config.briefing.maxChars - 3) + '…';
  }

  return briefing;
}
