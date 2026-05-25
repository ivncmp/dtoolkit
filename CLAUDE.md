# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

dtoolkit is an open-source harness engineering toolkit for AI coding agents. It's a pnpm monorepo with publishable packages under `@dtoolkit/*`.

## Commands

```bash
pnpm install              # install all deps
pnpm build                # turbo run build (all packages, dependency-ordered)
pnpm test                 # turbo run test
pnpm lint                 # eslint across the monorepo
pnpm lint:fix             # eslint --fix
pnpm format               # prettier --write
pnpm format:check         # prettier --check
```

Per-package (run from package dir or use `--filter`):

```bash
pnpm --filter @dtoolkit/dbrain build
pnpm --filter @dtoolkit/dbrain test
pnpm --filter @dtoolkit/dproxy dev       # tsup --watch
pnpm --filter @dtoolkit/dbrain dev       # tsx watch
pnpm --filter @dtoolkit/dwork build
pnpm --filter @dtoolkit/dwork dev        # tsx watch
```

## Architecture

```
packages/
├── core/              Shared types + Zod schemas (Entity, Fact, Tier, ContextBlock, Adapter)
│                      Includes AdapterStreamEvent, LineBuffer for JSONL parsing
│                      Also: shared dcontext MD section helpers (writeDcontextMdSection, etc.)
│                      Build: tsc. No runtime deps beyond zod. Other packages depend on this.
├── adapter-claude/    Shell-out adapter for Claude Code CLI (stream-json + deltas)
│                      Also: DcontextTarget for Claude Code hooks (settings.json + CLAUDE.md)
├── adapter-codex/     Shell-out adapter for Codex CLI (JSONL streaming)
│                      Also: DcontextTarget for Codex CLI hooks (config.toml + AGENTS.md)
├── adapter-gemini/    Shell-out adapter for Gemini CLI (stream-json)
│                      Also: DcontextTarget for Gemini CLI hooks (settings.json + GEMINI.md)
├── adapter-opencode/  Shell-out adapter for OpenCode CLI (JSONL streaming)
│                      Also: DcontextTarget for OpenCode hooks (npm plugin + AGENTS.md)
│                      All adapters: Build: tsc. Depend on core only.
│                      All implement stream() + execute() via dproxy.ts
│                      Claude/Codex/Gemini/OpenCode also implement Target via dcontext.ts
├── dbrain/            Persistent memory server — the brain
│                      Fastify REST API + MCP HTTP on :7878, React dashboard on :7879
│                      SQLite + FTS5 via better-sqlite3. Federation: personal→shared brain connections.
│                      CLI: dbrain init/start/connect/status/compact/configure/link/unlink/connections/keys
│                      Build: tsc + copy dashboard assets + chmod bin
├── dwork/             AI-native, MD-driven project manager
│                      Fastify REST API + MCP HTTP on :7881, React dashboard on :7882
│                      SQLite + FTS5 via better-sqlite3. Markdown files as source of truth.
│                      CLI: dwork init/start/status/sync/configure/keys
│                      Build: tsc + copy dashboard assets + chmod bin
├── sdk/               Typed HTTP clients for dtoolkit services (dbrain + dproxy + dwork)
│                      DBrainClient + DProxyClient + DWorkClient, shared HttpClient base
│                      Build: tsc. Auth: unified Bearer token.
├── dcontext/          dbrain hooks for AI coding CLIs
│                      Injects identity + project facts at session start, saves exchanges pre-compaction
│                      Hooks into Claude Code, Codex CLI, Gemini CLI, OpenCode via their native hook systems
│                      CLI: dcontext init/install/uninstall/status/explore
│                      Build: tsup (single ESM bundle). Requires dbrain.
└── dproxy/            Universal CLI adapter for invoking models via local CLIs
                       Commander-based CLI with context injection pipeline
                       Uses adapter packages for multi-provider support (--provider flag)
                       Build: tsup (single ESM bundle)
tools/
└── tsconfig/          Shared base tsconfig (ES2022, NodeNext, strict)
```

**Dependency graph**: `core` ← `adapter-*` ← `dproxy`/`dcontext`. `core` ← `sdk` ← (consumers). `core` ← `dbrain`. `core` ← `sdk` ← `dwork`. Turbo handles build ordering via `^build`.

### dbrain internals

- `src/cli/` — CLI commands (init wizard, connect client setup, start server, status, compact, configure, link/unlink, keys)
- `src/server/` — Fastify app with routes: entities, facts, conversations, search, workspace, health, keys, connections, compact
- `src/server/routes/compact.ts` — POST /compact endpoint (admin-only)
- `src/server/routes/keys.ts` — API key CRUD (shared brains only)
- `src/server/routes/permissions.ts` — write permission enforcement
- `src/mcp/` — MCP server on same port as REST (recall, remember, get/list/create entity, bump, log, overview, share, compact)
- `src/core/` — db.ts (SQLite schema + FTS5 + migrations), models.ts (Zod), config.ts (brainType, connections), connections.ts (cached client pool), memory.ts (tier logic), compact.ts (dedup + tier recalc)
- `src/dashboard/` — Single-file React app served via Fastify static (CDN deps, no build step)
- init = server-side (creates brain), connect = client-side (configures Claude Code files)
- Federation: recall auto-federates across connections, share pushes facts, search supports `federated: true`

