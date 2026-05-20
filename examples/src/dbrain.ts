/**
 * @dtoolkit/sdk — dbrain client examples
 *
 * Demonstrates: health check, entity listing, search, memory summary,
 * entity creation, fact management, and federation.
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run dbrain
 */

import { DBrainClient, SdkError } from "@dtoolkit/sdk";

const dbrain = new DBrainClient(
  process.env.DBRAIN_URL ?? "http://localhost:7878",
  process.env.DBRAIN_TOKEN ?? "changeme",
);

// ── Health ──────────────────────────────────────────────────────────

async function healthCheck(): Promise<void> {
  const health = await dbrain.health();
  console.log(`Brain "${health.name}" v${health.version} is ${health.status}`);
  console.log(
    `  ${health.entities} entities, ${health.facts} facts, ${health.conversations} conversations`,
  );
  console.log(`  ${health.unprocessed} unprocessed messages`);
}

// ── Entities ────────────────────────────────────────────────────────

async function listEntities(): Promise<void> {
  const entities = await dbrain.listEntities();
  console.log(`\nEntities (${entities.length}):`);
  for (const e of entities.slice(0, 5)) {
    console.log(`  [${e.category}/${e.type}] ${e.name}`);
  }
  if (entities.length > 5)
    console.log(`  ... and ${entities.length - 5} more`);

  const projects = await dbrain.listEntities({ category: "projects" });
  console.log(`\nProjects: ${projects.map((p) => p.name).join(", ")}`);
}

// ── Search ──────────────────────────────────────────────────────────

async function searchFacts(): Promise<void> {
  const results = await dbrain.search("typescript", { limit: 3 });
  console.log(`\nSearch "typescript" (${results.length} results):`);
  for (const r of results) {
    console.log(`  [${r.entity.name}] ${r.fact.fact}`);
  }
}

// ── Memory summary ──────────────────────────────────────────────────

async function memorySummary(): Promise<void> {
  const summary = await dbrain.memorySummary();
  console.log(`\nMemory summary (${summary.length} entities):`);
  for (const row of summary.slice(0, 5)) {
    console.log(
      `  ${row.name}: ${row.total} facts (hot:${row.hot} warm:${row.warm} cold:${row.cold})`,
    );
  }
}

// ── Create entity + facts ───────────────────────────────────────────

async function createEntityWithFacts(): Promise<void> {
  const id = `example-${Date.now()}`;

  const entity = await dbrain.createEntity({
    id,
    name: "SDK Example",
    type: "project",
    category: "projects",
    metadata: { source: "examples/src/dbrain.ts" },
  });
  console.log(`\nCreated entity: ${entity.name} (${entity.id})`);

  const fact = await dbrain.addFact(id, {
    id: `${id}-fact-1`,
    fact: "This entity was created by the SDK examples",
    source: "sdk-example",
  });
  console.log(`  Added fact: ${fact.fact}`);

  const bumped = await dbrain.bumpFact(fact.id);
  console.log(`  Bumped: ${bumped.bumped}`);

  const full = await dbrain.getEntity(id);
  console.log(
    `  Entity has ${full.facts.length} facts, type: ${full.type}, category: ${full.category}`,
  );

  await dbrain.archiveEntity(id);
  console.log(`  Archived entity ${id}`);
}

// ── Conversations ───────────────────────────────────────────────────

async function conversations(): Promise<void> {
  const convos = await dbrain.listConversations({ limit: 3 });
  console.log(`\nRecent conversations (${convos.length}):`);
  for (const c of convos) {
    console.log(`  [${c.source}] ${c.id} — ${c.started_at}`);
  }
}

// ── Federation ─────────────────────────────────────────────────────

async function federation(): Promise<void> {
  const health = await dbrain.health();
  console.log(`\nFederation:`);
  console.log(`  Brain type: ${health.brainType ?? "personal"}`);
  console.log(`  Connected brains: ${health.connectedBrains ?? 0}`);

  const connections = await dbrain.listConnections();
  for (const c of connections) {
    const status = c.online ? "online" : "offline";
    console.log(
      `  ${c.name} (${status})${c.brainName ? ` — ${c.brainName}` : ""}`,
    );
  }

  if (connections.length === 0) {
    console.log("  No connections (use `dbrain link` to connect to a shared brain)");
    return;
  }

  const federated = await dbrain.searchFederated("typescript");
  console.log(
    `\n  Federated search "typescript": ${federated.results.length} results from ${federated.federation.sources.length} sources`,
  );
  for (const r of federated.results.slice(0, 3)) {
    const origin = r.originBrain ?? "local";
    console.log(`    [${origin}] ${r.fact.fact}`);
  }
}

// ── Run ─────────────────────────────────────────────────────────────

try {
  await healthCheck();
  await listEntities();
  await searchFacts();
  await memorySummary();
  await createEntityWithFacts();
  await conversations();
  await federation();
} catch (err) {
  if (err instanceof SdkError) {
    console.error(`\nAPI error: HTTP ${err.status} on ${err.path}`);
    console.error(`  ${err.body}`);
  } else {
    console.error("\nError:", (err as Error).message);
  }
  process.exit(1);
}
