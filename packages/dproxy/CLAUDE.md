# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`dproxy` is a universal CLI adapter for invoking models via local CLIs. It supports 5 providers (Claude, Codex, Gemini, Ollama, OpenCode) via pluggable adapters from `@dtoolkit/adapter-*` packages. On top of the raw CLI, it adds persistent memory, context injection, interactive chat, conversation history, and YAML-based prompt templates.

## Build & Dev Commands

```bash
pnpm build          # Build with tsup (output: dist/)
pnpm dev            # Build in watch mode
```

## Architecture

**Entry point:** `src/index.ts` — Commander CLI setup with `enablePositionalOptions()`. The bare `dproxy <prompt>` invocation is a shorthand that delegates to `runAsk()`. All commands (except `init`) are guarded by `requireInit()` which ensures `dproxy init` has been run. Root program and subcommands both accept `-p, --provider` to select the adapter.

**Adapter resolution:** `src/lib/adapter.ts` — `resolveAdapter(provider, config)` maps a provider name to an adapter instance from `@dtoolkit/adapter-*`. Adapter config comes from `config.provider.<name>`.

**Adapters** (external packages):
- `@dtoolkit/adapter-claude` — JSON output, sessions, cost, usage (richest)
- `@dtoolkit/adapter-codex` — JSONL events, usage, approval modes
- `@dtoolkit/adapter-gemini` — JSON output, sessions, usage, yolo mode
- `@dtoolkit/adapter-ollama` — plain text, local models, ANSI stripping
- `@dtoolkit/adapter-opencode` — JSONL events, sessions, cost, usage

All adapters implement `Adapter` from `@dtoolkit/core`.

**Commands** (`src/commands/`):
- `init.ts` — interactive setup wizard; required before first use; sets `config.initialized = true`
- `ask.ts` — single-shot prompt; resolves adapter via `resolveAdapter()`, assembles context via shared `buildSystemPromptContext()`, saves to history and daily chat log
- `chat.ts` — interactive REPL using readline; resolves adapter, tracks session ID across turns via `--resume`; uses the same shared context builder as ask; input locked during processing
- `history.ts` — list/show/search/clear history entries
- `memory.ts` — CRUD for named memory snippets (markdown files)
- `template.ts` — CRUD and execution of YAML prompt templates with `{{variable}}` interpolation

**Data layer** (`src/lib/`):
- `config.ts` — reads/writes config with deep merge; provides `getDataDir()`, `atomicWriteFile()` for safe concurrent writes; supports `DPROXY_DATA_DIR` env var override; migrates legacy `claude` config section to `provider.claude`
- `adapter.ts` — `resolveAdapter()` maps provider name → adapter instance with config from `AppConfig.provider.*`
- `stdin.ts` — `readStdin()` for piped input (5s timeout, TTY check)
- `context-builder.ts` — shared `buildSystemPromptContext()` used by both `ask.ts` and `chat.ts` to assemble all context sources consistently
- `history-store.ts` — append-only JSONL with per-line error resilience; enforces `maxEntries` pruning; uses atomic writes
- `memory-store.ts` — one `.md` file per key (slugified filenames); `buildMemoryContext()` assembles for injection
- `template-store.ts` — one `.yaml` file per template; `renderTemplate()` warns on unresolved variables
- `life-store.ts` — optional PARA knowledge base; semantic search via Python script or full scan fallback; debug logging conditional on `config.debug`
- `workspace-store.ts` — reads bootstrap files from `config.workspace.dir`; disabled by default
- `chat-log-store.ts` — daily conversation log at `config.chatLog.dir`; disabled by default
- `session-state.ts` — per-session token tracking with 7-day auto-pruning; uses atomic writes
- `types.ts` — re-exports `Adapter`, `AdapterRequest`, `AdapterResult`, `AdapterUsage` from `@dtoolkit/core`; defines `ProviderName`, `AppConfig`, `SessionInfo`, etc.

## Context Injection Pipeline

Context is assembled by `context-builder.ts` from multiple sources **in this priority order** (highest first):

1. **Day chat log** (`chat-log-store.ts`) — today's conversation history
2. **Workspace bootstrap** (`workspace-store.ts`) — identity/personality files
3. **Memory snippets** (`memory-store.ts`) — truncated to `config.memory.maxInjectionChars` (default 4,000)
4. **Life/PARA context** (`life-store.ts`) — truncated to `config.life.maxInjectionChars` (default 12,000)

All parts joined with `"\n\n---\n\n"` and passed via `--append-system-prompt` (Claude) or equivalent. Both `ask` and `chat` use the same builder.

## Build

tsup bundles `src/index.ts` into a single ESM file in `dist/` with a `#!/usr/bin/env node` shebang. A post-build step copies `src/scripts/` → `dist/scripts/` to bundle the Python search script.

The package uses `"type": "module"` and NodeNext module resolution — all local imports must use `.js` extensions.

## Data Storage

```
~/.dproxy/
├── config.json          # App configuration
├── history.jsonl         # Prompt history
├── current-session.json  # Active session state
├── memory/               # Named memory snippets (.md)
└── templates/            # Prompt templates (.yaml)
```

Override the data directory with `DPROXY_DATA_DIR` env var.

## Key CLI Flags

Shared across `ask` and `chat`: `-p/--provider` (claude, codex, gemini, ollama, opencode), `--no-memory`, `--memory <keys>` (comma-separated), `--no-life`, `--no-history`, `--raw`, `--token-footer`, `--max-session-tokens <n>`, `-c/--continue`, `-r/--resume <id>`, `-m/--model`, `--max-turns`, `--max-budget-usd`.
