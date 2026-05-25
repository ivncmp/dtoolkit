# dwork

AI-native, MD-driven project manager. Part of the dtoolkit suite.

## What is it

dwork manages projects using Markdown files as the source of truth. Tasks live in `BACKLOG.md`, documentation in numbered `docs/` files, all with YAML frontmatter. SQLite + FTS5 provides fast search and indexing, but the `.md` files are always canonical.

**Key principle**: dwork and dbrain are completely independent. dbrain stores entities, facts, and conversations. dwork stores projects, tasks, roadmaps, and technical documentation. They don't know about each other. dcontext is the bridge that reads from both.

## Architecture

The heart of dwork is the **service layer** (`src/service/`). All business logic lives there. Interfaces (CLI, REST, MCP, SDK, Dashboard) are thin wrappers — none is more important than another.

```
Service Layer (src/service/)
    ├── CLI (src/cli/)
    ├── REST API (src/server/)
    ├── MCP Server (src/mcp/)
    ├── Dashboard (src/dashboard/, port+1)
    └── SDK Client (in @dtoolkit/sdk, future)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Language | Node.js + TypeScript |
| API | Fastify |
| DB | SQLite + FTS5 (better-sqlite3) — contentless FTS |
| MCP | @modelcontextprotocol/sdk (HTTP transport) |
| Validation | Zod |
| CLI | commander + @clack/prompts |
| Port | `:7881` (REST + MCP), `:7882` (Dashboard) |

## Project structure

```
src/
├── core/
│   ├── config.ts       Config loading + Zod schema
│   ├── models.ts       Zod schemas: Project, Task, Doc, enums
│   ├── db.ts           SQLite schema + FTS5 (contentless) + migrations
│   ├── parser.ts       BACKLOG.md parser + serializer + frontmatter
│   ├── indexer.ts       MD → SQLite sync (walk, hash, upsert, FTS5)
│   └── templates.ts    Scaffold templates for 4 mandatory MDs
├── service/
│   ├── projects.ts     CRUD + scaffold + index
│   ├── tasks.ts        CRUD via BACKLOG.md + what_to_do_next
│   ├── docs.ts         CRUD for numbered docs + roadmap
│   ├── search.ts       FTS5 search across tasks + docs (OR logic)
│   ├── overview.ts     Global stats
│   ├── sync.ts         Sync via dproxy
│   └── utils.ts        genId helper
├── server/
│   ├── index.ts        Fastify app + auth + CORS + route registration
│   └── routes/
│       ├── health.ts   GET /health (no auth)
│       ├── projects.ts GET/POST/PATCH/DELETE /projects
│       ├── tasks.ts    CRUD /projects/:slug/tasks, /tasks/:id
│       ├── docs.ts     CRUD /projects/:slug/docs, /docs/:id
│       ├── search.ts   POST /search
│       ├── overview.ts GET /overview, GET /next
│       ├── sync.ts     POST /sync/:slug
│       ├── keys.ts     POST/GET/DELETE /keys (admin-only)
│       └── permissions.ts  requireWrite() middleware
├── mcp/
│   └── server.ts       13 MCP tools + 1 resource, all delegating to service
├── cli/
│   ├── index.ts        Commander entry point + ASCII banner
│   ├── init.ts         Interactive wizard (@clack/prompts)
│   ├── start.ts        Server startup + project indexing + dashboard launch
│   ├── status.ts       Health check
│   ├── configure.ts    Interactive config editor
│   ├── sync.ts         CLI sync command
│   └── keys.ts         CLI key management (create/list/revoke)
├── dashboard/
│   ├── server.ts       Fastify static server on port+1
│   └── index.html      Single-file React 18 app (kanban, search, overview)
└── fastify.d.ts        Type augmentation (db, config, dworkUser)
```

## Data model

### Source of truth: Markdown files

Each project has 4 mandatory files + optional numbered docs:

```
~/.dwork/projects/{slug}/
├── README.md        Overview
├── TECH.md          Stack + architecture
├── ROADMAP.md       Current / Next / Future
├── BACKLOG.md       Tasks by priority (P0-P3) + Done
└── docs/
    ├── 001_slug.md  Numbered detail docs
    └── 002_slug.md
```

### BACKLOG.md format

```markdown
---
project: my-project
type: backlog
---

## P0
- [ ] Critical task {deadline: 2026-06-01, estimate: 2d, type: task, status: doing}

## P1
- [ ] Feature request {type: feature, detail: 001_feature.md}

## Done
- [x] Completed task {type: task}
```

### Task statuses

`todo` → `refinement` → `doing` → `blocked` → `done`

### SQLite (index only)

FTS5 uses **contentless tables** (`content=''`, `contentless_delete=1`). The body lives in `.md` files, never in SQLite. The indexer manages FTS manually (no triggers).

## MCP Tools (13)

All delegate to the service layer:

1. `get_project` — project context (README + TECH + task stats)
2. `list_projects` — all projects with summaries
3. `create_project` — scaffold 4 MDs + directory
4. `get_tasks` — filtered tasks
5. `add_task` — append to BACKLOG.md
6. `update_task` — modify BACKLOG.md line
7. `get_roadmap` — ROADMAP.md content
8. `get_docs` — list docs
9. `add_doc` — numbered doc in docs/
10. `search` — FTS5 across tasks + docs
11. `what_to_do_next` — priority/deadline ranking
12. `sync` — sync docs from source via dproxy
13. `overview` — global stats

## Config

```json
{
  "dataPath": "~/.dwork",
  "port": 7881,
  "host": "0.0.0.0",
  "token": "sk-dwk_...",
  "dproxy": {
    "url": "http://localhost:7880",
    "token": "dpx_...",
    "provider": "claude"
  }
}
```

## CLI commands

```bash
dwork init              # Interactive wizard (config, DB, optional first project)
dwork start             # Start REST + MCP on :7881, Dashboard on :7882
dwork status            # Health check
dwork sync <project>    # Sync project docs from source via dproxy
dwork configure         # Reconfigure settings interactively
dwork keys <action>     # Manage API keys (create/list/revoke)
```

## Dev commands

```bash
pnpm --filter @dtoolkit/dwork build   # tsc + copy dashboard
pnpm --filter @dtoolkit/dwork test    # vitest
pnpm --filter @dtoolkit/dwork dev     # tsx watch
```

## Conventions

- ESM only, `.js` extensions in imports
- Strict TypeScript
- Service layer = all business logic; interfaces are thin
- Parser round-trip: `parseBacklog()` ↔ `serializeBacklog()` must be lossless
- FTS5 contentless: manual INSERT/DELETE (no triggers)
- Auth: bearer token (`sk-dwk_...`)

## Decisions (do not re-discuss)

- Markdown is the source of truth, SQLite is just an index
- Service layer pattern — no logic in routes/CLI/MCP
- FTS5 contentless (body stays in .md files)
- dwork and dbrain are independent — dcontext bridges them
- Port 7881 (REST + MCP same port)
- BACKLOG.md inline metadata with `{key: value}` syntax
