# @dtoolkit/dwork

## 1.0.0

### Major Changes

- 01aa6ac: v1.0.0 — production-ready launch. All core packages graduate to stable.

### Patch Changes

- Updated dependencies [01aa6ac]
  - @dtoolkit/core@1.0.0
  - @dtoolkit/sdk@1.0.0
  - @dtoolkit/codegraph-sdk@1.0.0

## 0.5.1

### Patch Changes

- Updated dependencies [7c98ca3]
  - @dtoolkit/core@0.6.0
  - @dtoolkit/sdk@0.6.1

## 0.5.0

### Minor Changes

- 9a5be95: Code graph integration across the dtoolkit suite:
  - **codegraph-sdk**: New package — semantic code intelligence SDK forked from @colbymchenry/codegraph (library-only, no CLI/MCP)
  - **dwork**: Codegraph integration — multi-graph service, REST API, MCP graph tools (search, stats, trace, impact, context), Cytoscape.js interactive visualization with minimap/LOD/context menus, project-graph cross-links in dashboard, inline edit project name/description, update_project and update_doc MCP tools, move task between projects
  - **sdk**: DWorkClient graph methods — upload, query, CRUD, subgraph, dead code, circular deps
  - **dcontext**: `dcontext sync` command to index codebase and upload graph to dwork, enrich session briefing with code graph insights

### Patch Changes

- Updated dependencies [9a5be95]
  - @dtoolkit/codegraph-sdk@0.2.0
  - @dtoolkit/sdk@0.6.0

## 0.4.0

### Minor Changes

- 197fd14: Enrich task responses with detail_body and add get_doc MCP tool + REST endpoint

## 0.3.0

### Minor Changes

- b2f69b6: Add `dwork connect` command for configuring AI coding clients (Claude, Codex, Gemini, OpenCode) against a running dwork server. Also: stable 8-char task IDs persisted in BACKLOG.md, atomic task + detail doc creation in a single call, and dashboard version from /health.

### Patch Changes

- Updated dependencies [b2f69b6]
  - @dtoolkit/sdk@0.5.1

## 0.2.1

### Patch Changes

- 3a2de8a: fix: dashboard task detail modal now correctly resolves linked docs when detail_path lacks the docs/ prefix

## 0.2.0

### Minor Changes

- d5cbd7b: dwork: dashboard with overview, global kanban, task detail modal, docs file tree, mobile responsive, Light/Dark themes. Full REST API, MCP tools, CLI commands.

  dbrain: dashboard auth fix, login unification, mobile responsive, hamburger menu, Light/Dark themes.

  sdk: add DWorkClient with 22 typed methods for dwork REST API.

### Patch Changes

- Updated dependencies [d5cbd7b]
  - @dtoolkit/sdk@0.5.0
