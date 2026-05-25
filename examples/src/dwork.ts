/**
 * @dtoolkit/sdk — dwork client examples
 *
 * Demonstrates: health check, project CRUD, task management,
 * kanban workflow, search, overview, and what-to-do-next.
 *
 * Usage:
 *   cp .env.example .env   # edit with your values
 *   npm run dwork
 */

import { DWorkClient, SdkError } from "@dtoolkit/sdk";

const dwork = new DWorkClient(
  process.env.DWORK_URL ?? "http://localhost:7881",
  process.env.DWORK_TOKEN ?? "changeme",
);

// ── Health ──────────────────────────────────────────────────────────

async function healthCheck(): Promise<void> {
  const health = await dwork.health();
  console.log(`dwork v${health.version} is ${health.status}`);
  console.log(
    `  ${health.projects} projects, ${health.tasks} tasks, ${health.docs} docs`,
  );
}

// ── Projects ────────────────────────────────────────────────────────

async function projectLifecycle(): Promise<string> {
  const slug = `example-${Date.now()}`;

  const project = await dwork.createProject({
    slug,
    name: "SDK Example Project",
    description: "Created by the dwork SDK examples",
  });
  console.log(`\nCreated project: ${project.name} (${project.slug})`);

  const full = await dwork.getProject(slug);
  console.log(`  Status: ${full.status}`);
  console.log(`  README: ${full.readme ? "yes" : "no"}`);
  console.log(`  TECH.md: ${full.tech ? "yes" : "no"}`);

  const projects = await dwork.listProjects();
  console.log(`\nAll projects (${projects.length}):`);
  for (const p of projects) {
    console.log(`  ${p.slug} — ${p.name}`);
  }

  return slug;
}

// ── Tasks ───────────────────────────────────────────────────────────

async function taskWorkflow(slug: string): Promise<void> {
  const task1 = await dwork.addTask(slug, {
    title: "Set up CI pipeline",
    priority: "P0",
    type: "task",
    estimate: "2h",
  });
  console.log(`\nAdded task: ${task1.title} (${task1.id})`);

  const task2 = await dwork.addTask(slug, {
    title: "Write unit tests",
    priority: "P1",
    type: "task",
    estimate: "4h",
  });

  const task3 = await dwork.addTask(slug, {
    title: "Fix login redirect bug",
    priority: "P0",
    type: "bug",
    deadline: "2026-06-01",
  });

  console.log(`  Added 2 more tasks`);

  // Kanban workflow: move tasks through statuses
  await dwork.updateTask(task1.id, { status: "doing" });
  await dwork.updateTask(task3.id, { status: "doing" });
  console.log(`  Moved ${task1.title} and ${task3.title} to "doing"`);

  await dwork.updateTask(task1.id, { status: "done" });
  console.log(`  Completed: ${task1.title}`);

  // List by status
  const doing = await dwork.listTasks(slug, { status: "doing" });
  console.log(`\nTasks in "doing" (${doing.length}):`);
  for (const t of doing) {
    console.log(`  [${t.priority}] ${t.title}`);
  }

  // List by priority
  const p0 = await dwork.listTasks(slug, { priority: "P0" });
  console.log(`\nP0 tasks (${p0.length}):`);
  for (const t of p0) {
    console.log(`  [${t.status}] ${t.title}`);
  }
}

// ── Docs ────────────────────────────────────────────────────────────

async function docWorkflow(slug: string): Promise<void> {
  const doc = await dwork.addDoc(slug, {
    title: "Architecture Decision: Event Sourcing",
    body: "# ADR: Event Sourcing\n\nWe decided to use event sourcing for the audit log.\n\n## Context\n\nWe need full traceability of state changes.",
    type: "decision",
  });
  console.log(`\nCreated doc: ${doc.title} (${doc.id})`);

  const docs = await dwork.listDocs(slug);
  console.log(`  Project has ${docs.length} docs`);
}

// ── Search ──────────────────────────────────────────────────────────

async function searchDemo(slug: string): Promise<void> {
  const results = await dwork.search("CI pipeline", { project: slug });
  console.log(`\nSearch "CI pipeline" (${results.length} results):`);
  for (const r of results) {
    console.log(`  [${r.type}] ${r.title} (score: ${r.score.toFixed(2)})`);
  }
}

// ── Overview + Next ─────────────────────────────────────────────────

async function overviewAndNext(slug: string): Promise<void> {
  const overview = await dwork.overview();
  console.log(`\nOverview: ${overview.totalProjects} projects, ${overview.totalTasks} tasks, ${overview.totalDocs} docs`);

  const next = await dwork.whatToDoNext(slug);
  console.log(`\nWhat to do next (${next.length}):`);
  for (const t of next) {
    console.log(`  [${t.priority}] ${t.title}${t.deadline ? ` (deadline: ${t.deadline})` : ""}`);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanup(slug: string): Promise<void> {
  await dwork.deleteProject(slug);
  console.log(`\nCleaned up project: ${slug}`);
}

// ── Run ─────────────────────────────────────────────────────────────

try {
  await healthCheck();
  const slug = await projectLifecycle();
  await taskWorkflow(slug);
  await docWorkflow(slug);
  await searchDemo(slug);
  await overviewAndNext(slug);
  await cleanup(slug);
} catch (err) {
  if (err instanceof SdkError) {
    console.error(`\nAPI error: HTTP ${err.status} on ${err.path}`);
    console.error(`  ${err.body}`);
  } else {
    console.error("\nError:", (err as Error).message);
  }
  process.exit(1);
}