### dproxy internals

- `src/commands/` — ask (single-shot), chat (REPL), history, memory, template, serve (HTTP API), init
- `src/lib/runner.ts` — core execution logic shared by CLI (`ask`) and HTTP (`serve`): `executePrompt()` (batch) and `streamPrompt()` (streaming AsyncGenerator) — context building → adapter resolution → execution → persistence
- `src/lib/adapter.ts` — `resolveAdapter()` maps provider name to adapter instance
- `src/lib/context-builder.ts` — assembles prompt context from multiple sources in priority order: day chat log → workspace bootstrap → memory snippets → life/PARA context
- `src/lib/stdin.ts` — `readStdin()` for piped input
- `src/commands/serve.ts` — Fastify REST API on configurable port (default :7880), full CLI parity with Bearer token auth, SSE streaming via `stream: true`
- Data stored in `~/.dproxy/` (config.json, history.jsonl, memory/, templates/)
- Supports 4 providers via `--provider` flag: claude (default), codex, gemini, opencode

### dwork internals

- `src/core/` — config.ts (Zod schema + env overrides), db.ts (SQLite + FTS5 contentless), models.ts (Zod enums), parser.ts (BACKLOG.md parse/serialize), indexer.ts (MD→SQLite sync), templates.ts (scaffold)
- `src/service/` — projects.ts (CRUD + scaffold), tasks.ts (CRUD via BACKLOG.md), docs.ts (numbered docs), search.ts (FTS5 OR), overview.ts (stats), sync.ts (via dproxy), utils.ts (genId)
- `src/server/` — Fastify app with routes: projects, tasks, docs, search, overview, sync, keys, health, permissions
- `src/mcp/` — 13 MCP tools + 1 resource (dwork://projects), all delegating to service layer
- `src/dashboard/` — Single-file React 18 app (kanban, search, overview), served on port+1
- `src/cli/` — init wizard, start (server + dashboard), status, sync, configure, keys
- Data stored in `~/.dwork/` (config.json, dwork.db, projects/)
- Markdown files are source of truth; SQLite + FTS5 is just an index
- dwork and dbrain are independent; dcontext bridges them

## CLI conventions

All CLI packages must use these libraries — no exceptions:

| Concern | Library |
| --- | --- |
| Colors | `picocolors` |
| Interactive prompts | `@clack/prompts` |
| CLI framework | `commander` |
| YAML parsing | `yaml` |

Color conventions: errors in `pc.red()`, success in `pc.green()`, secondary info in `pc.dim()`, highlights in `pc.blue()`, headings in `pc.bold()`.

### CLI help banner

Every CLI package must show an ASCII art banner in its `--help` output. The banner is set via Commander's `.description()` and follows this pattern:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';

const banner = `\
     _ _               _
    | | |             (_)
  __| | |__  _ __ __ _ _ _ __
 / _\` | '_ \\| '__/ _\` | | '_ \\
| (_| | |_) | | | (_| | | | | |
 \\__,_|_.__/|_|  \\__,_|_|_| |_|`;

const description = `${pc.green(banner)}\n\n${pc.green('One-line tagline here')}\n${pc.dim('Part of the dtoolkit suite')}`;

program.name('dbrain').description(description).version(version);
```

Rules:
- ASCII art uses the "Big" figlet font. Pre-generated art for all packages lives in `ascii-art.txt` at the repo root.
- The art goes in a `banner` const (template literal), wrapped in `pc.green()`.
- The tagline (one-line description) goes in `pc.green()` on its own line.
- Below the tagline, always add `pc.dim('Part of the dtoolkit suite')`.
- Use template literals with escaped backticks `` \` `` and backslashes `\\` — no string concatenation.

## README conventions

All package READMEs follow this header format:

```html
<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/package-name</h1>
<p align="center">One-line description of the package</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/package-name"><img src="https://img.shields.io/npm/v/@dtoolkit/package-name.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>
```

Use `../../logo.png` (monorepo logo) unless the package has its own `logo.png`.

## Code conventions

- ESM only (`"type": "module"`), all local imports use `.js` extensions
- Strict TypeScript — all packages extend `@dtoolkit/tsconfig/base.json`
- Tests with vitest
- Commits in English, no Co-Authored-By lines
- Node >= 22
- **Always run `pnpm lint:fix` and `pnpm format` before committing.** Code must pass `pnpm lint` and `pnpm format:check` — CI will reject it otherwise.

## Linting rules of note

- `consistent-type-imports` enforced (use `import type` where possible)
- `import-x/order` with alphabetized groups
- `no-console` is warn globally, but disabled for CLI entry files (dbrain cli, dproxy, dashboard server)

## Release flow

Changesets + GitHub Actions. Packages publish to npm as public `@dtoolkit/*` scoped packages.

```bash
pnpm changeset              # create a changeset describing the change
git push                    # CI runs lint+test+build; release workflow creates a "chore: version packages" PR
                            # merging that PR → publishes to npm + creates GitHub Releases
```

Internal deps use `workspace:*` — changesets resolves these to real versions at publish time.
