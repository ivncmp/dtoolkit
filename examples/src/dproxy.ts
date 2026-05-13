/**
 * @dtoolkit/sdk — dproxy client examples
 *
 * Demonstrates: health check, batch ask, streaming, history,
 * memory management, and provider selection.
 *
 * Requires a running dproxy server (default: http://localhost:7880).
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run dproxy
 */

import { DProxyClient, SdkError } from "@dtoolkit/sdk";

const dproxy = new DProxyClient(
  process.env.DPROXY_URL ?? "http://localhost:7880",
  process.env.DPROXY_TOKEN || undefined,
);

// ── Health ──────────────────────────────────────────────────────────

async function healthCheck(): Promise<void> {
  const health = await dproxy.health();
  console.log(
    `dproxy v${health.version} is ${health.status} (provider: ${health.provider})`,
  );
}

// ── Ask (batch) ─────────────────────────────────────────────────────

async function askBatch(): Promise<void> {
  console.log("\n--- Batch ask ---");

  const answer = await dproxy.ask("What is 2+2? Reply with just the number.");
  console.log(`Answer: ${answer.text}`);
  console.log(`  Duration: ${answer.durationMs}ms`);
  if (answer.usage) {
    console.log(
      `  Tokens: ${answer.usage.inputTokens} in / ${answer.usage.outputTokens} out`,
    );
  }
}

// ── Ask (streaming) ─────────────────────────────────────────────────

async function askStreaming(): Promise<void> {
  console.log("\n--- Streaming ask ---");

  process.stdout.write("Response: ");
  for await (const event of dproxy.askStream(
    "Count from 1 to 5, one number per line.",
  )) {
    if (event.type === "text") {
      process.stdout.write(event.text ?? "");
    }
    if (event.type === "result" && event.result) {
      console.log(`\n  Duration: ${event.result.durationMs}ms`);
    }
  }
}

// ── Ask with options ────────────────────────────────────────────────

async function askWithOptions(): Promise<void> {
  console.log("\n--- Ask with system prompt ---");

  const answer = await dproxy.ask("Who are you?", {
    systemPrompt: "You are a helpful pirate. Keep it under 20 words.",
    saveHistory: false,
  });
  console.log(`Answer: ${answer.text}`);
}

// ── History ─────────────────────────────────────────────────────────

async function history(): Promise<void> {
  console.log("\n--- History ---");

  const entries = await dproxy.listHistory(3);
  console.log(`Recent entries (${entries.length}):`);
  for (const h of entries) {
    const prompt =
      h.prompt.length > 60 ? h.prompt.slice(0, 57) + "..." : h.prompt;
    console.log(`  [${h.id.slice(0, 8)}] ${prompt}`);
  }

  if (entries.length > 0) {
    const full = await dproxy.getHistory(entries[0].id);
    console.log(`\nFull entry: ${full.prompt}`);
    console.log(
      `  Result: ${full.result.slice(0, 80)}${full.result.length > 80 ? "..." : ""}`,
    );
  }
}

// ── Memory ──────────────────────────────────────────────────────────

async function memory(): Promise<void> {
  console.log("\n--- Memory ---");

  await dproxy.setMemory("sdk-example", "This was written by the SDK examples");
  console.log("Wrote memory: sdk-example");

  const keys = await dproxy.listMemoryKeys();
  console.log(`Memory keys: ${keys.join(", ")}`);

  const content = await dproxy.getMemory("sdk-example");
  console.log(`Read back: ${content}`);

  const results = await dproxy.searchMemory("SDK");
  console.log(`Search "SDK": ${results.length} results`);

  await dproxy.deleteMemory("sdk-example");
  console.log("Deleted memory: sdk-example");
}

// ── Run ─────────────────────────────────────────────────────────────

try {
  await healthCheck();
  await askBatch();
  await askStreaming();
  await askWithOptions();
  await history();
  await memory();
} catch (err) {
  if (err instanceof SdkError) {
    console.error(`\nAPI error: HTTP ${err.status} on ${err.path}`);
    console.error(`  ${err.body}`);
  } else {
    console.error("\nError:", (err as Error).message);
  }
  process.exit(1);
}
