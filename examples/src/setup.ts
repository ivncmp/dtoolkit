/**
 * @dtoolkit/sdk — Setup script
 *
 * Full lifecycle: init a temporary dbrain, start dbrain + dproxy,
 * run the specified example, then tear everything down.
 *
 * Usage:
 *   npm run setup              # starts servers + runs demo
 *   npm run setup -- dbrain    # starts servers + runs dbrain example
 *   npm run setup -- dproxy    # starts servers + runs dproxy example
 */

import type { ChildProcess } from "node:child_process";

import { spawn, execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, "..");
const ROOT = resolve(EXAMPLES_DIR, "..");
const DBRAIN_BIN = resolve(ROOT, "packages/dbrain/dist/cli/index.js");
const DPROXY_BIN = resolve(ROOT, "packages/dproxy/dist/index.js");
const DWORK_BIN = resolve(ROOT, "packages/dwork/dist/cli/index.js");
const DOPS_BIN = resolve(ROOT, "packages/dops/dist/cli/index.js");

const DBRAIN_PORT = 7878;
const DPROXY_PORT = 7880;
const DWORK_PORT = 7881;
const DOPS_PORT = 7883;
const DBRAIN_TOKEN = "test-token";
const DWORK_TOKEN = "test-token";
const DOPS_TOKEN = "test-token";
const DBRAIN_URL = `http://localhost:${DBRAIN_PORT}`;
const DPROXY_URL = `http://localhost:${DPROXY_PORT}`;
const DWORK_URL = `http://localhost:${DWORK_PORT}`;
const DOPS_URL = `http://localhost:${DOPS_PORT}`;

const children: ChildProcess[] = [];
let tempDir: string | undefined;

function cleanup(): void {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    console.log(`  Cleaned up ${tempDir}`);
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

function ensureBuilt(): void {
  if (
    !existsSync(DBRAIN_BIN) ||
    !existsSync(DPROXY_BIN) ||
    !existsSync(DWORK_BIN) ||
    !existsSync(DOPS_BIN)
  ) {
    console.log("Building packages...\n");
    execSync("pnpm build", { cwd: ROOT, stdio: "inherit" });
    console.log();
  }
}

function initDbrain(): string {
  const dir = mkdtempSync(join(tmpdir(), "dtoolkit-examples-"));
  tempDir = dir;

  execSync(`node ${DBRAIN_BIN} init --non-interactive ${dir}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DBRAIN_PORT: String(DBRAIN_PORT),
      DBRAIN_HOST: "127.0.0.1",
      DBRAIN_TOKEN,
      DBRAIN_AGENT_NAME: "TestBrain",
      DBRAIN_OWNER_NAME: "Developer",
    },
  });

  return dir;
}

function startProcess(
  name: string,
  bin: string,
  args: string[] = [],
  env?: Record<string, string>,
): ChildProcess {
  const child = spawn("node", [bin, ...args], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", ...env },
  });

  child.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().trim().split("\n")) {
      console.log(`  [${name}] ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    for (const line of data.toString().trim().split("\n")) {
      console.error(`  [${name}] ${line}`);
    }
  });

  children.push(child);
  return child;
}

async function waitForHealth(
  name: string,
  url: string,
  maxRetries = 30,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`${name} did not become healthy at ${url}`);
}

async function runExample(script: string): Promise<void> {
  const file = resolve(__dirname, script);
  if (!existsSync(file)) {
    throw new Error(`Example not found: ${script}`);
  }

  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npx", ["tsx", file], {
      cwd: EXAMPLES_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        DBRAIN_URL,
        DBRAIN_TOKEN,
        DPROXY_URL,
        DPROXY_TOKEN: "",
        DWORK_URL,
        DWORK_TOKEN,
        DOPS_URL,
        DOPS_TOKEN,
      },
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? "demo";
  const script = `${target}.ts`;

  console.log("--- Setup ---\n");

  ensureBuilt();

  console.log("Initializing temporary brain...");
  const dataDir = initDbrain();
  console.log(`  Brain at ${dataDir}\n`);

  console.log("Starting dbrain...");
  startProcess("dbrain", DBRAIN_BIN, ["start", dataDir]);
  await waitForHealth("dbrain", DBRAIN_URL);
  console.log("  dbrain ready\n");

  console.log("Starting dproxy...");
  startProcess("dproxy", DPROXY_BIN, ["serve"], {
    DPROXY_PORT: String(DPROXY_PORT),
  });
  await waitForHealth("dproxy", `${DPROXY_URL}/v1`);
  console.log("  dproxy ready\n");

  console.log("Initializing dwork...");
  const dworkDir = mkdtempSync(join(tmpdir(), "dtoolkit-dwork-"));
  execSync(`node ${DWORK_BIN} init --non-interactive ${dworkDir}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DWORK_PORT: String(DWORK_PORT),
      DWORK_HOST: "127.0.0.1",
      DWORK_TOKEN,
    },
  });
  console.log(`  dwork data at ${dworkDir}\n`);

  console.log("Starting dwork...");
  startProcess("dwork", DWORK_BIN, ["start", dworkDir]);
  await waitForHealth("dwork", DWORK_URL);
  console.log("  dwork ready\n");

  console.log("Initializing dops...");
  const dopsDir = mkdtempSync(join(tmpdir(), "dtoolkit-dops-"));
  execSync(`node ${DOPS_BIN} init --non-interactive ${dopsDir}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DOPS_PORT: String(DOPS_PORT),
      DOPS_HOST: "127.0.0.1",
      DOPS_TOKEN,
    },
  });
  console.log(`  dops data at ${dopsDir}\n`);

  console.log("Starting dops...");
  startProcess("dops", DOPS_BIN, ["start", dopsDir]);
  await waitForHealth("dops", DOPS_URL);
  console.log("  dops ready\n");

  console.log(`--- Running ${script} ---\n`);

  try {
    await runExample(script);
  } finally {
    console.log("\n--- Teardown ---\n");
    cleanup();
    console.log("  Servers stopped.");
  }
}

main().catch((err: Error) => {
  console.error(`\nSetup error: ${err.message}`);
  cleanup();
  process.exit(1);
});
