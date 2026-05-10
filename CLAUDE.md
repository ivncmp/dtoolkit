# dbrain

Your distributed mind. Wherever you go, I remember.

## What is it

dbrain is a brain for your AIs. It stores who they are, who you are, and everything you've done together. Install it once, and every AI you use — at home, at work, on mobile — connects to the same brain. Same identity, same memories, same knowledge. No matter where you are.

```
[Home]   Claude Code ──MCP──┐
[Work]   Claude Code ──MCP──┤     ┌───────────────────────┐
[Mobile] Gemini ──REST──────┼────→│  dbrain (your mind)   │
[Server] OpenClaw ──REST────┤     │  identity + memory + knowledge
[Other]  Custom AI ──API────┘     └───────────────────────┘
```

## Architecture

The brain has 4 layers:

1. **Identity** — Who am I? Who are you? How should I behave? Stored in `documents`. Every AI reads this first when it connects. One identity, many machines.
2. **Conversations** — Raw chat history from every AI session. Every message pair (user <-> assistant) gets stored. The brain remembers every conversation, from every machine.
3. **Knowledge** — Structured facts organized by PARA (Projects/Areas/Resources/Archives). Typed entities (person, project, event, system). Hot/warm/cold tiers by access frequency. Memories that matter stay hot, the rest fades — like a real brain.
4. **Recall** — Full-text search (FTS5) over all facts. Ask a question, get the memory.

Optional: with an LLM configured, dbrain periodically reviews unprocessed conversations and extracts facts into the knowledge layer. Like a brain consolidating memories during sleep.

## Stack

| Layer | Technology |
|-------|-----------|
| Language | Node.js + TypeScript |
| API | Fastify |
| DB | SQLite + FTS5 (better-sqlite3) |
| MCP | @modelcontextprotocol/sdk (HTTP transport) |
| Validation | Zod |
| CLI | @clack/prompts (interactive wizard) |
| Dashboard | Single-file React app (CDN, no build step) |
| Port | `:7878` (REST API + MCP HTTP, same port), `:7879` (Dashboard) |

## Installation & Usage

Two-step process: **init** the brain (server), then **connect** clients.

### Server setup

```bash
# Install globally
npm install -g dbrain

# Initialize the brain (interactive wizard — server only)
dbrain init

# Start the server
dbrain start

# Check status
dbrain status
```

### Client setup

```bash
# Connect a client to a running brain (client only)
dbrain connect claude http://your-server:7878
```

This fetches the config from the brain and writes three local files:
- `~/.claude.json` — MCP server registration
- `~/.claude/settings.json` — Tool permissions
- `~/.claude/CLAUDE.md` — Behavioral instructions

### Docker (to run as a 24/7 service)

```bash
docker compose up -d
```

Docker internally runs `dbrain init --non-interactive + dbrain start`.

After the server is running, connect from any client machine:
```bash
dbrain connect claude http://your-server:7878
```

## CLI Commands

| Command | Where | Purpose |
|---------|-------|---------|
| `dbrain init [path]` | Server | Create a new brain (DB, config, identity) |
| `dbrain start [path]` | Server | Start the API server + dashboard |
| `dbrain connect <client> [url]` | Client | Connect a client to a running brain |
| `dbrain status [path]` | Server | Check brain status |

### init vs connect (separation of concerns)

`init` and `connect` are deliberately separate commands for different machines:

- **`init`** runs on the **server**. Creates the brain: config file, SQLite database, identity documents, initial entities. It knows nothing about Claude Code or any client.
- **`connect`** runs on the **client**. Fetches `GET /connect` from the brain server and writes the three local config files Claude Code needs. It knows nothing about how the brain is implemented.

This separation means:
- A brain on a cloud server doesn't need to know about Claude Code's file layout
- A client machine doesn't need the brain's source code or dependencies
- Any future client type (VS Code extension, mobile app, custom tool) can read `/connect` and self-configure

### Non-interactive init (Docker/CI)

