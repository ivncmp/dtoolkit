# @dtoolkit/dops

## 1.0.0

### Major Changes

- 01aa6ac: v1.0.0 — production-ready launch. All core packages graduate to stable.

### Patch Changes

- Updated dependencies [01aa6ac]
- Updated dependencies [01aa6ac]
  - @dtoolkit/core@1.0.0
  - @dtoolkit/adapter-claude@1.5.0
  - @dtoolkit/adapter-codex@1.5.0
  - @dtoolkit/adapter-gemini@1.5.0
  - @dtoolkit/adapter-opencode@1.5.0

## 0.1.1

### Patch Changes

- fed8957: fix(dops): create ~/.dops directory before saving ingest state

## 0.1.0

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

### Patch Changes

- Updated dependencies [7c98ca3]
  - @dtoolkit/core@0.6.0
  - @dtoolkit/adapter-claude@1.4.0
  - @dtoolkit/adapter-codex@1.4.0
  - @dtoolkit/adapter-gemini@1.4.0
  - @dtoolkit/adapter-opencode@1.4.0

## 0.0.6

### Patch Changes

- Updated dependencies [31c13d1]
  - @dtoolkit/core@0.5.0

## 0.0.5

### Patch Changes

- Updated dependencies [7f5260f]
  - @dtoolkit/core@0.4.1

## 0.0.4

### Patch Changes

- Updated dependencies [6f3e580]
  - @dtoolkit/core@0.4.0

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
