# @dtoolkit/dcontext

## 0.1.4

### Patch Changes

- cb27bfa: Fix hookSpecificOutput format for Claude Code session injection

## 0.1.3

### Patch Changes

- Updated dependencies [31c13d1]
  - @dtoolkit/core@0.5.0
  - @dtoolkit/adapter-claude@1.3.2
  - @dtoolkit/adapter-codex@1.3.2
  - @dtoolkit/adapter-gemini@1.3.2
  - @dtoolkit/adapter-opencode@1.3.2
  - @dtoolkit/sdk@0.4.1

## 0.1.2

### Patch Changes

- 7f5260f: Federation polish: fix empty query crash in search/MCP, add `searchFederated()` and federation types to SDK, add federation awareness to dcontext briefing and status, update all docs with Mermaid diagrams
- Updated dependencies [7f5260f]
  - @dtoolkit/sdk@0.4.0
  - @dtoolkit/core@0.4.1
  - @dtoolkit/adapter-claude@1.3.1
  - @dtoolkit/adapter-codex@1.3.1
  - @dtoolkit/adapter-gemini@1.3.1
  - @dtoolkit/adapter-opencode@1.3.1

## 0.1.1

### Patch Changes

- 5336beb: fix: deduplicate dcontext log extraction to dbrain

  POST /conversations is now idempotent — returns existing conversation when called with a known ID. dcontext tracks the last saved message offset per session and only sends new messages on each pre-compact, avoiding duplicate conversation entries in dbrain.

## 0.1.0

### Minor Changes

- 6f3e580: Add ASCII art banners to all CLI help outputs (dbrain, dproxy, dcontext). Migrate dbrain CLI to Commander. Add Codex CLI, Gemini CLI, and OpenCode support to dbrain connect and dcontext install/hooks. Move dcontext MD section helpers to core. Remove Ollama adapter.

### Patch Changes

- Updated dependencies [6f3e580]
  - @dtoolkit/core@0.4.0
  - @dtoolkit/adapter-claude@1.3.0
  - @dtoolkit/adapter-codex@1.3.0
  - @dtoolkit/adapter-gemini@1.3.0
  - @dtoolkit/adapter-opencode@1.3.0
  - @dtoolkit/sdk@0.3.1

## 0.0.3

### Patch Changes

- Updated dependencies [6ab5cf2]
  - @dtoolkit/core@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies [77f2f95]
  - @dtoolkit/core@0.2.2

## 0.0.1

### Patch Changes

- Updated dependencies [a05b65b]
  - @dtoolkit/core@0.2.1
