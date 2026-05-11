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
dproxy "explain this"    # single-shot prompt (default provider)
dproxy chat              # interactive REPL
```

## Providers

dproxy supports 5 providers out of the box. Each provider shells out to its respective CLI:

| Provider | CLI | Features |
| --- | --- | --- |
| `claude` (default) | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Sessions, cost, usage, tools, system prompt |
| `codex` | [Codex](https://github.com/openai/codex) | Usage, approval modes |
| `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Sessions, usage, yolo mode |
| `ollama` | [Ollama](https://ollama.com/) | Local/offline, any model |
| `opencode` | [OpenCode](https://github.com/nicholasgriffintn/opencode) | Sessions, cost, usage |

### Switching providers

```bash
# Per-command
dproxy -p ollama "explain this code"
dproxy ask -p gemini "write a test for this"
dproxy chat -p codex

# Set default in config
dproxy config set provider.default gemini
```

## Commands

### `dproxy <prompt>` / `dproxy ask <prompt>`

Single-shot prompt with context injection. Reads from stdin if piped.

```bash
# Basic usage
dproxy "explain what this function does"

# With a specific provider and model
dproxy -p ollama -m codellama "refactor this"

# Pipe content
cat src/index.ts | dproxy "review this code"
git diff | dproxy ask "summarize these changes"

# Raw JSON output
dproxy --raw "hello"

# JSON output format
dproxy -o json "hello"

# Token usage footer
dproxy --token-footer "explain monads"

# Skip memory/life context
dproxy --no-memory --no-life "just answer directly"

# Inject specific memory keys only
dproxy --memory "project-rules,style-guide" "review this"

# Limit agent turns and budget
dproxy --max-turns 5 --max-budget-usd 0.50 "refactor the auth module"

# System prompt override
dproxy ask --system-prompt "You are a security auditor" "review this code"
```

### `dproxy chat`

Interactive REPL with session tracking across turns.

```bash
# Start a new chat
dproxy chat

# Chat with a specific provider
dproxy chat -p gemini

# Continue the last conversation
dproxy chat -c

# Resume a specific session
dproxy chat -r sess_abc123
```

### `dproxy history`

Manage prompt history.

```bash
dproxy history list          # show recent entries
dproxy history show <id>     # show a specific entry
dproxy history search <q>    # search history
dproxy history clear         # clear all history
```

### `dproxy memory`

Named memory snippets injected into every prompt.

```bash
dproxy memory list           # list all snippets
dproxy memory get <key>      # show a snippet
dproxy memory set <key>      # set (reads from stdin or editor)
dproxy memory rm <key>       # delete a snippet
```

### `dproxy template`

YAML prompt templates with `{{variable}}` interpolation.

```bash
dproxy template list         # list templates
dproxy template show <name>  # show a template
dproxy template run <name>   # execute a template
dproxy template create       # create a new template
dproxy template rm <name>    # delete a template
```

### `dproxy config`

Get/set configuration values.

```bash
dproxy config                          # show full config
dproxy config get provider.default     # get a value
dproxy config set provider.default ollama  # set a value
```

### `dproxy init`

Interactive setup wizard. Required before first use.

```bash
dproxy init
```

## Flags reference

| Flag | Scope | Description |
| --- | --- | --- |
| `-p, --provider <name>` | ask, chat | Provider: `claude`, `codex`, `gemini`, `ollama`, `opencode` |
| `-m, --model <model>` | ask, chat | Model to use |
| `--max-turns <n>` | ask, chat | Max agent turns per message |
| `--max-budget-usd <n>` | ask | Max budget in USD |
| `-o, --output-format <fmt>` | ask | Output format: `text`, `json`, `stream-json` |
| `--system-prompt <text>` | ask | System prompt override |
| `--no-memory` | ask, chat | Skip memory injection |
| `--memory <keys>` | ask | Inject specific memory keys (comma-separated) |
| `--no-life` | ask, chat | Skip life/PARA context |
| `--no-history` | ask | Don't save to history |
| `--raw` | ask | Print raw JSON response |
| `--token-footer` | ask | Append token usage footer |
| `--max-session-tokens <n>` | ask | Reset session if context exceeds this |
| `-c, --continue` | ask, chat | Continue last conversation |
| `-r, --resume <id>` | ask, chat | Resume a specific session |

## Context injection

Every prompt is enriched with context from multiple sources, in priority order:

1. **Day chat log** — today's conversation history
2. **Workspace bootstrap** — identity/personality files
3. **Memory snippets** — named markdown snippets (truncated to 4,000 chars)
4. **Life/PARA context** — semantic knowledge base (truncated to 12,000 chars)

Disable with `--no-memory` and `--no-life`.

## Provider configuration

Configure provider-specific options in `~/.dproxy/config.json`:

```json
{
  "provider": {
    "default": "claude",
    "claude": {
      "bin": "claude",
      "skipPermissions": false
    },
    "codex": {
      "bin": "codex",
      "approval": "suggest"
    },
    "gemini": {
      "bin": "gemini",
      "yolo": false
    },
    "ollama": {
      "bin": "ollama",
      "defaultModel": "llama3"
    },
    "opencode": {
      "bin": "opencode",
      "skipPermissions": false
    }
  }
}
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
