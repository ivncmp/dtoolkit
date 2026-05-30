<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dwork</h1>
<p align="center">AI-native, MD-driven project manager</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dwork"><img src="https://img.shields.io/npm/v/@dtoolkit/dwork.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

dwork manages your projects using Markdown files as the source of truth. Tasks live in `BACKLOG.md`, documentation in numbered `docs/` files, all with YAML frontmatter. SQLite + FTS5 provides fast search and indexing — but the `.md` files are always the canonical source.

## Install

```bash
npm install -g @dtoolkit/dwork
```

## Quick Start

```bash
# Initialize (creates config, database, optional first project)
dwork init

# Start the server (REST API + MCP on :7881)
dwork start

# Check status
dwork status
```

## How It Works

Each project gets 4 mandatory Markdown files:

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `TECH.md` | Technical stack and architecture |
| `ROADMAP.md` | Current, next, and future plans |
| `BACKLOG.md` | Tasks organized by priority (P0-P3) |

Tasks in `BACKLOG.md` use inline metadata:

```markdown
## P0
- [ ] Migrate auth to Supabase {deadline: 2026-06-01, estimate: 2d, type: task, status: doing}

## P1
- [ ] Redesign rankings {type: feature, estimate: 1w, detail: 001_rankings-redesign.md}

## Done
- [x] Setup project {type: task}
```

Additional docs go in `docs/` with auto-numbered filenames:

```
docs/001_rankings-redesign.md
docs/002_auth-migration.md
```

## Architecture

```
Service Layer (all business logic)
    ├── CLI (commander)
    ├── REST API (Fastify, :7881)
    ├── MCP Server (streamable HTTP, :7881/mcp)
    ├── SDK Client (@dtoolkit/sdk)
    └── Dashboard (React 18, :7882)
```

The service layer is the single source of business logic. All interfaces are thin wrappers.

## Dashboard

Web dashboard on port `7882` (API port + 1). Single-file React 18 app — CDN deps, no build step.

- **Overview** — default view. Stats (projects, tasks, docs) + global kanban with all tasks from every project. Drag & drop to change status.
- **Projects** — project list with task status badges. Click to open project detail.
- **Project detail** — three tabs:
  - **Kanban** — per-project board with drag & drop (desktop + touch mobile). Click a card to open task detail modal.
  - **Tasks** — table view with status, priority, type, estimate, deadline.
  - **Docs** — file tree with collapsible directories. Click a file to edit its Markdown content inline.
- **Task detail modal** — opens on card click. Shows task metadata. If a detail doc is linked, shows an inline Markdown editor. If not, an "Add Detail" button creates and links one.
- **Search** — full-text search across tasks and docs.
- **New Project / Add Task** — modal dialogs.
- **Light / Dark themes** (Cloud / Ocean).
- **Mobile responsive** — hamburger menu, touch drag & drop on kanban, card-style task tables.

## MCP Tools

Connect via `http://localhost:7881/mcp` with Bearer token auth.

| Tool | Description |
|------|-------------|
| `get_project` | Full project context (README + TECH + task stats) |
| `list_projects` | All projects with summaries |
| `create_project` | Scaffold a new project (4 MDs + directory) |
| `update_project` | Update project name, description, status, or source_path |
| `get_tasks` | Tasks filtered by status/priority |
| `add_task` | Add task to BACKLOG.md |
| `update_task` | Modify task in BACKLOG.md (supports moving to another project via `project`) |
| `get_roadmap` | Read ROADMAP.md |
| `get_docs` | List project documents |
| `get_doc` | Get single document with full content (by ID or project + file_path) |
| `add_doc` | Create numbered doc in docs/ |
| `update_doc` | Update document title, body, or type |
| `search` | FTS5 search across tasks + docs |
| `what_to_do_next` | Suggest next tasks by priority/deadline |
| `sync` | Sync docs from source code via dproxy |
| `overview` | Global summary of all projects |

## REST API

All endpoints require `Authorization: Bearer <token>` except `/health`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Status + stats (no auth) |
| `GET/POST` | `/projects` | List / create projects |
| `GET/PATCH/DELETE` | `/projects/:slug` | Read / update / delete project |
| `GET/POST` | `/projects/:slug/tasks` | List / add tasks |
| `PATCH/DELETE` | `/tasks/:id` | Update / delete task |
| `GET/POST` | `/projects/:slug/docs` | List / add docs |
| `GET/PATCH/DELETE` | `/docs/:id` | Read / update / delete doc |
| `POST` | `/search` | Full-text search across tasks + docs |
| `GET` | `/overview` | Global stats + per-project summaries |
| `GET` | `/next` | Suggested next tasks by priority/deadline |
| `POST` | `/sync/:slug` | Sync project docs from source via dproxy |
| `POST/GET/DELETE` | `/keys` | API key management |

## Configuration

Generated by `dwork init`:

```json
{
  "dataPath": "~/.dwork",
  "port": 7881,
  "host": "0.0.0.0",
  "token": "sk-dwk_..."
}
```

Dashboard runs on port `7882` (API port + 1) automatically.

## Data Structure

```
~/.dwork/
├── dwork.db              SQLite index + FTS5
├── config.json
└── projects/
    └── my-project/
        ├── README.md
        ├── TECH.md
        ├── ROADMAP.md
        ├── BACKLOG.md
        └── docs/
            └── 001_feature-name.md
```

## Part of dtoolkit

dwork is part of the [dtoolkit](https://github.com/ivncmp/dtoolkit) monorepo — an engineering toolkit for AI coding agents.

## License

MIT
