/**
 * @dtoolkit/sdk — dproxy client examples
 *
 * Demonstrates: health check, batch ask, streaming, file attachments
 * (text, images, PDFs), history, and memory management.
 *
 * Requires a running dproxy server (default: http://localhost:7880).
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm install
 *   npm run dproxy
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { InputFile } from "@dtoolkit/sdk";
import { DProxyClient } from "@dtoolkit/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = resolve(__dirname, "../samples");

const dproxy = new DProxyClient(
  process.env.DPROXY_URL ?? "http://localhost:7880",
  process.env.DPROXY_TOKEN || undefined,
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

// ── Ask ────────────────────────────────────────────────────────────

section("Ask");

await test("Health check", async () => {
  const h = await dproxy.health();
  console.log(`        v${h.version}, provider: ${h.provider}`);
});

await test("Batch ask", async () => {
  const prompt = "What is 2+2? Reply with just the number.";
  console.log(`        Prompt:   "${prompt}"`);
  const a = await dproxy.ask(prompt);
  console.log(`        Answer:   "${a.text.trim()}"  (${a.durationMs}ms)`);
  if (a.usage) {
    console.log(`        Tokens:   ${a.usage.inputTokens} in / ${a.usage.outputTokens} out`);
  }
});

await test("Streaming", async () => {
  const prompt = "Count from 1 to 5, one number per line.";
  console.log(`        Prompt:   "${prompt}"`);
  const chunks: string[] = [];
  let durationMs = 0;
  for await (const ev of dproxy.askStream(prompt)) {
    if (ev.type === "text" && ev.text) chunks.push(ev.text);
    if (ev.type === "result" && ev.result) durationMs = ev.result.durationMs;
  }
  const text = chunks.join("").trim();
  console.log(`        Answer:   "${text.replace(/\n/g, ", ")}"`);
  console.log(`        Chunks:   ${chunks.length}  (${durationMs}ms)`);
});

await test("System prompt override", async () => {
  const systemPrompt = "You are a helpful pirate. Keep it under 20 words.";
  const prompt = "Who are you?";
  console.log(`        System:   "${systemPrompt}"`);
  console.log(`        Prompt:   "${prompt}"`);
  const a = await dproxy.ask(prompt, { systemPrompt, saveHistory: false });
  console.log(`        Answer:   "${a.text.trim()}"`);
});

// ── Files ──────────────────────────────────────────────────────────

section("Files");

await test("Single text file", async () => {
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
      name: "math.ts",
      mimeType: "application/typescript",
      data: `export const multiply = (a: number, b: number) => a * b;`,
    },
    {
      name: "main.ts",
      mimeType: "application/typescript",
      data: `import { multiply } from "./math";\nconsole.log(multiply(6, 7));`,
    },
  ];
  const prompt = "What number does main.ts print? Reply with just the number.";
  console.log(`        Files:    ${files.map((f) => f.name).join(", ")}`);
  console.log(`        Prompt:   "${prompt}"`);
  const a = await dproxy.ask(prompt, { files });
  console.log(`        Answer:   "${a.text.trim()}"`);
});

await test("JSON file", async () => {
  const file: InputFile = {
    name: "package.json",
    mimeType: "application/json",
    data: JSON.stringify({ name: "@dtoolkit/sdk", version: "1.0.0", license: "MIT" }),
  };
  const prompt = "What is the package name and version? Reply in format: name@version";
  console.log(`        File:     ${file.name} (${fileSize(file.data.length)})`);
  console.log(`        Prompt:   "${prompt}"`);
  const a = await dproxy.ask(prompt, { files: [file] });
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

await test("Mixed: text + image", async () => {
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

// ── History ────────────────────────────────────────────────────────

section("History");

await test("List recent entries", async () => {
  const entries = await dproxy.listHistory(3);
  console.log(`        Found ${entries.length} recent entries`);
  for (const h of entries) {
    const prompt = h.prompt.length > 50 ? h.prompt.slice(0, 47) + "..." : h.prompt;
    console.log(`        - [${h.id.slice(0, 8)}] "${prompt}"`);
  }
});

await test("Fetch full entry", async () => {
  const entries = await dproxy.listHistory(1);
  if (entries.length === 0) throw new Error("No history entries to fetch");
  const full = await dproxy.getHistory(entries[0].id);
  console.log(`        Prompt:   "${full.prompt.slice(0, 60)}${full.prompt.length > 60 ? "..." : ""}"`);
  console.log(`        Result:   "${full.result.slice(0, 60)}${full.result.length > 60 ? "..." : ""}"`);
});

// ── Memory ─────────────────────────────────────────────────────────

section("Memory");

await test("Write, read, search, delete", async () => {
  await dproxy.setMemory("sdk-test", "This was written by the SDK demo");
  console.log(`        Write:    sdk-test`);

  const content = await dproxy.getMemory("sdk-test");
  console.log(`        Read:     "${content}"`);

  const keys = await dproxy.listMemoryKeys();
  console.log(`        Keys:     ${keys.join(", ")}`);

  const results = await dproxy.searchMemory("SDK");
  console.log(`        Search:   "SDK" -> ${results.length} results`);

  await dproxy.deleteMemory("sdk-test");
  console.log(`        Delete:   sdk-test`);
});

// ── Summary ────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`  Results: ${passed.length} passed, ${failed.length} failed`);
if (failed.length > 0) {
  console.log(`  Failed: ${failed.join(", ")}`);
}
console.log(`${"=".repeat(50)}\n`);

if (failed.length > 0) {
  process.exit(1);
}