Environment variables for `dbrain init --non-interactive`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DBRAIN_DATA` | `~/.dbrain` | Data path |
| `DBRAIN_PORT` | `7878` | API port |
| `DBRAIN_HOST` | `0.0.0.0` | Bind address |
| `DBRAIN_TOKEN` | Auto-generated | Access token |
| `DBRAIN_AGENT_NAME` | `dBrain` | AI identity name |
| `DBRAIN_OWNER_NAME` | `Human` | Owner name |
| `DBRAIN_TIMEZONE` | Auto-detected | Owner timezone |

## Init Wizard

`dbrain init` asks:

| Question | Default | Purpose |
|----------|---------|---------|
| Data path | `~/.dbrain` | Where the brain lives on disk |
| API port | `7878` | Port for REST + MCP |
| Bind address | `0.0.0.0` | `127.0.0.1` (local) or `0.0.0.0` (network) |
| Access token | Auto-generated `sk-dbr_...` | Bearer auth for API and MCP |
| Agent name | `dBrain` | The AI's identity |
| Owner name | — | Your name |
| Timezone | Auto-detected | Your timezone |

Result: creates `config.json` + `dbrain.db` with identity seeded + owner and agent entities.

## Data path structure (after init)

```
~/.dbrain/
├── config.json                 # Generated by init
└── dbrain.db                   # SQLite + FTS5 (all data lives here)
```

## Project structure (source code)

```
dbrain/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI entry point (bin)
│   │   ├── init.ts             # Init wizard — server only (brain setup)
│   │   ├── connect.ts          # Client setup — fetches /connect, writes Claude Code config
│   │   ├── start.ts            # Wake up the brain + dashboard
│   │   └── status.ts           # Brain status
│   ├── server/
│   │   ├── index.ts            # Fastify app + auth + CORS
│   │   └── routes/
│   │       ├── health.ts       # GET /health + GET /connect (client config endpoint)
│   │       ├── workspace.ts    # Identity layer (documents CRUD)
│   │       ├── conversations.ts # Chat history storage
│   │       ├── entities.ts     # Knowledge entities CRUD
│   │       ├── facts.ts        # Facts CRUD + access bump
│   │       └── search.ts       # Recall (FTS5 search)
│   ├── mcp/
│   │   └── server.ts           # MCP HTTP server (same port as REST)
│   ├── dashboard/
│   │   ├── index.html          # Single-file React dashboard (CDN, no build)
│   │   └── server.ts           # Fastify static server on port 7879
│   └── core/
│       ├── db.ts               # SQLite schema (entities, facts, documents, conversations, messages)
│       ├── models.ts           # Zod schemas
│       ├── config.ts           # Config loading
│       └── memory.ts           # Tier logic: hot/warm/cold
├── Dockerfile
└── docker-compose.yml
```

## Connecting clients

### Automatic (recommended)

```bash
# On the client machine, with the brain running:
dbrain connect claude http://your-server:7878
```

This calls `GET /connect` on the brain, which returns the exact MCP config, permissions, and behavioral instructions needed. The `connect` command writes them to the three local files automatically.

### Manual (if connect isn't available)

Three things needed for Claude Code integration:

**1. MCP server config** — Add to `~/.claude.json` (user-level `mcpServers`):
```json
{
  "mcpServers": {
    "dbrain": {
      "type": "http",
      "url": "http://your-server:7878/mcp",
      "headers": { "Authorization": "Bearer sk-dbr_..." }
    }
  }
}
```

> **Important**: Use `type: "http"`, not `type: "url"`. Claude Code's MCP schema only accepts `http` for HTTP-based servers.

**2. Permissions** — Add to `~/.claude/settings.json` to allow all dbrain tools without prompting:
```json
{
  "permissions": {
    "allow": ["mcp__dbrain__*"]
  }
}
```

**3. Behavioral instructions** — Add to `~/.claude/CLAUDE.md` so Claude actually uses the brain. The content is served by `GET /connect` — or see `src/server/routes/health.ts` for the full text.

> **Why CLAUDE.md is required**: MCP tools are passive — Claude won't use them unless instructed. There is no MCP standard for auto-executing tools on connect. `~/.claude/CLAUDE.md` is the only reliable mechanism to make Claude use MCP tools proactively.

### REST API (any AI or app)

```bash
curl -H "Authorization: Bearer sk-dbr_..." \
  http://your-server:7878/search \
  -d '{"query": "react stack"}'
```

## REST Endpoints (port 7878)

All require `Authorization: Bearer <token>` except `/health` and `/connect`.

```
# Pulse
GET    /health                    Who am I? Am I awake?

# Client config
GET    /connect                   Returns MCP config, permissions, CLAUDE.md content

# Identity (workspace documents)
GET    /workspace                 List all identity docs
GET    /workspace/:key            Read one (identity, user, soul, memory...)
PUT    /workspace/:key            Create or update
DELETE /workspace/:key            Remove

# Knowledge (PARA entities + facts)
GET    /entities                  List entities
GET    /entities/:id              Entity with all its facts
POST   /entities                  Create entity
DELETE /entities/:id              Archive entity

GET    /entities/:id/facts        Facts for an entity
POST   /entities/:id/facts        Add a fact
PATCH  /facts/:id/access          Bump access (keeps memory hot)

# Conversations (chat history)
GET    /conversations              List conversations (filter by ?source=)
GET    /conversations/:id          Full conversation with messages
POST   /conversations              Start a new conversation
POST   /conversations/:id/messages Send messages (single or batch)
GET    /conversations/:id/messages List messages (filter by ?processed=)
GET    /conversations/pending      Unprocessed messages overview

