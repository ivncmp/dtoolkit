import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as docService from '../service/docs.js';
import * as overviewService from '../service/overview.js';
import * as projectService from '../service/projects.js';
import * as searchService from '../service/search.js';
import * as syncService from '../service/sync.js';
import * as taskService from '../service/tasks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

export function createMcpServer(app: FastifyInstance) {
  const { db, config } = app;

  const mcp = new McpServer({ name: 'dwork', version: pkg.version });

  // --- Resource: project list ---
  mcp.registerResource(
    'projects',
    'dwork://projects',
    {
      title: 'dwork projects',
      description: 'Summary of all projects managed by dwork',
      mimeType: 'text/plain',
    },
    async () => {
      const data = overviewService.overview(db);
      return {
        contents: [{ uri: 'dwork://projects', text: JSON.stringify(data) }],
      };
    },
  );

  // 1. get_project
  mcp.registerTool(
    'get_project',
    {
      description: 'Get full context about a project: README, TECH.md, and task stats.',
      inputSchema: {
        slug: z.string().describe('Project slug'),
      },
    },
    async ({ slug }) => {
      const result = projectService.getProject(db, config, slug);
      if (!result) return json({ error: `Project '${slug}' not found` });
      return json(result);
    },
  );

  // 2. list_projects
  mcp.registerTool(
    'list_projects',
    {
      description: 'List all projects with task summaries. Optionally filter by status.',
      inputSchema: {
        status: z.string().optional().describe('Filter by status: active, paused, archived'),
      },
    },
    async ({ status }) => {
      return json(projectService.listProjects(db, status));
    },
  );

  // 3. create_project
  mcp.registerTool(
    'create_project',
    {
      description: 'Create a new project. Scaffolds README, TECH.md, ROADMAP.md, and BACKLOG.md.',
      inputSchema: {
        slug: z.string().describe('Project slug (lowercase, hyphens)'),
        name: z.string().describe('Display name'),
        description: z.string().optional().describe('Short description'),
        source_path: z.string().optional().describe('Path to the real project source code'),
      },
    },
    async ({ slug, name, description, source_path }) => {
      try {
        const result = projectService.createProject(
          db,
          config,
          slug,
          name,
          description,
          source_path,
        );
        return json(result);
      } catch (err) {
        return json({ error: (err as Error).message });
      }
    },
  );

  // 3b. update_project
  mcp.registerTool(
    'update_project',
    {
      description: "Update a project's name, description, status, or source path.",
      inputSchema: {
        slug: z.string().describe('Project slug'),
        name: z.string().optional().describe('New display name'),
        description: z.string().optional().describe('New description'),
        status: z.string().optional().describe('New status: active, paused, archived'),
        source_path: z.string().optional().describe('New path to the real project source code'),
      },
    },
    async ({ slug, ...changes }) => {
      const ok = projectService.updateProject(db, slug, changes);
      return json({ updated: ok, slug });
    },
  );

  // 4. get_tasks
  mcp.registerTool(
    'get_tasks',
    {
      description:
        'Get tasks for a project, filtered by status and/or priority. Includes detail_body when the task has a linked detail doc.',
      inputSchema: {
        project: z.string().describe('Project slug'),
        status: z.string().optional().describe('Filter: todo, refinement, doing, blocked, done'),
        priority: z.string().optional().describe('Filter: P0, P1, P2, P3'),
      },
    },
    async ({ project, status, priority }) => {
      const tasks = taskService.getTasks(db, project, status, priority);
      return json(taskService.enrichTasksWithDetails(db, tasks));
    },
  );

  // 5. add_task
  mcp.registerTool(
    'add_task',
    {
      description:
        'Add a task to a project. Appends to BACKLOG.md in the correct priority section. Pass detail_doc to atomically create a detail document and link it.',
      inputSchema: {
        project: z.string().describe('Project slug'),
        title: z.string().describe('Task title'),
        type: z.string().optional().describe('task, bug, feature, idea, note'),
        priority: z.string().optional().describe('P0, P1, P2, P3 (default: P2)'),
        status: z.string().optional().describe('todo, refinement, doing, blocked'),
        estimate: z.string().optional().describe('Time estimate: 2h, 1d, 3d, 1w'),
        deadline: z.string().optional().describe('ISO date deadline'),
        detail: z
          .string()
          .optional()
          .describe('Path to an existing detail doc (e.g. docs/001_slug.md)'),
        detail_doc: z
          .object({
            title: z.string().describe('Document title'),
            body: z.string().describe('Document body (markdown)'),
            type: z.string().describe('Doc type: note, idea, planning, decision, postmortem'),
          })
          .optional()
          .describe('Create and link a detail document atomically'),
      },
    },
    async ({ project, title, ...opts }) => {
      try {
        const result = taskService.addTask(db, config, project, title, opts);
        return json(result);
      } catch (err) {
        return json({ error: (err as Error).message });
      }
    },
  );

  // 6. update_task
  mcp.registerTool(
    'update_task',
    {
      description:
        'Update a task. Modifies BACKLOG.md and re-indexes. Set project to move the task to a different project.',
      inputSchema: {
        id: z.string().describe('Task ID'),
        title: z.string().optional().describe('New title'),
        status: z.string().optional().describe('New status'),
        priority: z.string().optional().describe('New priority'),
        type: z.string().optional().describe('New type'),
        estimate: z.string().optional().describe('New estimate'),
        deadline: z.string().optional().describe('New deadline'),
        detail: z.string().optional().describe('Path to detail doc (e.g. docs/001_slug.md)'),
        project: z
          .string()
          .optional()
          .describe('Move task to this project slug (removes from current, adds to target)'),
      },
    },
    async ({ id, ...changes }) => {
      const ok = taskService.updateTask(db, config, id, changes);
      return json({ updated: ok, id });
    },
  );

  // 7. get_roadmap
  mcp.registerTool(
    'get_roadmap',
    {
      description: "Get a project's ROADMAP.md content.",
      inputSchema: {
        project: z.string().describe('Project slug'),
      },
    },
    async ({ project }) => {
      const content = docService.getRoadmap(db, config, project);
      if (content == null) return json({ error: `Roadmap not found for '${project}'` });
      return json({ project, content });
    },
  );

  // 8. get_docs
  mcp.registerTool(
    'get_docs',
    {
      description: 'List documents for a project, optionally filtered by type.',
      inputSchema: {
        project: z.string().describe('Project slug'),
        type: z.string().optional().describe('Doc type filter'),
      },
    },
    async ({ project, type }) => {
      return json(docService.listDocs(db, project, type));
    },
  );

  // 8b. get_doc
  mcp.registerTool(
    'get_doc',
    {
      description:
        'Get a single document with its full content. Look up by doc ID or by project slug + file path.',
      inputSchema: {
        id: z.string().optional().describe('Doc ID (e.g. doc_abc123)'),
        project: z.string().optional().describe('Project slug (required when using file_path)'),
        file_path: z
          .string()
          .optional()
          .describe('Doc file path within the project (e.g. docs/005_slug.md)'),
      },
    },
    async ({ id, project, file_path }) => {
      let result: docService.DocWithContent | null = null;

      if (id) {
        result = docService.getDoc(db, config, id);
      } else if (project && file_path) {
        result = docService.getDocByPath(db, project, file_path);
      } else {
        return json({ error: 'Provide either id, or project + file_path' });
      }

      if (!result) return json({ error: 'Doc not found' });
      return json(result);
    },
  );

  // 9. add_doc
  mcp.registerTool(
    'add_doc',
    {
      description: 'Create a numbered document in docs/ with YAML frontmatter.',
      inputSchema: {
        project: z.string().describe('Project slug'),
        title: z.string().describe('Document title'),
        body: z.string().describe('Document body (markdown)'),
        type: z.string().describe('Doc type: note, idea, planning, decision, postmortem'),
      },
    },
    async ({ project, title, body, type }) => {
      try {
        const result = docService.addDoc(db, config, project, title, body, type);
        return json(result);
      } catch (err) {
        return json({ error: (err as Error).message });
      }
    },
  );

  // 9b. update_doc
  mcp.registerTool(
    'update_doc',
    {
      description: 'Update a document. Modifies the file on disk and re-indexes.',
      inputSchema: {
        id: z.string().describe('Doc ID'),
        title: z.string().optional().describe('New title'),
        body: z.string().optional().describe('New body (markdown)'),
        type: z.string().optional().describe('New doc type'),
      },
    },
    async ({ id, ...changes }) => {
      const ok = docService.updateDoc(db, config, id, changes);
      return json({ updated: ok, id });
    },
  );

  // 10. search
  mcp.registerTool(
    'search',
    {
      description: 'Full-text search across tasks and docs. Uses OR logic for multi-word queries.',
      inputSchema: {
        query: z.string().describe('Search query'),
        project: z.string().optional().describe('Scope to a specific project'),
        limit: z.number().optional().default(20).describe('Max results'),
      },
    },
    async ({ query, project, limit }) => {
      return json(searchService.search(db, query, project, limit));
    },
  );

  // 11. what_to_do_next
  mcp.registerTool(
    'what_to_do_next',
    {
      description: 'Suggest the next tasks to work on, ranked by priority and deadline.',
      inputSchema: {
        project: z.string().optional().describe('Scope to a specific project'),
      },
    },
    async ({ project }) => {
      const tasks = taskService.whatToDoNext(db, project);
      return json(taskService.enrichTasksWithDetails(db, tasks));
    },
  );

  // 12. sync
  mcp.registerTool(
    'sync',
    {
      description: 'Sync project docs from source code via dproxy. Requires dproxy configured.',
      inputSchema: {
        project: z.string().describe('Project slug'),
      },
    },
    async ({ project }) => {
      return json(await syncService.syncProject(db, config, project));
    },
  );

  // 13. overview
  mcp.registerTool(
    'overview',
    {
      description: 'Get a summary of all projects with task counts by status and priority.',
      inputSchema: {},
    },
    async () => {
      return json(overviewService.overview(db));
    },
  );

  return mcp;
}

function logMcpRequest(app: FastifyInstance, body: unknown) {
  const msg = body as { method?: string; params?: Record<string, unknown> };
  if (!msg?.method) return;

  const method = msg.method;
  const params = msg.params ?? {};

  if (method === 'initialize') {
    app.log.info({ mcp: method }, 'MCP client connected');
  } else if (method === 'tools/call') {
    const toolName = params.name ?? 'unknown';
    const toolArgs = params.arguments ?? {};
    app.log.info({ mcp: method, tool: toolName, args: toolArgs }, `MCP tool: ${toolName}`);
  } else if (
    method === 'tools/list' ||
    method === 'resources/list' ||
    method === 'resources/read'
  ) {
    app.log.info({ mcp: method }, `MCP ${method}`);
  }
}

export function mountMcp(app: FastifyInstance) {
  app.all('/mcp', async (request, reply) => {
    const raw = request.raw;
    const res = reply.raw;

    reply.hijack();

    if (request.method === 'POST') {
      logMcpRequest(app, request.body);
      const server = createMcpServer(app);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(raw, res, request.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } else if (request.method === 'GET' || request.method === 'DELETE') {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        }),
      );
    }
  });
}
