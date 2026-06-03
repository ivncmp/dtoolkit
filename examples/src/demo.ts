/**
 * @dtoolkit — Full demo
 *
 * Runs dbrain, dproxy, dwork, and dops examples end-to-end.
 * Use the individual scripts to run them separately.
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run demo
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { InputFile } from "@dtoolkit/sdk";
import { DBrainClient, DOpsClient, DProxyClient, DWorkClient, SdkError } from "@dtoolkit/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = resolve(__dirname, "../samples");

const dbrain = new DBrainClient(
  process.env.DBRAIN_URL ?? "http://localhost:7878",
  process.env.DBRAIN_TOKEN ?? "changeme",
);
const dproxy = new DProxyClient(
  process.env.DPROXY_URL ?? "http://localhost:7880",
  process.env.DPROXY_TOKEN || undefined,
);
const dwork = new DWorkClient(
  process.env.DWORK_URL ?? "http://localhost:7881",
  process.env.DWORK_TOKEN ?? "changeme",
);
const dops = new DOpsClient(
  process.env.DOPS_URL ?? "http://localhost:7883",
  process.env.DOPS_TOKEN ?? "changeme",
);

const passed: string[] = [];
const failed: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed.push(name);
    console.log(`  OK  ${name}`);
  } catch (err) {
    failed.push(name);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(err as Error).message}`);
  }
}

function section(title: string): void {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(50)}\n`);
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

try {
  // ── dbrain ──────────────────────────────────────────────────────

  section("dbrain");

  await test("Health check", async () => {
    const h = await dbrain.health();
    console.log(`        "${h.name}" v${h.version} — ${h.entities} entities, ${h.facts} facts`);
  });

  await test("List entities", async () => {
    const entities = await dbrain.listEntities();
    console.log(`        Found ${entities.length} entities`);
    for (const e of entities.slice(0, 3)) {
      console.log(`        - [${e.category}/${e.type}] ${e.name}`);
    }
  });

  await test("Full-text search", async () => {
    const results = await dbrain.search("projects", { limit: 3 });
    console.log(`        Query "projects" returned ${results.length} results`);
  });

  // ── dproxy ─────────────────────────────────────────────────────

  section("dproxy");

  await test("Health check", async () => {
    const h = await dproxy.health();
    console.log(`        v${h.version}, provider: ${h.provider}`);
  });

  await test("Batch ask", async () => {
    const prompt = "What is 2+2? Reply with just the number.";
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt);
    console.log(`        Answer:   "${a.text.trim()}"  (${a.durationMs}ms)`);
  });

  await test("Streaming", async () => {
    const prompt = "Count from 1 to 5, one number per line.";
    console.log(`        Prompt:   "${prompt}"`);
    const chunks: string[] = [];
    for await (const ev of dproxy.askStream(prompt)) {
      if (ev.type === "text" && ev.text) chunks.push(ev.text);
    }
    const text = chunks.join("").trim();
    console.log(`        Answer:   "${text.replace(/\n/g, ", ")}"`);
    console.log(`        Chunks:   ${chunks.length}`);
  });

  await test("System prompt override", async () => {
    const prompt = "Who are you?";
    const systemPrompt = "You are a helpful pirate. Keep it under 20 words.";
    console.log(`        System:   "${systemPrompt}"`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, { systemPrompt, saveHistory: false });
    console.log(`        Answer:   "${a.text.trim()}"`);
  });

  // ── files ──────────────────────────────────────────────────────

  section("dproxy + files");

  await test("Text file (inline TypeScript)", async () => {
    const file: InputFile = {
      name: "example.ts",
      mimeType: "application/typescript",
      data: `const greeting = "hello";\nconsole.log(greeting);`,
    };
    const prompt = "What does this code print? Reply with just the output.";
    console.log(`        File:     ${file.name} (${fileSize(file.data.length)})`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, { files: [file] });
    console.log(`        Answer:   "${a.text.trim()}"`);
  });

  await test("Multiple text files", async () => {
    const files: InputFile[] = [
      {
        name: "add.ts",
        mimeType: "application/typescript",
        data: `export function add(a: number, b: number): number { return a + b; }`,
      },
      {
        name: "add.test.ts",
        mimeType: "application/typescript",
        data: `import { add } from "./add";\nconsole.log(add(3, 4));`,
      },
    ];
    const prompt = "What number does add.test.ts print? Reply with just the number.";
    console.log(`        Files:    ${files.map((f) => f.name).join(", ")}`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, { files });
    console.log(`        Answer:   "${a.text.trim()}"`);
  });

  await test("Image file (PNG)", async () => {
    const path = resolve(SAMPLES_DIR, "logo.png");
    const [data, info] = await Promise.all([readFile(path), stat(path)]);
    const prompt = "Describe this image in one sentence.";
    console.log(`        File:     logo.png (${fileSize(info.size)})`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, {
      files: [{ name: "logo.png", mimeType: "image/png", data: data.toString("base64") }],
    });
    console.log(`        Answer:   "${a.text.trim().slice(0, 120)}"`);
  });

  await test("PDF file", async () => {
    const path = resolve(SAMPLES_DIR, "sample.pdf");
    const [data, info] = await Promise.all([readFile(path), stat(path)]);
    const prompt = "What text does this PDF contain? Reply with just the text.";
    console.log(`        File:     sample.pdf (${fileSize(info.size)})`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, {
      files: [{ name: "sample.pdf", mimeType: "application/pdf", data: data.toString("base64") }],
    });
    console.log(`        Answer:   "${a.text.trim()}"`);
  });

  await test("Mixed files (code + image)", async () => {
    const imgData = await readFile(resolve(SAMPLES_DIR, "logo.png"));
    const files: InputFile[] = [
      { name: "logo.png", mimeType: "image/png", data: imgData.toString("base64") },
      { name: "caption.txt", mimeType: "text/plain", data: "This is the official dtoolkit logo." },
    ];
    const prompt = "Does the caption.txt accurately describe the image? Reply yes or no.";
    console.log(`        Files:    ${files.map((f) => f.name).join(", ")}`);
    console.log(`        Prompt:   "${prompt}"`);
    const a = await dproxy.ask(prompt, { files });
    console.log(`        Answer:   "${a.text.trim()}"`);
  });

  // ── dwork ──────────────────────────────────────────────────────

  section("dwork");

  await test("Health check", async () => {
    const h = await dwork.health();
    console.log(`        v${h.version} — ${h.projects} projects, ${h.tasks} tasks`);
  });

  let dworkSlug = "";

  await test("Create project", async () => {
    dworkSlug = `demo-${Date.now()}`;
    const p = await dwork.createProject({ slug: dworkSlug, name: "Demo Project" });
    console.log(`        Created: ${p.name} (${p.slug})`);
  });

  await test("Add + update tasks", async () => {
    const t = await dwork.addTask(dworkSlug, { title: "Demo task", priority: "P1" });
    console.log(`        Added: ${t.title} (${t.id})`);
    await dwork.updateTask(t.id, { status: "doing" });
    const tasks = await dwork.listTasks(dworkSlug, { status: "doing" });
    console.log(`        Doing: ${tasks.length} task(s)`);
  });

  await test("Search", async () => {
    const results = await dwork.search("Demo", { project: dworkSlug });
    console.log(`        "Demo" returned ${results.length} results`);
  });

  await test("Overview + next", async () => {
    const o = await dwork.overview();
    console.log(`        ${o.totalProjects} projects, ${o.totalTasks} tasks`);
    const next = await dwork.whatToDoNext(dworkSlug);
    console.log(`        Next up: ${next.length} task(s)`);
  });

  await test("Cleanup project", async () => {
    await dwork.deleteProject(dworkSlug);
    console.log(`        Deleted: ${dworkSlug}`);
  });

  // ── dops ──────────────────────────────────────────────────────

  section("dops");

  await test("Health check", async () => {
    const h = await dops.health();
    console.log(`        v${h.version} — ${h.stats.sessions} sessions`);
  });

  let dopsSessionId = "";

  await test("Create session + ingest data", async () => {
    const { id } = await dops.createSession({
      source: "demo",
      model: "claude-sonnet-4-6",
    });
    dopsSessionId = id;
    console.log(`        Session: ${id}`);

    await dops.recordTokenUsage({
      session_id: id,
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 400,
      cache_read: 500,
    });

    await dops.recordToolCall({
      session_id: id,
      tool_name: "Read",
      success: true,
      duration_ms: 15,
    });

    await dops.endSession(id, { status: "completed" });
    console.log(`        Ingested tokens + tool call, session completed`);
  });

  await test("Query stats", async () => {
    const tools = await dops.toolStats();
    console.log(`        ${tools.length} tool(s) tracked`);
    const models = await dops.modelStats();
    console.log(`        ${models.length} model(s) tracked`);
  });

  await test("Session detail", async () => {
    const d = await dops.getSession(dopsSessionId);
    console.log(
      `        ${d.token_usage.length} token record(s), ${d.tool_calls.length} tool call(s)`,
    );
  });

  // ── summary ────────────────────────────────────────────────────

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Results: ${passed.length} passed, ${failed.length} failed`);
  console.log(`${"=".repeat(50)}\n`);

  if (failed.length > 0) {
    process.exit(1);
  }
} catch (err) {
  if (err instanceof SdkError) {
    console.error(`\nAPI error: HTTP ${err.status} on ${err.path}\n  ${err.body}`);
  } else {
    console.error("\nError:", (err as Error).message);
  }
  process.exit(1);
}
