# @dtoolkit/dwork

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
