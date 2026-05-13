<p align="center">
  <img src="https://raw.githubusercontent.com/ivncmp/dtoolkit/main/logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dproxy</h1>
<p align="center">Universal adapter for invoking models — CLI and REST API</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dproxy"><img src="https://img.shields.io/npm/v/@dtoolkit/dproxy.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## Install

```bash
npm install -g @dtoolkit/dproxy
```

## Quick start

```bash
dproxy init              # interactive setup wizard
dproxy "explain this"    # single-shot prompt (default provider)
dproxy chat              # interactive REPL
dproxy serve             # start REST API server
```

## Providers

dproxy supports 5 providers out of the box. Each provider shells out to its respective CLI:

| Provider | CLI | Features |
| --- | --- | --- |
| `claude` (default) | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Sessions, cost, usage, tools, system prompt |
| `codex` | [Codex](https://github.com/openai/codex) | Usage, approval modes |
| `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Sessions, usage, yolo mode |
| `ollama` | [Ollama](https://ollama.com/) | Local/offline, any model |
| `opencode` | [OpenCode](https://github.com/nicholasgriffintn/opencode) | Sessions, cost, usage |

### Switching providers

```bash
# Per-command
dproxy -p ollama "explain this code"
dproxy ask -p gemini "write a test for this"
dproxy chat -p codex

# Set default in config
dproxy config set provider.default gemini
```

## Commands

### `dproxy <prompt>` / `dproxy ask <prompt>`

Single-shot prompt with context injection. Reads from stdin if piped.

```bash
# Basic usage
dproxy "explain what this function does"

# With a specific provider and model
dproxy -p ollama -m codellama "refactor this"

# Pipe content
cat src/index.ts | dproxy "review this code"
git diff | dproxy ask "summarize these changes"

# Raw JSON output
dproxy --raw "hello"

# JSON output format
dproxy -o json "hello"

# Token usage footer
dproxy --token-footer "explain monads"

# Skip memory/life context
dproxy --no-memory --no-life "just answer directly"

# Inject specific memory keys only
dproxy --memory "project-rules,style-guide" "review this"

# Limit agent turns and budget
dproxy --max-turns 5 --max-budget-usd 0.50 "refactor the auth module"

# System prompt override
dproxy ask --system-prompt "You are a security auditor" "review this code"

# Stream response in real-time
dproxy ask --stream "explain monads"
dproxy --stream --token-footer "write a haiku"
```

### `dproxy chat`

Interactive REPL with session tracking across turns.

```bash
# Start a new chat
dproxy chat

# Chat with a specific provider
dproxy chat -p gemini

# Continue the last conversation
dproxy chat -c

# Resume a specific session
dproxy chat -r sess_abc123
```

### `dproxy history`

Manage prompt history.

```bash
dproxy history list          # show recent entries
dproxy history show <id>     # show a specific entry
dproxy history search <q>    # search history
dproxy history clear         # clear all history
```

### `dproxy memory`

Named memory snippets injected into every prompt.

```bash
dproxy memory list           # list all snippets
dproxy memory get <key>      # show a snippet
dproxy memory set <key>      # set (reads from stdin or editor)
dproxy memory rm <key>       # delete a snippet
```

### `dproxy template`

YAML prompt templates with `{{variable}}` interpolation.

```bash
dproxy template list         # list templates
dproxy template show <name>  # show a template
dproxy template run <name>   # execute a template
dproxy template create       # create a new template
dproxy template rm <name>    # delete a template
```

### `dproxy config`

Get/set configuration values.

```bash
dproxy config                          # show full config
dproxy config get provider.default     # get a value
dproxy config set provider.default ollama  # set a value
```

### `dproxy init`

Interactive setup wizard. Required before first use.

```bash
dproxy init
```

### `dproxy serve`

Start the HTTP API server. Provides full CLI parity — everything you can do with the CLI, you can do via HTTP.

```bash
# Start with defaults (127.0.0.1:7880)
dproxy serve

# Custom port and host
dproxy serve --port 3000 --host 0.0.0.0

# Configure via config
dproxy config set server.port 8080
dproxy config set server.host 0.0.0.0
dproxy config set server.apiKey my-secret-key
```

## REST API

All endpoints are prefixed with `/v1`. When `server.apiKey` is configured, all endpoints (except `/v1/health`) require the `Authorization: Bearer <token>` header.

### CLI → HTTP mapping

| CLI command | HTTP equivalent |
| --- | --- |
| `dproxy ask "prompt"` | `POST /v1/ask` |
| `dproxy ask --stream "prompt"` | `POST /v1/ask` with `"stream": true` (SSE) |
| `dproxy history list` | `GET /v1/history` |
| `dproxy history show <id>` | `GET /v1/history/:id` |
| `dproxy history search <q>` | `GET /v1/history/search?q=` |
| `dproxy history clear` | `DELETE /v1/history` |
| `dproxy memory list` | `GET /v1/memory` |
| `dproxy memory get <key>` | `GET /v1/memory/:key` |
| `dproxy memory set <key> <val>` | `PUT /v1/memory/:key` |
| `dproxy memory search <q>` | `GET /v1/memory/search?q=` |
| `dproxy memory delete <key>` | `DELETE /v1/memory/:key` |
| `dproxy template list` | `GET /v1/templates` |
| `dproxy template show <name>` | `GET /v1/templates/:name` |
| `dproxy template add <name>` | `PUT /v1/templates/:name` |
| `dproxy template run <name>` | `POST /v1/templates/:name/run` |
| `dproxy template delete <name>` | `DELETE /v1/templates/:name` |
| `dproxy config` | `GET /v1/config` |
| `dproxy config get <key>` | `GET /v1/config/:key` |
| `dproxy config set <key> <val>` | `PUT /v1/config/:key` |
| — | `GET /v1/health` |

### Authentication

```bash
# Enable API key auth
dproxy config set server.apiKey my-secret-key

# Then include in all requests
curl -H "Authorization: Bearer my-secret-key" http://localhost:7880/v1/health
```

When no `server.apiKey` is set, all endpoints are open (suitable for local-only use).

### `POST /v1/ask`

Send a prompt to an AI model. Supports all the same options as the CLI. Set `"stream": true` for real-time Server-Sent Events (SSE).

**Request:**

```json
{
  "prompt": "explain what monads are",
  "stream": false,
  "provider": "claude",
  "model": "sonnet",
  "maxTurns": 5,
  "maxBudgetUsd": 0.50,
  "systemPrompt": "You are a Haskell expert",
  "memory": true,
  "life": true,
  "workspace": true,
  "chatLog": true,
  "sessionId": "sess_abc123",
  "continueSession": false,
  "maxSessionTokens": 100000,
  "saveHistory": true,
  "saveChatLog": true
}
```

Only `prompt` is required. All other fields are optional and use the same defaults as the CLI.

The `memory` field accepts `true` (inject all), `false` (skip), or an array of key names (inject specific keys only).

**Response (non-streaming):**

```json
{
  "text": "A monad is...",
  "sessionId": "sess_abc123",
  "costUsd": 0.0042,
  "durationMs": 1523,
  "usage": {
    "inputTokens": 150,
    "outputTokens": 320,
    "totalTokens": 470
  }
}
```

**Response (streaming):**

When `"stream": true`, the response uses `Content-Type: text/event-stream` (SSE). Each event is a JSON object on a `data:` line:

```
data: {"type":"text","text":"A monad "}
data: {"type":"text","text":"is a "}
data: {"type":"text","text":"design pattern..."}
data: {"type":"result","result":{"text":"A monad is a design pattern...","sessionId":"sess_abc","costUsd":0.004,"durationMs":1523,"isError":false,"usage":{"inputTokens":150,"outputTokens":320,"totalTokens":470}}}
data: [DONE]
```

Two event types: `text` (incremental chunks) and `result` (final aggregated result with metadata). The stream ends with `data: [DONE]`.

**Examples:**

```bash
# Non-streaming
curl -X POST http://localhost:7880/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key" \
  -d '{"prompt": "explain monads in one sentence"}'

# Streaming (SSE)
curl -N -X POST http://localhost:7880/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key" \
  -d '{"prompt": "explain monads", "stream": true}'
```

### `GET /v1/health`

Health check. Does not require API key.

**Response:**

```json
{
  "status": "ok",
  "provider": "claude",
  "version": "1.0.0"
}
```

### `GET /v1/history`

List recent history entries.

| Query param | Default | Description |
| --- | --- | --- |
| `limit` | `20` | Number of entries to return |

**Response:**

```json
{
  "entries": [
    {
      "id": "uuid",
      "timestamp": "2025-01-15T10:30:00Z",
      "prompt": "explain monads",
      "result": "A monad is...",
      "sessionId": "sess_abc",
      "costUsd": 0.004,
      "durationMs": 1200,
      "model": "sonnet"
    }
  ]
}
```

### `GET /v1/history/:id`

Get a specific history entry by ID (full or prefix match).

**Response:** The full `HistoryEntry` object, or `404`.

### `GET /v1/history/search?q=<query>`

Search history by prompt or response content (case-insensitive).

**Response:** `{ "entries": [...] }`

### `DELETE /v1/history`

Clear history entries.

| Query param | Default | Description |
| --- | --- | --- |
| `before` | — | ISO date string; only clear entries before this date |

**Response:** `{ "removed": 42 }`

### `GET /v1/memory`

List all memory keys.

**Response:** `{ "keys": ["project-rules", "style-guide", "context"] }`

### `GET /v1/memory/search?q=<query>`

Search memory snippets by key name or content.

**Response:**

```json
{
  "results": [
    { "key": "project-rules", "content": "Always use strict TypeScript..." }
  ]
}
```

### `GET /v1/memory/:key`

Get a memory snippet by key.

**Response:** `{ "key": "project-rules", "content": "..." }` or `404`.

### `PUT /v1/memory/:key`

Create or update a memory snippet.

**Request:** `{ "content": "Always use strict TypeScript and ESM." }`

**Response:** `{ "ok": true, "key": "project-rules" }`

### `DELETE /v1/memory/:key`

Delete a memory snippet.

**Response:** `{ "ok": true, "key": "project-rules" }` or `404`.

### `GET /v1/templates`

List all templates.

**Response:**

```json
{
  "templates": [
    {
      "name": "code-review",
      "description": "Review code for quality",
      "prompt": "Review this code: {{code}}"
    }
  ]
}
```

### `GET /v1/templates/:name`

Get a template by name.

**Response:** The full `TemplateDefinition` object, or `404`.

### `PUT /v1/templates/:name`

Create or update a template. The `name` in the URL takes precedence.

**Request:**

```json
{
  "description": "Review code for quality",
  "prompt": "Review this {{language}} code:\n\n{{code}}",
  "variables": [
    { "name": "language", "default": "TypeScript" },
    { "name": "code", "required": true }
  ]
}
```

**Response:** `{ "ok": true, "name": "code-review" }`

### `POST /v1/templates/:name/run`

Execute a template with variables and get the AI response.

**Request:**

```json
{
  "vars": {
    "language": "Python",
    "code": "def foo(): pass"
  },
  "model": "sonnet",
  "maxTurns": 3,
  "provider": "claude"
}
```

All fields are optional. Missing variables with defaults use their defaults. Missing required variables return `400`.

**Response:** Same as `POST /v1/ask`.

### `DELETE /v1/templates/:name`

Delete a template.

**Response:** `{ "ok": true, "name": "code-review" }` or `404`.

### `GET /v1/config`

Get the full configuration object.

### `GET /v1/config/:key`

Get a config value by dot-notation key (e.g., `/v1/config/provider.default`).

**Response:** `{ "key": "provider.default", "value": "claude" }` or `404`.

### `PUT /v1/config/:key`

Set a config value. Booleans and numbers are auto-parsed.

**Request:** `{ "value": "ollama" }`

**Response:** `{ "ok": true, "key": "provider.default", "value": "ollama" }`

### Error responses

All errors follow a consistent format:

```json
{
  "error": "description of what went wrong"
}
```

| Status | Meaning |
| --- | --- |
| `400` | Bad request (missing required fields) |
| `401` | Invalid or missing API key |
| `404` | Resource not found |
| `500` | Internal server error |

## Flags reference

| Flag | Scope | Description |
| --- | --- | --- |
| `-p, --provider <name>` | ask, chat | Provider: `claude`, `codex`, `gemini`, `ollama`, `opencode` |
| `-m, --model <model>` | ask, chat | Model to use |
| `--max-turns <n>` | ask, chat | Max agent turns per message |
| `--max-budget-usd <n>` | ask | Max budget in USD |
| `-o, --output-format <fmt>` | ask | Output format: `text`, `json`, `stream-json` |
| `--stream` | ask | Stream response text in real-time |
| `--system-prompt <text>` | ask | System prompt override |
| `--no-memory` | ask, chat | Skip memory injection |
| `--memory <keys>` | ask | Inject specific memory keys (comma-separated) |
| `--no-life` | ask, chat | Skip life/PARA context |
| `--no-history` | ask | Don't save to history |
| `--raw` | ask | Print raw JSON response |
| `--token-footer` | ask | Append token usage footer |
| `--max-session-tokens <n>` | ask | Reset session if context exceeds this |
| `-c, --continue` | ask, chat | Continue last conversation |
| `-r, --resume <id>` | ask, chat | Resume a specific session |
| `--port <port>` | serve | Port to listen on (default: 7880) |
| `--host <host>` | serve | Host to bind to (default: 127.0.0.1) |

## Context injection

Every prompt is enriched with context from multiple sources, in priority order:

1. **Day chat log** — today's conversation history
2. **Workspace bootstrap** — identity/personality files
3. **Memory snippets** — named markdown snippets (truncated to 4,000 chars)
4. **Life/PARA context** — semantic knowledge base (truncated to 12,000 chars)

Disable with `--no-memory` and `--no-life`.

## Provider configuration

Configure provider-specific options in `~/.dproxy/config.json`:

```json
{
  "provider": {
    "default": "claude",
    "claude": {
      "bin": "claude",
      "skipPermissions": false
    },
    "codex": {
      "bin": "codex",
      "approval": "suggest"
    },
    "gemini": {
      "bin": "gemini",
      "yolo": false
    },
    "ollama": {
      "bin": "ollama",
      "defaultModel": "llama3"
    },
    "opencode": {
      "bin": "opencode",
      "skipPermissions": false
    }
  }
}
```

## Server configuration

Configure the HTTP server in `~/.dproxy/config.json`:

```json
{
  "server": {
    "port": 7880,
    "host": "127.0.0.1",
    "apiKey": "my-secret-key"
  }
}
```

| Key | Default | Description |
| --- | --- | --- |
| `server.port` | `7880` | Port to listen on |
| `server.host` | `127.0.0.1` | Host to bind to |
| `server.apiKey` | — | API key for authentication (optional) |

## Data storage

```
~/.dproxy/
├── config.json          # App configuration
├── history.jsonl        # Prompt history
├── current-session.json # Active session state
├── memory/              # Named memory snippets (.md)
└── templates/           # Prompt templates (.yaml)
```

Override with `DPROXY_DATA_DIR` env var.

## License

[MIT](../../LICENSE)
