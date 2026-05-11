<p align="center">
  <img src="https://raw.githubusercontent.com/ivncmp/dtoolkit/main/logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dproxy</h1>
<p align="center">Universal CLI adapter for invoking models via local CLIs</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dproxy"><img src="https://img.shields.io/npm/v/@dtoolkit/dproxy.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## Install

```bash
npm install -g @dtoolkit/dproxy
```

## Quick start

```bash
dproxy init              # interactive setup wizard
dproxy "explain this"    # single-shot prompt
dproxy chat              # interactive REPL
```

## Commands

| Command | Description |
| --- | --- |
| `dproxy init` | Interactive setup (required before first use) |
| `dproxy <prompt>` | Single-shot prompt (shorthand for `dproxy ask`) |
| `dproxy ask <prompt>` | Send a prompt with full context injection |
| `dproxy chat` | Interactive REPL with session tracking |
| `dproxy history` | List, show, search, or clear prompt history |
| `dproxy memory` | CRUD for named memory snippets |
| `dproxy template` | CRUD and execution of YAML prompt templates |
| `dproxy config` | Get/set configuration |

## Context injection

Every prompt is enriched with context from multiple sources, in priority order:

1. **Day chat log** — today's conversation history
2. **Workspace bootstrap** — identity/personality files
3. **Memory snippets** — named markdown snippets (truncated to 4,000 chars)
4. **Life/PARA context** — semantic knowledge base (truncated to 12,000 chars)

## Key flags

```
--no-memory           Skip memory injection
--memory <keys>       Inject specific memory keys (comma-separated)
--no-life             Skip life/PARA context
--no-history          Don't save to history
--raw                 Print raw JSON response
-c, --continue        Continue last conversation
-r, --resume <id>     Resume a specific session
-m, --model <model>   Model to use
--max-turns <n>       Max agent turns
--max-budget-usd <n>  Max budget in USD
```

## Data storage

```
~/.dproxy/
├── config.json          # App configuration
├── history.jsonl        # Prompt history
├── current-session.json # Active session state
├── memory/              # Named memory snippets (.md)
└── templates/           # Prompt templates (.yaml)
```

Override with `DPROXY_DATA_DIR` env var.

## License

[MIT](../../LICENSE)
