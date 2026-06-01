<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/codegraph-sdk</h1>
<p align="center">Code intelligence SDK — semantic knowledge graph from any codebase</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/codegraph-sdk"><img src="https://img.shields.io/npm/v/@dtoolkit/codegraph-sdk.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

Library-only fork of [codegraph](https://colbymchenry.github.io/codegraph/) by [Colby McHenry](https://github.com/colbymchenry). Builds a semantic knowledge graph (symbols, edges, call graphs) from any codebase using tree-sitter WASM parsers and SQLite.

Used by [`@dtoolkit/dwork`](../dwork/) for code graph features (search, trace, impact analysis).

## Install

```bash
npm install @dtoolkit/codegraph-sdk
```

## Quick start

```ts
import CodeGraph from "@dtoolkit/codegraph-sdk";

const cg = await CodeGraph.init("./my-project");
const stats = cg.getStats();
// { nodes: 1200, edges: 3400, languages: ['typescript', 'javascript'] }

const results = cg.searchNodes("handleRequest");
// [{ node: { name: 'handleRequest', kind: 'function', ... }, score: 0.95 }]

cg.close();
```

## Core API

### Lifecycle

| Method | Description |
| --- | --- |
| `CodeGraph.init(root, opts?)` | Initialize and index a project |
| `CodeGraph.open(root, opts?)` | Open an existing project |
| `CodeGraph.openDb(dbPath)` | Open a database file directly |
| `close()` | Release resources |

### Indexing

| Method | Description |
| --- | --- |
| `indexAll(opts?)` | Full index — returns files indexed, nodes/edges created |
| `indexFiles(paths)` | Index specific files |
| `sync(opts?)` | Incremental update based on file changes |
| `watch(opts?)` / `unwatch()` | File watcher with auto-sync |

### Querying

| Method | Description |
| --- | --- |
| `searchNodes(query, opts?)` | Full-text search with relevance scoring |
| `getNode(id)` | Get a node by ID |
| `getNodesInFile(path)` | All nodes in a file |
| `getNodesByKind(kind)` | All nodes of a kind (function, class, route...) |

### Graph traversal

| Method | Description |
| --- | --- |
| `traverse(startId, opts?)` | BFS traversal with filters |
| `getCallGraph(nodeId, depth?)` | Callers and callees |
| `getImpactRadius(nodeId, depth?)` | All nodes affected by changes |
| `getTypeHierarchy(nodeId)` | Ancestor and descendant types |
| `findUsages(nodeId)` | All references to a symbol |
| `getContext(nodeId)` | Full context: ancestors, children, refs, types |
| `findPath(from, to, edgeKinds?)` | Shortest path between two nodes |

### Analysis

| Method | Description |
| --- | --- |
| `findDeadCode(kinds?)` | Unreferenced symbols |
| `findCircularDependencies()` | File-level cycles |
| `getFileDependencies(path)` | Files this file depends on |
| `getFileDependents(path)` | Files that depend on this file |
| `getNodeMetrics(nodeId)` | Complexity metrics |

### Context building

| Method | Description |
| --- | --- |
| `buildContext(input, opts?)` | Rich task context via FTS + graph expansion |
| `findRelevantContext(query, opts?)` | Semantic search + traversal |
| `getCode(nodeId)` | Extract source code for a node |

## Data model

**Nodes** represent code symbols: functions, classes, methods, routes, components, constants, interfaces, type aliases, variables, properties (21 kinds total).

**Edges** represent relationships: contains, calls, imports, exports, extends, implements, references, type_of, returns, instantiates, overrides, decorates.

## Supported languages

TypeScript, JavaScript, TSX/JSX, Python, Go, Rust, Java, C, C++, C#, PHP, Ruby, Swift, Kotlin, Dart, Scala, Lua, Objective-C, Pascal, and more. Framework-specific support for React, Vue, Svelte, Express, NestJS, Rails, Laravel, Spring, and others.

## License

[MIT](../../LICENSE)
