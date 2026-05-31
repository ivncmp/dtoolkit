import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';

import * as cgService from '../../service/codegraph.js';

export async function codegraphRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  );

  // --- Graph CRUD ---

  app.get('/graphs', async () => {
    const rows = app.db.prepare('SELECT * FROM graphs ORDER BY name').all() as Array<
      Record<string, unknown>
    >;
    const links = app.db
      .prepare('SELECT graph_name, project_slug FROM graph_projects')
      .all() as Array<{ graph_name: string; project_slug: string }>;
    const projectsByGraph = new Map<string, string[]>();
    for (const l of links) {
      const arr = projectsByGraph.get(l.graph_name) ?? [];
      arr.push(l.project_slug);
      projectsByGraph.set(l.graph_name, arr);
    }
    return rows.map((r) => ({ ...r, projects: projectsByGraph.get(r.name as string) ?? [] }));
  });

  app.get('/graphs/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const row = app.db.prepare('SELECT * FROM graphs WHERE name = ?').get(name);
    if (!row) return reply.code(404).send({ error: 'Graph not found' });
    const projects = app.db
      .prepare('SELECT project_slug FROM graph_projects WHERE graph_name = ?')
      .all(name) as Array<{ project_slug: string }>;
    return { ...(row as Record<string, unknown>), projects: projects.map((p) => p.project_slug) };
  });

  app.delete('/graphs/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    cgService.closeGraph(name);
    app.db.prepare('DELETE FROM graphs WHERE name = ?').run(name);
    return reply.code(204).send();
  });

  // --- Upload ---

  app.post('/graphs/:name/upload', { bodyLimit: 200 * 1024 * 1024 }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const buffer = request.body as Buffer;

    if (!buffer || buffer.length === 0) {
      return reply.code(400).send({ error: 'Empty body' });
    }

    cgService.closeGraph(name);

    const graphDir = join(app.config.dataPath, 'graphs', name);
    mkdirSync(graphDir, { recursive: true });
    const dbPath = join(graphDir, 'codegraph.db');
    writeFileSync(dbPath, buffer);

    try {
      cgService.openGraph(name, dbPath);
    } catch (err) {
      return reply
        .code(422)
        .send({ error: `Invalid codegraph database: ${(err as Error).message}` });
    }

    const graphStats = cgService.stats(name);
    const now = new Date().toISOString();

    app.db
      .prepare(
        `INSERT INTO graphs (name, node_count, edge_count, file_count, db_size, synced_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET
             node_count = excluded.node_count,
             edge_count = excluded.edge_count,
             file_count = excluded.file_count,
             db_size = excluded.db_size,
             synced_at = excluded.synced_at`,
      )
      .run(
        name,
        graphStats.nodeCount,
        graphStats.edgeCount,
        graphStats.fileCount,
        buffer.length,
        now,
        now,
      );

    return {
      name,
      nodeCount: graphStats.nodeCount,
      edgeCount: graphStats.edgeCount,
      fileCount: graphStats.fileCount,
      dbSize: buffer.length,
      syncedAt: now,
    };
  });

  // --- Project linking ---

  app.post('/graphs/:name/projects', async (request, reply) => {
    const { name } = request.params as { name: string };
    const { slugs } = request.body as { slugs: string[] };
    if (!slugs || !Array.isArray(slugs)) {
      return reply.code(400).send({ error: 'slugs array required' });
    }
    const graph = app.db.prepare('SELECT name FROM graphs WHERE name = ?').get(name);
    if (!graph) return reply.code(404).send({ error: 'Graph not found' });

    const insert = app.db.prepare(
      'INSERT OR IGNORE INTO graph_projects (graph_name, project_slug) VALUES (?, ?)',
    );
    for (const slug of slugs) {
      insert.run(name, slug);
    }
    return { linked: slugs };
  });

  app.delete('/graphs/:name/projects/:slug', async (request, reply) => {
    const { name, slug } = request.params as { name: string; slug: string };
    app.db
      .prepare('DELETE FROM graph_projects WHERE graph_name = ? AND project_slug = ?')
      .run(name, slug);
    return reply.code(204).send();
  });

  // --- Query endpoints (all scoped by graph name) ---

  function getGraphName(request: { params: unknown }): string {
    return (request.params as { name: string }).name;
  }

  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;
    if (!url.startsWith('/graphs/')) return;
    const parts = url.split('/');
    if (parts.length < 4) return;
    const name = parts[2];
    const sub = parts[3];
    if (['stats', 'nodes', 'trace', 'graph', 'files', 'deadcode', 'circular'].includes(sub)) {
      if (!cgService.isGraphAvailable(name)) {
        return reply.code(404).send({ error: `Graph "${name}" not loaded` });
      }
    }
  });

  app.get('/graphs/:name/stats', async (request) => {
    const name = getGraphName(request);
    return cgService.stats(name);
  });

  app.get('/graphs/:name/nodes', async (request) => {
    const name = getGraphName(request);
    const { q, kind, limit } = request.query as { q?: string; kind?: string; limit?: string };
    if (!q) return [];
    return cgService.searchNodes(name, q, kind, limit ? parseInt(limit, 10) : undefined);
  });

  app.get('/graphs/:name/nodes/:id', async (request, reply) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    const node = cgService.getNode(name, id);
    if (!node) return reply.code(404).send({ error: 'Node not found' });
    return node;
  });

  app.get('/graphs/:name/nodes/:id/callers', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    const { depth } = request.query as { depth?: string };
    return cgService.getCallers(name, id, depth ? parseInt(depth, 10) : 1);
  });

  app.get('/graphs/:name/nodes/:id/callees', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    const { depth } = request.query as { depth?: string };
    return cgService.getCallees(name, id, depth ? parseInt(depth, 10) : 1);
  });

  app.get('/graphs/:name/nodes/:id/usages', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    return cgService.findUsages(name, id);
  });

  app.get('/graphs/:name/nodes/:id/impact', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    const { depth } = request.query as { depth?: string };
    return cgService.getImpactRadius(name, id, depth ? parseInt(depth, 10) : 3);
  });

  app.get('/graphs/:name/nodes/:id/callgraph', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    const { depth } = request.query as { depth?: string };
    return cgService.getCallGraph(name, id, depth ? parseInt(depth, 10) : 2);
  });

  app.get('/graphs/:name/nodes/:id/hierarchy', async (request) => {
    const name = getGraphName(request);
    const { id } = request.params as { name: string; id: string };
    return cgService.getTypeHierarchy(name, id);
  });

  app.get('/graphs/:name/trace', async (request, reply) => {
    const name = getGraphName(request);
    const { from, to } = request.query as { from?: string; to?: string };
    if (!from || !to) return reply.code(400).send({ error: 'from and to are required' });
    const path = cgService.findPath(name, from, to);
    if (!path) return { path: null, message: 'No path found' };
    return { path };
  });

  app.get('/graphs/:name/graph', async (request) => {
    const name = getGraphName(request);
    const { kind, file, limit } = request.query as { kind?: string; file?: string; limit?: string };
    return cgService.getGraph(name, kind, file, limit ? parseInt(limit, 10) : 200);
  });

  app.get('/graphs/:name/files', async (request) => {
    const name = getGraphName(request);
    return cgService.getFiles(name);
  });

  app.get('/graphs/:name/deadcode', async (request) => {
    const name = getGraphName(request);
    const { kinds } = request.query as { kinds?: string };
    return cgService.findDeadCode(name, kinds);
  });

  app.get('/graphs/:name/circular', async (request) => {
    const name = getGraphName(request);
    return cgService.findCircularDependencies(name);
  });
}