# Recall
POST   /search                    Full-text search over all facts
GET    /memory/summary            Overview: entities x tiers
```

## Dashboard (port 7879)

Single-file React app served on port `API_PORT + 1` (default: 7879). Shows:
- Brain status with live pulse indicator
- Stats: entities, facts (hot/warm/cold), conversations
- Full-text search over memories
- Entity grid with PARA category coloring and tier badges
- Entity detail view with all facts
- Conversation list with date, source, and click-to-view messages
- Token-based auth (stored in localStorage)

No build step — uses React 18 + Babel from CDN.

## MCP Tools

- `recall` — FTS search over all facts + returns identity documents. This is the primary tool — one call gives the AI both memory results and identity context.
- `remember` — add a fact to an entity (preference, decision, personal detail)
- `wake_up` — full identity load (documents + stats). Redundant with `recall` but available for clients that need identity without a search.
- `get_entity` — read entity with all its facts
- `list_entities` — list entities by PARA category or type
- `create_entity` — create a new entity (project, person, system, event)
- `bump` — touch a memory to keep it hot
- `log` — send conversation messages to the brain for storage
- `overview` — brain stats: entities x tiers, conversations, unprocessed messages

### MCP Resource

- `dbrain://brain` — Static resource with identity summary, user profile, brain stats, and usage instructions. Available for clients that support auto-loading MCP resources (Claude Code does not auto-load these currently).

### Search behavior

FTS5 search uses OR logic: query `"helado favorito ice cream"` becomes `"helado OR favorito OR ice OR cream"`. A fact matches if any word hits. This is intentional — AI clients often send mixed-language or multi-keyword queries.

## Configuration (config.json)

Generated by `dbrain init`:

```json
{
  "dataPath": "/home/user/.dbrain",
  "port": 7878,
  "host": "0.0.0.0",
  "token": "sk-dbr_a7f3...",
  "tiers": {
    "hotDays": 7,
    "hotMinAccess": 10,
    "warmDays": 30
  }
}
```

## Tier rules (memory decay)

Memories fade if you don't use them — like a real brain.

- **hot**: `lastAccessed` <= 7 days or `accessCount` >= 10
- **warm**: 8-30 days
- **cold**: > 30 days

Tiers recompute on server startup and on each access bump.

## What dbrain is NOT

- Not an AI agent — it doesn't think, it remembers
- Not an assistant — it doesn't help, it stores
- Not a model — it doesn't compute, it recalls

Any AI that connects brings its own intelligence. dbrain brings the continuity.

Optionally, with an LLM configured, the brain can consolidate: review unprocessed conversations and extract facts. Like sleeping — the brain organizes what happened during the day.

## MCP integration lessons learned

Things we discovered while integrating with Claude Code:

- **`type: "http"` not `"url"`** — Claude Code's MCP schema rejects `type: "url"`. Use `type: "http"` for Streamable HTTP transport.
- **MCP tools are passive** — The AI decides when to call them. Tool descriptions saying "call this at the start" are suggestions, not guarantees. The only reliable way to make Claude use tools proactively is via CLAUDE.md instructions.
- **MCP resources are pull-based** — Claude Code can list them but doesn't auto-load them into context. There's no UI to pin resources either.
- **`mcpContextUris` doesn't work with custom schemes** — Setting `["dbrain://brain"]` in `.claude.json` had no effect. May only work with built-in URI schemes.
- **Identity via recall, not wake_up** — Instead of relying on Claude calling a separate `wake_up` tool (which it skips), we piggyback identity documents on every `recall` response. One tool call = identity + search results.
- **FTS5 defaults to AND** — A multi-word query returns nothing if any word is missing from the fact. We convert to OR so mixed-language and multi-keyword queries from AI clients work.
- **Permissions in `~/.claude/settings.json`** — Use `"mcp__dbrain__*"` wildcard to allow all tools globally without per-project prompts.
- **Logs need MCP method info** — Fastify's default request logging only shows `POST /mcp`. Custom logging extracts the JSON-RPC method and tool name/args from the request body.
- **Separate init from connect** — `init` is server-side (creates brain), `connect` is client-side (configures Claude Code). A cloud brain shouldn't need to know about Claude Code's config files, and a client shouldn't need the brain's source code.
- **`/connect` endpoint** — The brain serves its own client config via `GET /connect`. Clients fetch it and self-configure. This decouples server implementation from client setup.

## Decisions (do not re-discuss)

- **Node.js + TypeScript** — project language
- **SQLite + FTS5** — zero deps, enough for hundreds of thousands of facts
- **PARA + tiered memory** — the differentiator
- **CLI-first** — `npx dbrain init/start`, Docker as optional wrapper
- **Single port** — REST + MCP HTTP on `:7878`
- **Bearer token auth** — friends-grade, one static token
- **Friends-grade** — no elaborate CI/CD, no multi-user
- **English only** — all code, docs, and files in English
- **Pure memory** — optional LLM consolidation, but core works without it
- **init = server, connect = client** — clean separation of concerns

## Dev commands

```bash
npm run dev      # dev server with watch
npm test         # vitest
npm run build    # compile TypeScript + copy dashboard HTML
```

## Conventions

- Strict TypeScript
- Commits in English
- Tests with vitest
