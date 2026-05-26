import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLAUDE_MD_CONTENT = `# dwork

You have a project manager connected via MCP (dwork). It manages projects, tasks, roadmaps, and technical documentation.

## When to use each tool

- \`get_tasks\` — List tasks for a project. Use when the user asks about tasks in a specific project.
- \`add_task\` — Create a new task. Use when the user wants to track new work.
- \`update_task\` — Change task status, priority, or details. Use when the user says to move, complete, or modify a task.
- \`get_project\` — Project overview (README + TECH + task stats). Use for project context.
- \`list_projects\` — All projects. Use when the user asks "what projects do I have?"
- \`create_project\` — Scaffold a new project with 4 mandatory MDs.
- \`get_roadmap\` — Current / Next / Future roadmap.
- \`get_docs\` — List technical docs for a project.
- \`add_doc\` — Create a numbered detail doc.
- \`search\` — Full-text search across tasks and docs.
- \`what_to_do_next\` — Priority/deadline ranking of active tasks.
- \`overview\` — Global stats across all projects.
- \`sync\` — Sync project docs from source code via dproxy.

## Rules

- **IMPORTANT**: If your context already contains "Tasks (dwork)", active tasks are already injected by dcontext. Do NOT call \`get_tasks\` or \`list_projects\` at session start. Only use them when the user explicitly asks.
- Use \`update_task\` only when the user requests a status change.
- Task IDs are stable 8-char alphanumeric codes. Always reference tasks by ID.
`;

export function healthRoutes(app: FastifyInstance) {
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
    );
    version = pkg.version;
  } catch {
    // ok
  }

  app.get('/health', async () => {
    const { projects } = app.db.prepare('SELECT COUNT(*) as projects FROM projects').get() as {
      projects: number;
    };
    const { tasks } = app.db.prepare('SELECT COUNT(*) as tasks FROM tasks').get() as {
      tasks: number;
    };
    const { docs } = app.db.prepare('SELECT COUNT(*) as docs FROM docs').get() as { docs: number };

    return {
      status: 'ok',
      version,
      projects,
      tasks,
      docs,
    };
  });

  app.get('/connect', async (request) => {
    const config = app.config;
    const host = request.headers.host || `localhost:${config.port}`;
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;

    return {
      mcp: {
        dwork: {
          type: 'http',
          url: `${baseUrl}/mcp`,
          headers: { Authorization: `Bearer ${config.token}` },
        },
      },
      permissions: ['mcp__dwork__*'],
      claudeMd: CLAUDE_MD_CONTENT,
    };
  });
}
