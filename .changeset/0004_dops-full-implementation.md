---
'@dtoolkit/dops': minor
'@dtoolkit/core': minor
'@dtoolkit/adapter-claude': minor
'@dtoolkit/adapter-codex': minor
'@dtoolkit/adapter-gemini': minor
'@dtoolkit/adapter-opencode': minor
---

feat(dops): full implementation — agent observability with multi-CLI telemetry

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
