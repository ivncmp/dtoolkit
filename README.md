# cw — Claude Wrapper

A CLI wrapper around `claude --print` that adds **persistent memory**, **context injection**, **conversation history**, **interactive chat**, and **YAML prompt templates** on top of the Claude Code CLI.

Every prompt sent through `cw` is automatically enriched with context before reaching Claude. Memory snippets, workspace identity files, a personal knowledge base (PARA), and today's conversation log are assembled and injected as system prompt context — so Claude always knows what you've been working on.

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and on PATH
- Node.js 18+
- Python 3 (optional, for semantic PARA/life search)

## Install

```bash
npm install -g claude-nice-wrapper
```

Or for local development:

```bash
git clone https://github.com/ivncmp/claude-nice-wrapper.git
cd claude-nice-wrapper
npm install && npm run build && npm link
```

## Getting Started

Run the setup wizard before first use:

```bash
cw init
```

This walks you through configuring Claude binary path, default model, optional integrations (workspace, chat log, PARA), and permission settings. All configuration is saved to `~/.claude-wrapper/config.json`.

> **`cw init` is required.** Other commands will refuse to run until initialization is complete.

---

## Commands

### `cw <prompt>` — Quick prompt (shorthand for `cw ask`)

```bash
cw "explain this error"
echo "some code" | cw "review this"
cw -c "and what about this?"          # continue last session
cw -r abc123 "follow up"              # resume specific session
```

Piped stdin is appended to the prompt separated by `---`.

### `cw ask <prompt>` — Single-shot prompt

Same as the bare `cw <prompt>` but as an explicit subcommand. Accepts all flags.

### `cw chat` — Interactive conversation

Opens a readline REPL for multi-turn conversation. Context is injected on every turn; subsequent turns use `--resume` to maintain the session.

```bash
cw chat                    # new conversation
cw chat -c                 # continue last conversation
cw chat -r <session-id>    # resume a specific session
cw chat -m claude-sonnet-4-20250514   # use a specific model
```

Type `exit` or `quit` (or Ctrl+C) to end the session.

### `cw memory` — Persistent memory snippets

Named markdown snippets stored in `~/.claude-wrapper/memory/`. By default, **all memory snippets are injected into every prompt** as system context, up to a configurable character limit.

```bash
cw memory set coding-style "Use functional patterns, avoid classes"
cw memory set project-context "Working on a billing system rewrite"
cw memory list                      # list all memory keys
cw memory get coding-style          # show a specific snippet
cw memory search "billing"          # search by key name or content
cw memory delete coding-style       # remove a snippet
```

Use `--no-memory` to skip injection, or `--memory key1,key2` to inject only specific keys.

### `cw template` — Reusable YAML prompt templates

Templates are YAML files with `{{variable}}` placeholders, stored in `~/.claude-wrapper/templates/`.

```bash
cw template add review -p "Review this code for bugs: {{code}}"
cw template add review -f review-template.yaml    # import from file
cw template list
cw template show review
cw template run review --var code="$(cat src/main.ts)"
cw template delete review
```

#### Template YAML format

```yaml
name: review
description: Code review prompt
prompt: |
  Review the following code for bugs, security issues, and style:

  {{code}}

  Focus on: {{focus}}
variables:
  - name: code
    source: stdin      # automatically filled from piped input
    required: true
  - name: focus
    default: "correctness"
claudeOptions:
  model: claude-sonnet-4-20250514
  maxTurns: 3
```

Variable sources: `stdin` (from pipe), `arg`, or `flag` (from `--var key=value`). Unresolved optional variables are warned about and silently removed.

### `cw history` — Prompt/response history

Every prompt and response is saved to an append-only JSONL file. Each entry includes: prompt, response, session ID, cost, duration, model, and timestamp. History is automatically pruned to `history.maxEntries` (default: 1,000).

```bash
cw history list                     # last 20 entries
cw history list -l 50               # last 50 entries
cw history show <id>                # full details of an entry
cw history search "keyword"         # search prompts and responses
cw history clear                    # clear all history
cw history clear --before 2024-01-01  # clear entries before a date
```

Use `--no-history` to skip saving a particular prompt.

### `cw config` — Configuration

Configuration is stored in `~/.claude-wrapper/config.json`. Supports dot-notation for nested keys.

```bash
cw config                             # show all config
cw config set defaults.model sonnet
cw config set memory.maxInjectionChars 8000
cw config set life.autoInject false
cw config get memory.autoInject
```

### `cw init` — Setup wizard

Run at any time to reconfigure settings interactively.

```bash
cw init
```

---

## Context Injection

Every time you run `cw`, multiple context sources are assembled and injected into Claude via `--append-system-prompt`. This happens automatically and transparently. Sources are injected in priority order (highest first):

### 1. Day chat log (highest priority)

A human-readable log of today's conversations. Every exchange is appended automatically. On each new prompt, today's full chat log is prepended to the context so Claude has continuity across your session.

Enable with `cw init` or manually:

```bash
cw config set chatLog.enabled true
cw config set chatLog.dir /path/to/chats
```

### 2. Workspace bootstrap files

Identity and personality files that define who the assistant is. Expected files (all optional, silently skipped if missing):

| File | Purpose |
|------|---------|
| `IDENTITY.md` | Who the assistant is |
| `SOUL.md` | Personality and tone |
| `USER.md` | User profile information |
| `MEMORY.md` | System-level memory |

