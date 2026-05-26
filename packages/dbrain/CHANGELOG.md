# @dtoolkit/dbrain

## 0.4.2

### Patch Changes

- b2f69b6: Fix `configureClaude` in connect command to use the user-provided URL instead of the server's Host header, so the recorded MCP URL matches what the user typed.
- Updated dependencies [b2f69b6]
  - @dtoolkit/sdk@0.5.1

## 0.4.1

### Patch Changes

- d5cbd7b: dwork: dashboard with overview, global kanban, task detail modal, docs file tree, mobile responsive, Light/Dark themes. Full REST API, MCP tools, CLI commands.

  dbrain: dashboard auth fix, login unification, mobile responsive, hamburger menu, Light/Dark themes.

  sdk: add DWorkClient with 22 typed methods for dwork REST API.

- Updated dependencies [d5cbd7b]
  - @dtoolkit/sdk@0.5.0

## 0.4.0

### Minor Changes

- 31c13d1: Add brain compaction system: structural dedup of cold facts with Dice coefficient similarity, scheduled compaction via cron, REST and MCP compact endpoints, and interactive `dbrain configure` command.

### Patch Changes

- Updated dependencies [31c13d1]
  - @dtoolkit/core@0.5.0
  - @dtoolkit/sdk@0.4.1

## 0.3.2

### Patch Changes

- 7f5260f: Federation polish: fix empty query crash in search/MCP, add `searchFederated()` and federation types to SDK, add federation awareness to dcontext briefing and status, update all docs with Mermaid diagrams
- Updated dependencies [7f5260f]
  - @dtoolkit/sdk@0.4.0
  - @dtoolkit/core@0.4.1

## 0.3.1

### Patch Changes

- 5336beb: fix: deduplicate dcontext log extraction to dbrain

  POST /conversations is now idempotent — returns existing conversation when called with a known ID. dcontext tracks the last saved message offset per session and only sends new messages on each pre-compact, avoiding duplicate conversation entries in dbrain.

## 0.3.0

### Minor Changes

- 6f3e580: Add ASCII art banners to all CLI help outputs (dbrain, dproxy, dcontext). Migrate dbrain CLI to Commander. Add Codex CLI, Gemini CLI, and OpenCode support to dbrain connect and dcontext install/hooks. Move dcontext MD section helpers to core. Remove Ollama adapter.

### Patch Changes

- Updated dependencies [6f3e580]
  - @dtoolkit/core@0.4.0

## 0.2.6

### Patch Changes

- Updated dependencies [6ab5cf2]
  - @dtoolkit/core@0.3.0

## 0.2.5

### Patch Changes

- Updated dependencies [77f2f95]
  - @dtoolkit/core@0.2.2

## 0.2.4

### Patch Changes

- a05b65b: fix: read version dynamically instead of hardcoding, fix LineBuffer lint warning
- Updated dependencies [a05b65b]
  - @dtoolkit/core@0.2.1

## 0.2.3

### Patch Changes

- fix: resolve workspace:\* dependency in npm publish by using pnpm publish

## 0.2.2

### Patch Changes

- fix: resolve workspace:\* dependency on @dtoolkit/core for npm install compatibility
