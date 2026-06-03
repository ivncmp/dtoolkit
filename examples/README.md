<p align="center">
  <img src="../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/examples</h1>
<p align="center">Usage examples for <strong>dbrain</strong>, <strong>dproxy</strong>, <strong>dwork</strong>, and <strong>dops</strong></p>

## What's covered

These examples demonstrate the SDK clients and REST APIs:

- **`DBrainClient`** — persistent memory server: entities, facts, search, conversations, federation
- **`DProxyClient`** — universal model proxy: ask (batch & streaming), file attachments, history, memory
- **`DWorkClient`** — AI-native project manager: projects, tasks, docs, search, overview
- **`DOpsClient`** — agent observability: sessions, token usage, tool calls, errors, analytics

> Other dtoolkit packages (`dcontext`, `dproxy` CLI, adapters) are CLI tools without a programmatic SDK — they're not covered here.

## Quick start

```bash
cd examples
npm install
npm start
```

That's it. `npm start` initializes temporary servers, runs the full demo, and cleans everything up when done. No configuration needed.

```bash
npm run start:dbrain       # run only dbrain examples
npm run start:dproxy       # run only dproxy examples
npm run start:dwork        # run only dwork examples
npm run start:dops         # run only dops examples
```

### Against existing servers

If dbrain, dproxy, and dwork are already running (local, remote, or Docker):

```bash
cp .env.example .env       # edit with your server URLs and tokens
npm run demo               # all clients
npm run dbrain             # dbrain client only
npm run dproxy             # dproxy client only
npm run dwork              # dwork client only
npm run dops               # dops REST API only
```

## Examples

### dbrain ([src/dbrain.ts](src/dbrain.ts))

Covers `DBrainClient` from `@dtoolkit/sdk`:

- Health check — server status, entity/fact counts
- Entity listing — all entities, filtered by category
- Full-text search — FTS5 query across all facts
- Memory summary — per-entity fact counts by tier (hot/warm/cold)
- Entity CRUD — create entity, add facts, bump, archive
- Conversations — list recent conversations
- Federation — brain type, connected brains, federated cross-brain search

### dproxy ([src/dproxy.ts](src/dproxy.ts))

Covers `DProxyClient` from `@dtoolkit/sdk`:

- Health check — server version, active provider
- Batch ask — single prompt, full response
- Streaming — SSE-based token-by-token output
- System prompt override — custom persona, skip history
- File attachments — inline text, JSON, images (PNG), PDFs, mixed
- History — list recent entries, fetch full entry
- Memory — write, read, search, delete key-value memory

### dwork ([src/dwork.ts](src/dwork.ts))

Covers `DWorkClient` from `@dtoolkit/sdk`:

- Health check — server status, project/task/doc counts
- Project CRUD — create, list, update projects
- Task management — create tasks, update status, kanban workflow
- Search — FTS5 query across projects, tasks, and docs
- Overview — global stats and what-to-do-next

### dops ([src/dops.ts](src/dops.ts))

Covers `DOpsClient` from `@dtoolkit/sdk`:

- Health check — server status, session/event/tool counts
- Session lifecycle — create session, ingest data, mark completed
- Token usage — record input/output/cache tokens per model
- Tool calls — track tool invocations with success/failure and duration
- Event ingestion — individual events and batch ingestion
- Error reporting — record errors linked to sessions
- Analytics queries — sessions list, session detail, tool/model/source stats, timeseries

### Combined ([src/demo.ts](src/demo.ts))

Quick end-to-end demo hitting all SDK clients. Good for smoke-testing a full dtoolkit setup.

### Setup ([src/setup.ts](src/setup.ts))

Orchestration script that powers `npm start`:

1. Builds packages (if needed)
2. Inits a temporary dbrain in a temp directory
3. Starts dbrain + dproxy servers
4. Runs the specified example
5. Tears everything down (kills servers, deletes temp dir)

## Configuration

When running against existing servers, examples read from `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DBRAIN_URL` | `http://localhost:7878` | dbrain server URL |
| `DBRAIN_TOKEN` | `changeme` | dbrain Bearer token |
| `DPROXY_URL` | `http://localhost:7880` | dproxy server URL |
| `DPROXY_TOKEN` | *(empty)* | dproxy Bearer token (optional) |
| `DWORK_URL` | `http://localhost:7881` | dwork server URL |
| `DWORK_TOKEN` | `changeme` | dwork Bearer token |
| `DOPS_URL` | `http://localhost:7883` | dops server URL |
| `DOPS_TOKEN` | `changeme` | dops Bearer token |

When using `npm start`, configuration is automatic — a temporary brain with a test token is created and cleaned up after the run.

## Requirements

- Node.js >= 22
- For `npm start`: the monorepo must be cloned with `pnpm install` done at the root
