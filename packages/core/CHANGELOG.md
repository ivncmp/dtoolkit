# @dtoolkit/core

## 0.6.0

### Minor Changes

- 7c98ca3: feat(dops): full implementation — agent observability with multi-CLI telemetry
  - Scaffold: Fastify server on :7883, SQLite schema (sessions, events, tool_calls, errors, token_usage), CLI with commander + @clack/prompts
  - Ingest API: POST /sessions, /events, /events/batch, /tool-calls, /token-usage, /errors with Zod validation and upsert support
  - Telemetry extractors: TelemetryExtractor interface in core, implementations in each adapter (Claude JSONL, Codex JSONL, Gemini JSONL, OpenCode SQLite)
  - CLI ingest: `dops ingest` scans local transcripts from all 4 CLIs, incremental state tracking, auto machine ID via hostname
  - Query API: GET /sessions, /stats/timeseries (1h/15m buckets), /stats/tools, /stats/models, /stats/sources with source LIKE filtering
  - MCP server: 6 tools (observe, stats, tools, sessions, session_detail, errors) on /mcp endpoint
  - CLI commands: init, start, status, ingest, stats, costs
  - Dashboard: single-file React 18 app (CDN, no build) with Light/Dark themes, donut charts, bar charts with axes and tooltips, horizontal bars, sparklines, session filters, pagination
  - Cost estimation: configurable pricing table in config.json, served via /health endpoint
  - Tool call extraction includes args (truncated), error messages, and duration_ms

## 0.5.0

### Minor Changes

- 31c13d1: Add brain compaction system: structural dedup of cold facts with Dice coefficient similarity, scheduled compaction via cron, REST and MCP compact endpoints, and interactive `dbrain configure` command.

## 0.4.1

### Patch Changes

- 7f5260f: Federation polish: fix empty query crash in search/MCP, add `searchFederated()` and federation types to SDK, add federation awareness to dcontext briefing and status, update all docs with Mermaid diagrams

## 0.4.0

### Minor Changes

- 6f3e580: Add ASCII art banners to all CLI help outputs (dbrain, dproxy, dcontext). Migrate dbrain CLI to Commander. Add Codex CLI, Gemini CLI, and OpenCode support to dbrain connect and dcontext install/hooks. Move dcontext MD section helpers to core. Remove Ollama adapter.

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

## 0.2.2

### Patch Changes

- 77f2f95: feat: add raw provider event to AdapterStreamEvent text events for native JSONL passthrough

## 0.2.1

### Patch Changes

- a05b65b: fix: read version dynamically instead of hardcoding, fix LineBuffer lint warning
