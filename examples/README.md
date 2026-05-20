<p align="center">
  <img src="../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/examples</h1>
<p align="center">Usage examples for the <code>@dtoolkit/sdk</code> package — typed HTTP clients for <strong>dbrain</strong> and <strong>dproxy</strong></p>

## What's covered

These examples demonstrate the two SDK clients:

- **`DBrainClient`** — persistent memory server: entities, facts, search, conversations, federation
- **`DProxyClient`** — universal model proxy: ask (batch & streaming), file attachments, history, memory

> Other dtoolkit packages (`dcontext`, `dproxy` CLI, adapters) are CLI tools without a programmatic SDK — they're not covered here.

## Quick start

```bash
cd examples
npm install
npm start
```

That's it. `npm start` initializes a temporary dbrain, starts both servers, runs the full demo, and cleans everything up when done. No configuration needed.

```bash
npm run start:dbrain       # run only dbrain examples
npm run start:dproxy       # run only dproxy examples
```

### Against existing servers

If dbrain and dproxy are already running (local, remote, or Docker):

```bash
cp .env.example .env       # edit with your server URLs and tokens
npm run demo               # both clients
npm run dbrain             # dbrain client only
npm run dproxy             # dproxy client only
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

### Combined ([src/demo.ts](src/demo.ts))

Quick end-to-end demo hitting both clients. Good for smoke-testing a full dtoolkit setup.

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

When using `npm start`, configuration is automatic — a temporary brain with a test token is created and cleaned up after the run.

## Requirements

- Node.js >= 22
- For `npm start`: the monorepo must be cloned with `pnpm install` done at the root
