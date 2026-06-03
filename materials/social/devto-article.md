---
title: "How I built an engineering toolkit for AI coding agents"
published: false
description: "dtoolkit gives your AI coding agents persistent memory, automatic context, project management, and observability. Here's how it works and how to set it up."
tags: opensource, ai, devtools, typescript
cover_image: # TODO: add cover image URL
---

# How I built an engineering toolkit for AI coding agents

I spend most of my day working with AI coding agents — Claude Code, Gemini CLI, Codex, OpenCode. They're incredibly powerful, but they all share the same fundamental problems:

1. **They forget everything.** Every session starts from zero. Yesterday's decisions? Gone.
2. **They don't know your project.** File paths get hallucinated. Architecture gets ignored.
3. **You can't see what they cost.** Tokens, tools, errors — all a black box.
4. **Switching providers is painful.** Your setup is tied to one vendor.
5. **Team knowledge stays siloed.** Each developer's agent is an island.

After months of duct-taping workarounds, I decided to build the infrastructure layer these agents are missing. The result is **dtoolkit** — an open-source engineering toolkit that gives AI coding agents memory, context, project management, and observability.

## The architecture

dtoolkit follows one principle: **one layer, one job.** Each package does exactly one thing and does it well.

```
Your coding agent (Claude Code, Gemini CLI, Codex, OpenCode)
        │
        ▼
┌─────────────┬──────────────┐
│  dcontext   │    dproxy    │  ← Hooks & transport
│  (inject)   │  (route)     │
└──────┬──────┴──────┬───────┘
       │             │
┌──────▼──┐  ┌──────▼──┐  ┌────────┐
│  dbrain  │  │  dwork   │  │  dops  │  ← Data & services
│ (memory) │  │(projects)│  │ (obs)  │
└──────────┘  └──────────┘  └────────┘
```

No package depends on another to function. You can use dbrain alone for memory, dwork alone for project management, or all of them together. SQLite everywhere — no Postgres, no Redis, no Docker.

## Getting started (5 minutes)

### 1. Install

```bash
npm i -g @dtoolkit/dbrain @dtoolkit/dcontext @dtoolkit/dwork @dtoolkit/dops
```

### 2. Initialize and start the memory server

```bash
dbrain init && dbrain start
```

This creates a personal brain — a SQLite database with FTS5 full-text search, served as both a REST API and an MCP server on port 7878. A React dashboard runs on 7879.

### 3. Connect to your AI coding CLI

```bash
dbrain connect claude
```

This configures Claude Code's hooks so that:
- At session start: your identity, project facts, and brain data are injected into the context
- Before compaction: transcripts are saved so nothing is lost

One command. Zero config files to edit manually.

### 4. Start the project manager

```bash
dwork init && dwork start
```

dwork turns Markdown files into a project management system. Your `BACKLOG.md` is the source of truth — SQLite + FTS5 is just an index. It includes a kanban dashboard, 21 MCP tools (including code graph analysis), and full-text search across all projects.

### 5. Open your agent

```bash
claude  # or gemini, codex, opencode
```

Your agent now has memory. It knows who you are, what project you're in, and what you decided last week.

## The five products

### dbrain — Your distributed mind

The core of the system. A persistent memory server that stores entities, facts, and conversations with a tiered memory system (hot, warm, cold).

Key features:
- **FTS5 search** — semantic search across all stored knowledge in milliseconds
- **MCP server** — works with Claude Code, Cursor, Windsurf, and any MCP client
- **Federation** — personal and shared team brains. `recall` auto-federates across connections
- **React dashboard** — browse entities, search memories, manage your brain visually

```typescript
import { DBrainClient } from '@dtoolkit/sdk';

const brain = new DBrainClient('http://localhost:7878');

// Remember something
await brain.remember('user:ivan', 'Prefers TypeScript over JavaScript');

// Recall later
const results = await brain.recall('typescript preferences');
```

### dcontext — Automatic context injection

The glue between your brain and your coding agent. Hooks into the CLI's lifecycle events:

- **Session start**: injects identity, project facts, active tasks
- **Pre-compaction**: saves the transcript before the context window shrinks
- **Multi-CLI**: works with Claude Code, Gemini CLI, Codex CLI, OpenCode

### dproxy — Multi-provider transport

One CLI and REST API that routes to any provider:

```bash
dproxy ask "explain this function" --provider gemini
dproxy ask "explain this function" --provider claude
```

Includes a context pipeline that automatically assembles memory, workspace info, and templates into every prompt. SSE streaming, Bearer token auth, configurable port.

### dwork — Markdown-driven project management

Your `BACKLOG.md` looks like this:

```markdown
## Todo

- [P0] Build authentication module (id:abc123, est:4h)
- [P1] Add dark mode to dashboard (id:def456, est:2h)
```

dwork parses it, indexes it in SQLite + FTS5, and serves it via REST + MCP. The dashboard gives you a kanban board with drag-and-drop. The code graph feature maps your entire codebase as a knowledge graph — search for functions, trace call chains, analyze impact.

### dops — Agent observability

Finally know what your agents cost:

- Token tracking per session (input, output, cache)
- Model-aware cost estimation across all providers
- Tool call analytics and success rates
- Multi-provider transcript ingestion
- Dashboard with charts and timeseries

## The SDK

Everything is accessible through typed clients:

```bash
npm install @dtoolkit/sdk
```

```typescript
import { DBrainClient, DWorkClient, DOpsClient, DProxyClient } from '@dtoolkit/sdk';
```

Four clients, consistent API, full TypeScript types.

## Design philosophy

Six principles guide every decision:

1. **One layer, one responsibility** — memory is memory, projects are projects
2. **CLI-first, dashboard as bonus** — everything works from the terminal
3. **SQLite everywhere** — zero external dependencies
4. **MCP + REST on the same port** — one server, two protocols
5. **Markdown as source of truth** — the database is just an index
6. **No vendor lock-in** — four adapters, one interface

## What's next

dtoolkit has 20 packages total. 12 are available now on npm. 8 more are on the roadmap:

- **dcouncil** — multi-agent debate for architecture decisions
- **dguard** — pre-commit validation for LLM output
- **dpolicy** — policy-as-code for the team harness
- **droute** — model router with cost tracking
- **dpair** — real-time pair programming with shared agents
- **dreplay** — privacy-aware session browser
- **dstream** — daily digest of what agents learned
- **dforge** — marketplace for skills and hooks

## Try it

```bash
npm i -g @dtoolkit/dbrain @dtoolkit/dcontext
dbrain init && dbrain start
dbrain connect claude
claude
```

Five commands. Your agent now has a brain.

- **GitHub**: [github.com/ivncmp/dtoolkit](https://github.com/ivncmp/dtoolkit)
- **npm**: [@dtoolkit/*](https://www.npmjs.com/org/dtoolkit)
- **Docs**: [dtoolkit.vercel.app/docs](https://dtoolkit.vercel.app/docs)

All MIT licensed. v1.0.0 just shipped. Feedback and contributions welcome.
