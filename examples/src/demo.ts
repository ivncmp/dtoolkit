/**
 * @dtoolkit/sdk — Full demo
 *
 * Runs both dbrain and dproxy examples end-to-end.
 * Use the individual scripts (dbrain.ts, dproxy.ts) to run them separately.
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run demo
 */

import { DBrainClient, DProxyClient, SdkError } from "@dtoolkit/sdk";

const dbrain = new DBrainClient(
  process.env.DBRAIN_URL ?? "http://localhost:7878",
  process.env.DBRAIN_TOKEN ?? "changeme",
);
const dproxy = new DProxyClient(
  process.env.DPROXY_URL ?? "http://localhost:7880",
  process.env.DPROXY_TOKEN || undefined,
);

try {
  // ── dbrain ──────────────────────────────────────────────────────

  console.log("=== dbrain ===\n");

  const brain = await dbrain.health();
  console.log(`Brain "${brain.name}" v${brain.version} — ${brain.entities} entities, ${brain.facts} facts`);

  const entities = await dbrain.listEntities();
  console.log(`\nEntities (${entities.length}):`);
  for (const e of entities.slice(0, 5)) {
    console.log(`  [${e.category}/${e.type}] ${e.name}`);
  }
  if (entities.length > 5) console.log(`  ... and ${entities.length - 5} more`);

  const results = await dbrain.search("projects", { limit: 3 });
  console.log(`\nSearch "projects" (${results.length} results):`);
  for (const r of results) {
    console.log(`  [${r.entity.name}] ${r.fact.fact}`);
  }

  // ── dproxy ─────────────────────────────────────────────────────

  console.log("\n=== dproxy ===\n");

  const proxy = await dproxy.health();
  console.log(`dproxy v${proxy.version} — provider: ${proxy.provider}`);

  const answer = await dproxy.ask("What is 2+2? Reply with just the number.");
  console.log(`\nAsk: ${answer.text} (${answer.durationMs}ms)`);

  process.stdout.write("\nStream: ");
  for await (const event of dproxy.askStream("Count from 1 to 5, one per line.")) {
    if (event.type === "text") process.stdout.write(event.text ?? "");
  }
  console.log();
} catch (err) {
  if (err instanceof SdkError) {
    console.error(`\nAPI error: HTTP ${err.status} on ${err.path}\n  ${err.body}`);
  } else {
    console.error("\nError:", (err as Error).message);
  }
  process.exit(1);
}
