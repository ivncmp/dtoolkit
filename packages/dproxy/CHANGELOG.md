# @dtoolkit/dproxy

## 1.4.1

### Patch Changes

- Updated dependencies [7f5260f]
  - @dtoolkit/core@0.4.1
  - @dtoolkit/adapter-claude@1.3.1
  - @dtoolkit/adapter-codex@1.3.1
  - @dtoolkit/adapter-gemini@1.3.1
  - @dtoolkit/adapter-opencode@1.3.1

## 1.4.0

### Minor Changes

- 6f3e580: Add ASCII art banners to all CLI help outputs (dbrain, dproxy, dcontext). Migrate dbrain CLI to Commander. Add Codex CLI, Gemini CLI, and OpenCode support to dbrain connect and dcontext install/hooks. Move dcontext MD section helpers to core. Remove Ollama adapter.

### Patch Changes

- Updated dependencies [6f3e580]
  - @dtoolkit/core@0.4.0
  - @dtoolkit/adapter-claude@1.3.0
  - @dtoolkit/adapter-codex@1.3.0
  - @dtoolkit/adapter-gemini@1.3.0
  - @dtoolkit/adapter-opencode@1.3.0

## 1.3.0

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
  - @dtoolkit/adapter-claude@1.2.0
  - @dtoolkit/adapter-codex@1.2.0
  - @dtoolkit/adapter-gemini@1.2.0
  - @dtoolkit/adapter-ollama@1.2.0
  - @dtoolkit/adapter-opencode@1.2.0

## 1.2.0

### Minor Changes

- cf1fb2b: feat: migrate server auth from X-API-Key header to unified Authorization Bearer token

## 1.1.4

### Patch Changes

- 9638eb6: fix: --stream --raw outputs native provider JSONL without AdapterStreamEvent wrapper

## 1.1.3

### Patch Changes

- 77f2f95: feat: add raw provider event to AdapterStreamEvent text events for native JSONL passthrough
- Updated dependencies [77f2f95]
  - @dtoolkit/core@0.2.2
  - @dtoolkit/adapter-claude@1.1.2
  - @dtoolkit/adapter-codex@1.1.2
  - @dtoolkit/adapter-gemini@1.1.2
  - @dtoolkit/adapter-ollama@1.1.2
  - @dtoolkit/adapter-opencode@1.1.2

## 1.1.2

### Patch Changes

- 6cb2645: feat: add --stream --raw mode for JSONL output, add --stream to root command help

## 1.1.1

### Patch Changes

- a05b65b: fix: read version dynamically instead of hardcoding, fix LineBuffer lint warning
- Updated dependencies [a05b65b]
  - @dtoolkit/core@0.2.1
  - @dtoolkit/adapter-claude@1.1.1
  - @dtoolkit/adapter-codex@1.1.1
  - @dtoolkit/adapter-gemini@1.1.1
  - @dtoolkit/adapter-ollama@1.1.1
  - @dtoolkit/adapter-opencode@1.1.1

## 0.2.0

### Minor Changes

- 1dea7ae: Migrate chalk to picocolors, unify CLI library conventions
