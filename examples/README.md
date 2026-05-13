<p align="center">
  <img src="https://raw.githubusercontent.com/ivncmp/dtoolkit/main/logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/examples</h1>
<p align="center">Usage examples for the <code>@dtoolkit/sdk</code> package</p>

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

| File | Description |
|------|-------------|
| [src/dbrain.ts](src/dbrain.ts) | Health check, entity CRUD, fact management, search, memory summary, conversations |
| [src/dproxy.ts](src/dproxy.ts) | Health check, batch ask, streaming, ask with options, history, memory management |
| [src/demo.ts](src/demo.ts) | Combined quick demo of both clients |
| [src/setup.ts](src/setup.ts) | Full lifecycle: init temporary brain, start servers, run example, teardown |

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
