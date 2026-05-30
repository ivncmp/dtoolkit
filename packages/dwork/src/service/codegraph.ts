import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type {
  CodeGraph as CodeGraphInstance,
  Edge,
  FileRecord,
  GraphStats,
  Node,
  SearchResult,
  Subgraph,
} from '@dtoolkit/codegraph-sdk';
import type Database from 'better-sqlite3';

const require = createRequire(import.meta.url);
const { CodeGraph } = require('@dtoolkit/codegraph-sdk') as {
  CodeGraph: {
    openSync(path: string): CodeGraphInstance;
    isInitialized(path: string): boolean;
  };
};

const graphs = new Map<string, CodeGraphInstance>();

export type { Node, Edge, FileRecord, GraphStats, SearchResult };

export interface SerializedSubgraph {
  nodes: Node[];
  edges: Edge[];
  roots: string[];
}

function serializeSubgraph(sg: Subgraph): SerializedSubgraph {
  return {
    nodes: Array.from(sg.nodes.values()),
    edges: sg.edges,
    roots: sg.roots,
  };
}

function requireGraph(name: string): CodeGraphInstance {
  const cg = graphs.get(name);
  if (!cg) throw new Error(`Graph "${name}" not loaded`);
  return cg;
}

function graphStoragePath(dataPath: string, name: string): string {
  return join(dataPath, 'graphs', name);
}

export function openGraph(name: string, storagePath: string): void {
  if (graphs.has(name)) return;
  const cg = CodeGraph.openSync(storagePath);
  graphs.set(name, cg);
}

export function closeGraph(name: string): void {
  const cg = graphs.get(name);
  if (cg) {
    cg.close();
    graphs.delete(name);
  }
}

export function closeAll(): void {
  for (const [name, cg] of graphs) {
    cg.close();
    graphs.delete(name);
  }
}

export function openAllGraphs(db: Database.Database, dataPath: string): number {
  const rows = db.prepare('SELECT name FROM graphs').all() as Array<{ name: string }>;
  let loaded = 0;
  for (const row of rows) {
    const path = graphStoragePath(dataPath, row.name);
    if (existsSync(join(path, '.codegraph', 'codegraph.db'))) {
      try {
        openGraph(row.name, path);
        loaded++;
      } catch {
        // skip broken graphs
      }
    }
  }
  return loaded;
}

export function isGraphAvailable(name: string): boolean {
  return graphs.has(name);
}

export function listLoadedGraphs(): string[] {
  return Array.from(graphs.keys());
}

// --- Query methods (all scoped by graph name) ---

export function stats(graphName: string): GraphStats {
  return requireGraph(graphName).getStats();
}

export function searchNodes(
  graphName: string,
  query: string,
  kind?: string,
  limit?: number,
): SearchResult[] {
  const cg = requireGraph(graphName);
  const kinds = kind ? (kind.split(',') as Node['kind'][]) : undefined;
  return cg.searchNodes(query, { kinds, limit: limit ?? 50 });
}

export function getNode(graphName: string, id: string): Node | null {
  return requireGraph(graphName).getNode(id);
}

export function getCallers(
  graphName: string,
  nodeId: string,
  depth = 1,
): Array<{ node: Node; edge: Edge }> {
  return requireGraph(graphName).getCallers(nodeId, depth);
}

export function getCallees(
  graphName: string,
  nodeId: string,
  depth = 1,
): Array<{ node: Node; edge: Edge }> {
  return requireGraph(graphName).getCallees(nodeId, depth);
}

export function findUsages(graphName: string, nodeId: string): Array<{ node: Node; edge: Edge }> {
  return requireGraph(graphName).findUsages(nodeId);
}

export function getImpactRadius(graphName: string, nodeId: string, depth = 3): SerializedSubgraph {
  return serializeSubgraph(requireGraph(graphName).getImpactRadius(nodeId, depth));
}

export function getCallGraph(graphName: string, nodeId: string, depth = 2): SerializedSubgraph {
  return serializeSubgraph(requireGraph(graphName).getCallGraph(nodeId, depth));
}

export function getTypeHierarchy(graphName: string, nodeId: string): SerializedSubgraph {
  return serializeSubgraph(requireGraph(graphName).getTypeHierarchy(nodeId));
}

export function findPath(
  graphName: string,
  fromId: string,
  toId: string,
): Array<{ node: Node; edge: Edge | null }> | null {
  return requireGraph(graphName).findPath(fromId, toId);
}

export function getGraph(
  graphName: string,
  kind?: string,
  file?: string,
  limit = 200,
): SerializedSubgraph {
  const cg = requireGraph(graphName);
  const kinds = kind ? (kind.split(',') as Node['kind'][]) : undefined;

  const results = cg.searchNodes('', { kinds, limit });
  if (results.length === 0) return { nodes: [], edges: [], roots: [] };

  const subgraph = cg.traverse(results[0].node.id, {
    maxDepth: 2,
    nodeKinds: kinds,
    limit,
  });

  let result = serializeSubgraph(subgraph);

  if (file) {
    const filtered = result.nodes.filter((n) => n.filePath.includes(file));
    const nodeIds = new Set(filtered.map((n) => n.id));
    result = {
      nodes: filtered,
      edges: result.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
      roots: result.roots.filter((r) => nodeIds.has(r)),
    };
  }

  return result;
}

export function getFiles(graphName: string): FileRecord[] {
  return requireGraph(graphName).getFiles();
}

export function findDeadCode(graphName: string, kinds?: string): Node[] {
  const k = kinds ? (kinds.split(',') as Node['kind'][]) : undefined;
  return requireGraph(graphName).findDeadCode(k);
}

export function findCircularDependencies(graphName: string): string[][] {
  return requireGraph(graphName).findCircularDependencies();
}
