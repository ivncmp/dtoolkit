# @dtoolkit/sdk

## 0.5.1

### Patch Changes

- b2f69b6: Support atomic task + detail doc creation in DWorkClient.

## 0.5.0

### Minor Changes

- d5cbd7b: dwork: dashboard with overview, global kanban, task detail modal, docs file tree, mobile responsive, Light/Dark themes. Full REST API, MCP tools, CLI commands.

  dbrain: dashboard auth fix, login unification, mobile responsive, hamburger menu, Light/Dark themes.

  sdk: add DWorkClient with 22 typed methods for dwork REST API.

## 0.4.1

### Patch Changes

- Updated dependencies [31c13d1]
  - @dtoolkit/core@0.5.0

## 0.4.0

### Minor Changes

- 7f5260f: Federation polish: fix empty query crash in search/MCP, add `searchFederated()` and federation types to SDK, add federation awareness to dcontext briefing and status, update all docs with Mermaid diagrams

### Patch Changes

- Updated dependencies [7f5260f]
  - @dtoolkit/core@0.4.1

## 0.3.1

### Patch Changes

- 6f3e580: Add ASCII art banners to all CLI help outputs (dbrain, dproxy, dcontext). Migrate dbrain CLI to Commander. Add Codex CLI, Gemini CLI, and OpenCode support to dbrain connect and dcontext install/hooks. Move dcontext MD section helpers to core. Remove Ollama adapter.
- Updated dependencies [6f3e580]
  - @dtoolkit/core@0.4.0

## 0.3.0

### Minor Changes

- 6ab5cf2: feat: add file support across the stack (text, images, PDFs)

  New `InputFile` type and `files` field in `AdapterRequest` allow passing files alongside prompts.
  Text files are embedded directly in the prompt; binary files (images, PDFs) are embedded as base64 blocks.
  - **core**: `InputFile`, `embedTextFiles()`, `detectMimeType()`, `isTextFile()`
  - **adapters**: all 5 adapters call `embedTextFiles()` to handle attached files
  - **dproxy CLI**: `--file <path>` flag (repeatable) reads files from disk
  - **dproxy HTTP**: `files` field in `POST /v1/ask` request body
  - **SDK**: `files` in `AskOptions`, `InputFile` re-exported

### Patch Changes

- Updated dependencies [6ab5cf2]
  - @dtoolkit/core@0.3.0

## 0.2.0

### Minor Changes

- cf1fb2b: feat: initial release — typed HTTP clients for dbrain and dproxy with unified Bearer token auth