Enable with `cw init` or manually:

```bash
cw config set workspace.enabled true
cw config set workspace.dir /path/to/workspace
```

### 3. Memory snippets

All saved memory snippets (or a filtered subset via `--memory key1,key2`), up to **4,000 chars** (configurable via `memory.maxInjectionChars`).

### 4. Life/PARA knowledge base

A personal knowledge base organized using the [PARA method](https://fortelabs.com/blog/para/) (Projects, Areas, Resources). Configure its location:

```bash
cw config set life.dir /path/to/your/knowledge-base
```

Expected layout:

```
<life.dir>/
  index.md                   # overview (optional)
  projects/<name>/summary.md
  areas/<name>/summary.md
  resources/<name>/summary.md
```

Two modes:
- **Semantic search** (when a query is available): runs a bundled Python script to find relevant entity summaries + facts
- **Full scan** (fallback): reads all `summary.md` files; each truncated to `life.maxEntityChars` (default: 1,500 chars)

Capped at **12,000 chars** (configurable via `life.maxInjectionChars`). Disable with `--no-life` or `cw config set life.autoInject false`.

### Context assembly

All parts are joined with `---` separators and passed as a single `--append-system-prompt` argument. Both `ask` and `chat` commands use the same shared context builder for consistent behavior.

---

## Session Management

### Session tokens and auto-reset

`cw` tracks token usage per session. When using `--max-session-tokens <n>`, if the session has exceeded the token threshold, the resume is dropped and a fresh session starts automatically.

```bash
cw -r my-session --max-session-tokens 100000 "next question"
```

Sessions older than 7 days are automatically pruned.

---

## All Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `-m, --model <model>` | ask, chat | Model to use (overrides `defaults.model`) |
| `-c, --continue` | ask, chat | Continue the last conversation session |
| `-r, --resume <id>` | ask, chat | Resume a specific session by ID |
| `--system-prompt <text>` | ask | Override the system prompt entirely |
| `--no-memory` | ask, chat | Skip memory snippet injection |
| `--memory <keys>` | ask | Inject only specific memory keys (comma-separated) |
| `--no-life` | ask, chat | Skip life/PARA context injection |
| `--no-history` | ask | Don't save this exchange to history |
| `--raw` | ask, template run | Print the full raw JSON response from Claude |
| `-o, --output-format <fmt>` | ask | Output format: `text`, `json`, `stream-json` |
| `--token-footer` | ask | Append a token usage summary to the response |
| `--max-turns <n>` | ask, chat | Maximum agent turns per invocation |
| `--max-budget-usd <n>` | ask | Maximum spend in USD for this call |
| `--max-session-tokens <n>` | ask | Reset session if total tokens exceed this |

---

## Configuration Reference

All settings are configured via `cw init` or `cw config set <key> <value>`.

| Key | Default | Description |
|-----|---------|-------------|
| `claude.bin` | `"claude"` | Path to the Claude CLI binary |
| `claude.skipPermissions` | `false` | Add `--dangerously-skip-permissions` to every call |
| `defaults.model` | — | Default model for all commands |
| `defaults.maxTurns` | — | Default max agent turns |
| `memory.autoInject` | `true` | Auto-inject memory snippets |
| `memory.maxInjectionChars` | `4000` | Max chars for memory context |
| `memory.defaultKeys` | `[]` | Only inject these keys (empty = all) |
| `workspace.enabled` | `false` | Enable workspace context injection |
| `workspace.dir` | `""` | Path to workspace bootstrap files |
| `workspace.maxInjectionChars` | `16000` | Max chars for workspace context |
| `chatLog.enabled` | `false` | Enable daily chat log |
| `chatLog.dir` | `""` | Path to chat log directory |
| `chatLog.userPrefix` | `"User:"` | Prefix for user messages in log |
| `chatLog.assistantPrefix` | `"Assistant:"` | Prefix for assistant messages in log |
| `life.autoInject` | `true` | Auto-inject PARA context |
| `life.dir` | `""` | Path to PARA knowledge base (empty = disabled) |
| `life.maxInjectionChars` | `12000` | Max chars for PARA context |
| `life.maxEntityChars` | `1500` | Max chars per entity summary |
| `life.pythonBin` | `"python3"` | Python binary for semantic search |
| `history.maxEntries` | `1000` | Max history entries before pruning |
| `debug` | `false` | Enable debug logging to `debug.log` |

### Environment variables

| Variable | Description |
|----------|-------------|
| `CW_DATA_DIR` | Override the data directory (default: `~/.claude-wrapper`) |
| `LIFE_SEARCH_BIN` | Override the path to the Python search script |

---

## Data Storage

```
~/.claude-wrapper/
  config.json              # all configuration
  history.jsonl            # append-only prompt/response history
  session-state.json       # per-session token counts
  current-session.json     # last chat session ID (for -c flag)
  debug.log                # debug output (when debug: true)
  memory/                  # named memory snippets (*.md)
  templates/               # prompt templates (*.yaml)
```

Optional integrations (disabled by default, configure via `cw init`):

```
<workspace.dir>/           # workspace bootstrap files (IDENTITY, SOUL, USER, MEMORY)
<chatLog.dir>/             # daily conversation logs (YYYY-MM-DD.md)
<life.dir>/                # PARA knowledge base
```

---

## License

MIT
