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
```

## Architecture

```
packages/
├── core/              Shared types + Zod schemas (Entity, Fact, Tier, ContextBlock, Adapter)
│                      Build: tsc. No runtime deps beyond zod. Other packages depend on this.
├── adapter-claude/    Shell-out adapter for Claude Code CLI
├── adapter-codex/     Shell-out adapter for Codex CLI
├── adapter-gemini/    Shell-out adapter for Gemini CLI
├── adapter-ollama/    Shell-out adapter for Ollama CLI
│                      All adapters: Build: tsc. Depend on core only.
├── dbrain/            Persistent memory server — the brain
│                      Fastify REST API + MCP HTTP on :7878, React dashboard on :7879
│                      SQLite + FTS5 via better-sqlite3. CLI: dbrain init/start/connect/status
│                      Build: tsc + copy dashboard assets + chmod bin
├── dbrain-client/     Typed HTTP client for dbrain's REST API
│                      Build: tsc. Single class DBrainClient with all endpoints.
└── dproxy/            Universal CLI adapter for invoking models via local CLIs
                       Commander-based CLI with context injection pipeline
                       Uses adapter packages for multi-provider support (--provider flag)
                       Build: tsup (single ESM bundle)
tools/
└── tsconfig/          Shared base tsconfig (ES2022, NodeNext, strict)
```

**Dependency graph**: `core` ← `adapter-*` ← `dproxy`. `core` ← `dbrain-client` ← (consumers). `core` ← `dbrain`. Turbo handles build ordering via `^build`.

### dbrain internals

- `src/cli/` — CLI commands (init wizard, connect client setup, start server, status)
- `src/server/` — Fastify app with routes: entities, facts, conversations, search, workspace, health
- `src/mcp/` — MCP server on same port as REST
- `src/core/` — db.ts (SQLite schema + FTS5), models.ts (Zod), config.ts, memory.ts (tier logic)
- `src/dashboard/` — Single-file React app served via Fastify static (CDN deps, no build step)
- init = server-side (creates brain), connect = client-side (configures Claude Code files)

### dproxy internals

- `src/commands/` — ask (single-shot), chat (REPL), history, memory, template, init
- `src/lib/adapter.ts` — `resolveAdapter()` maps provider name to adapter instance
- `src/lib/context-builder.ts` — assembles prompt context from multiple sources in priority order: day chat log → workspace bootstrap → memory snippets → life/PARA context
- `src/lib/stdin.ts` — `readStdin()` for piped input
- Data stored in `~/.dproxy/` (config.json, history.jsonl, memory/, templates/)
- Supports 4 providers via `--provider` flag: claude (default), codex, gemini, ollama

## CLI conventions

All CLI packages must use these libraries — no exceptions:

| Concern | Library |
| --- | --- |
| Colors | `picocolors` |
| Interactive prompts | `@clack/prompts` |
| CLI framework | `commander` |
| YAML parsing | `yaml` |

Color conventions: errors in `pc.red()`, success in `pc.green()`, secondary info in `pc.dim()`, highlights in `pc.blue()`, headings in `pc.bold()`.

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
