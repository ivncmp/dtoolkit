# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`claude-nice-wrapper` (`cw`) is a CLI wrapper around the `claude --print` command. It adds persistent memory, context injection, interactive chat, conversation history, and YAML-based prompt templates on top of the Claude Code CLI. It requires the `claude` CLI to be installed and on PATH.

## Build & Dev Commands

```bash
npm run build          # Build with tsup (output: dist/)
npm run dev            # Build in watch mode
npm run lint           # Run ESLint
npm run format         # Run Prettier
npm run check          # Lint + format check + build
npm link               # Install `cw` globally for local testing
```

## Architecture

**Entry point:** `src/index.ts` — Commander CLI setup. The bare `cw <prompt>` invocation is a shorthand that delegates to `runAsk()`. All commands (except `init`) are guarded by `requireInit()` which ensures `cw init` has been run.

**Core execution:** `src/claude.ts` — `execClaude()` spawns the Claude CLI as a child process, parses JSON output into `ClaudeResult`. `--dangerously-skip-permissions` is opt-in via `config.claude.skipPermissions`. Also exports `readStdin()` for piped input (5s timeout).

**Commands** (`src/commands/`):
- `init.ts` — interactive setup wizard; required before first use; sets `config.initialized = true`
- `ask.ts` — single-shot prompt; assembles context via shared `buildSystemPromptContext()`, saves to history and daily chat log
- `chat.ts` — interactive REPL using readline; tracks session ID across turns via `--resume`; uses the same shared context builder as ask; input locked during processing
- `history.ts` — list/show/search/clear history entries
- `memory.ts` — CRUD for named memory snippets (markdown files)
- `template.ts` — CRUD and execution of YAML prompt templates with `{{variable}}` interpolation

**Data layer** (`src/lib/`):
- `config.ts` — reads/writes config with deep merge; provides `getDataDir()`, `atomicWriteFile()` for safe concurrent writes; supports `CW_DATA_DIR` env var override
- `context-builder.ts` — shared `buildSystemPromptContext()` used by both `ask.ts` and `chat.ts` to assemble all context sources consistently
- `history-store.ts` — append-only JSONL with per-line error resilience; enforces `maxEntries` pruning; uses atomic writes
- `memory-store.ts` — one `.md` file per key (slugified filenames); `buildMemoryContext()` assembles for injection
- `template-store.ts` — one `.yaml` file per template; `renderTemplate()` warns on unresolved variables
- `life-store.ts` — optional PARA knowledge base; semantic search via Python script or full scan fallback; debug logging conditional on `config.debug`
- `workspace-store.ts` — reads bootstrap files from `config.workspace.dir`; disabled by default
- `chat-log-store.ts` — daily conversation log at `config.chatLog.dir`; disabled by default
- `session-state.ts` — per-session token tracking with 7-day auto-pruning; uses atomic writes
- `types.ts` — shared TypeScript interfaces (all with JSDoc)

## Context Injection Pipeline

Context is assembled by `context-builder.ts` from multiple sources **in this priority order** (highest first):

1. **Day chat log** (`chat-log-store.ts`) — today's conversation history
2. **Workspace bootstrap** (`workspace-store.ts`) — identity/personality files
3. **Memory snippets** (`memory-store.ts`) — truncated to `config.memory.maxInjectionChars` (default 4,000)
4. **Life/PARA context** (`life-store.ts`) — truncated to `config.life.maxInjectionChars` (default 12,000)

All parts joined with `"\n\n---\n\n"` and passed via `--append-system-prompt`. Both `ask` and `chat` use the same builder.

## Build

tsup bundles `src/index.ts` into a single ESM file in `dist/` with a `#!/usr/bin/env node` shebang. A post-build step copies `src/scripts/` → `dist/scripts/` to bundle the Python search script.

The package uses `"type": "module"` and NodeNext module resolution — all local imports must use `.js` extensions.

## Key CLI Flags

Shared across `ask` and `chat`: `--no-memory`, `--memory <keys>` (comma-separated), `--no-life`, `--no-history`, `--raw`, `--token-footer`, `--max-session-tokens <n>`, `-c/--continue`, `-r/--resume <id>`, `-m/--model`, `--max-turns`, `--max-budget-usd`.
