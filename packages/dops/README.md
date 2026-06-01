<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dops</h1>
<p align="center">Agent observability — tokens, cost, tools, success rate, errors</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dops"><img src="https://img.shields.io/npm/v/@dtoolkit/dops.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

Datadog for AI coding agents. Ingest telemetry from Claude, Codex, Gemini, and OpenCode sessions — track tokens, costs, tool usage, and errors across your team.

## Install

```bash
npm install -g @dtoolkit/dops
```

## Quick start

```bash
dops init                  # set up config + database
dops start                 # API on :7883, dashboard on :7884
dops ingest --url http://localhost:7883 --token <token>   # scan local transcripts
```

## CLI commands

| Command | Description |
| --- | --- |
| `dops init [path]` | Initialize config and SQLite database |
| `dops start [path]` | Launch API server + web dashboard |
| `dops status [path]` | Health check — sessions, events, errors |
| `dops ingest` | Scan local CLI transcripts and push telemetry |
| `dops stats` | Token and tool usage breakdown |
| `dops costs` | Cost estimation by model |

### Ingest

Scans local transcript files from supported sources and pushes session data to the dops server.

```bash
dops ingest --url http://localhost:7883 --token <token>
dops ingest --days 7 --source claude codex    # last 7 days, specific sources
dops ingest --dry-run                          # preview without pushing
```

Supported sources: `claude`, `codex`, `gemini`, `opencode` (via `@dtoolkit/adapter-*` packages).

### Stats and costs

```bash
dops stats --url http://localhost:7883 --token <token>
dops stats --days 7 --source claude

dops costs --url http://localhost:7883 --token <token> --days 30
```

## Dashboard

Web UI on port `7884` (API port + 1) with four views:

- **Overview** — sessions, tokens, cache reads, tool calls, errors, cost. Time-series chart.
- **Sessions** — paginated list with source/model/date filters.
- **Tools** — top tools by call count, success rate, average duration.
- **Costs** — cost breakdown by model with built-in pricing (Claude, GPT-4o, Gemini).

## REST API

Bearer token authentication on all endpoints.

### Ingestion

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/sessions` | Create session |
| `PATCH` | `/sessions/:id` | End session |
| `POST` | `/events/batch` | Batch events (max 1000) |
| `POST` | `/tool-calls` | Record tool invocation |
| `POST` | `/token-usage` | Record token usage |
| `POST` | `/errors` | Record error |

### Query

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/sessions` | List sessions (filter by source, model, status, date) |
| `GET` | `/sessions/:id` | Session detail with events, tools, tokens |
| `GET` | `/stats/timeseries` | Token usage buckets (1h / 15m) |
| `GET` | `/stats/tools` | Tool usage stats |
| `GET` | `/stats/models` | Stats by model |
| `GET` | `/stats/sources` | Stats by source |
| `GET` | `/health` | Server health + stats snapshot |

## MCP tools

When running, dops exposes MCP tools on the `/mcp` endpoint:

| Tool | Description |
| --- | --- |
| `observe` | Quick overview — sessions, tokens, tool calls, errors |
| `stats` | Time-series token usage |
| `tools` | Tool usage analytics |
| `sessions` | List recent sessions |
| `session_detail` | Full session detail |
| `errors` | List recent errors |

## Configuration

Config stored at `<dataPath>/config.json`. Environment variable overrides: `DOPS_PORT`, `DOPS_HOST`, `DOPS_TOKEN`.

Built-in pricing for Claude (Opus, Sonnet, Haiku), GPT-4o, and Gemini models. Customizable via config.

## Data storage

- Default path: `~/.dops/`
- SQLite database with tables: sessions, events, tool_calls, token_usage, errors, api_keys
- All timestamps in UTC

## License

[MIT](../../LICENSE)
