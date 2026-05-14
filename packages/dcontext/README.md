<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dcontext</h1>
<p align="center">dbrain hooks for AI coding CLIs</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dcontext"><img src="https://img.shields.io/npm/v/@dtoolkit/dcontext.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

Hook-based bridge between [dbrain](../dbrain/) and AI coding CLIs. Injects your identity, soul, and project facts at session start so the AI already knows everything — no need to call `recall`. Also saves key exchanges to dbrain before context compaction.

Requires a running [dbrain](../dbrain/) instance.

## Works with

| CLI | Hook mechanism | Status |
|-----|---------------|--------|
| **Claude Code** | Hooks in `~/.claude/settings.json` | v1 |
| **Gemini CLI** | Hooks in `~/.gemini/settings.json` | v1 |
| **OpenCode** | In-process npm plugin | v1 |

## Install

```bash
npm install -g @dtoolkit/dcontext
```

## Quick start

```bash
# 1. Connect to dbrain and map your project
dcontext init
# ? How do you want to connect to dbrain? → Connect to existing dbrain
# ? dbrain URL: http://localhost:7878
# ? dbrain token: sk-dbr_...
# ? Map /Users/you/my-project to entity: → my-project

# 2. Install hooks for your CLI
dcontext install claude

# 3. Start coding — sessions start warm
claude
# → Session Context (from dbrain) is injected automatically
# → Identity, soul, user profile, and project facts already loaded
# → No recall needed at start
```

## How it works

dcontext hooks into two moments of a session's lifecycle:

| Moment | What happens |
|--------|-------------|
| **Session start** | Searches dbrain for project facts, loads identity/soul/user docs, injects as `additionalContext` |
| **Pre-compaction** | Reads the session transcript, extracts meaningful exchanges, saves to dbrain as a conversation |

The AI receives the context transparently via hooks — it never calls dcontext directly.

```
┌─────────────────┐     SessionStart      ┌─────────────┐
│   Claude Code   │◄─────────────────────  │  dcontext    │
│   Gemini CLI    │  additionalContext     │  (hooks)     │
│   OpenCode      │                        │              │
│                 │     PreCompact         │              │
│                 │─────────────────────►  │              │
└─────────────────┘  transcript            └──────┬───────┘
                                                  │
                                           search / save
                                                  │
                                           ┌──────▼───────┐
                                           │    dbrain     │
                                           │  (memory)     │
                                           └──────────────┘
```

### What gets injected

The session briefing includes (in order):

1. **Identity** — who the AI is (name, creation date)
2. **Soul** — behavioral guidelines
3. **User** — who you are (name, timezone)
4. **Project facts** — recent decisions, milestones, preferences, context (up to 15 facts, truncated to 200 chars each)

Total briefing capped at 8000 characters.

### CLAUDE.md integration

When you run `dcontext install claude`, it also modifies the dbrain section in `~/.claude/CLAUDE.md` to tell Claude **not to call `recall` at session start** — since the context is already injected. Run `dbrain connect claude` to restore the original dbrain instructions after uninstalling.

## Commands

| Command | Description |
|---------|-------------|
| `dcontext init` | Interactive setup — connect to dbrain, map projects |
| `dcontext install <target>` | Install hooks (`claude`, `gemini`, `opencode`) |
| `dcontext uninstall <target>` | Remove hooks |
| `dcontext status` | Show config, targets, project mappings, stats |
| `dcontext explore` | Preview the briefing that would be injected for the current directory |
| `dcontext hook <event>` | Internal — called by CLI hooks, not for direct use |

## Configuration

Config at `~/.dcontext/config.json` (created by `dcontext init`):

```json
{
  "initialized": true,
  "dbrain": {
    "url": "http://localhost:7878",
    "token": "sk-dbr_..."
  },
  "projects": {
    "/Users/you/my-project": "my-project"
  },
  "briefing": {
    "maxFacts": 15,
    "includeIdentity": true,
    "maxChars": 8000,
    "maxCharsPerFact": 200
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `dbrain.url` | — | dbrain server URL |
| `dbrain.token` | — | Bearer token for dbrain API |
| `projects` | `{}` | Maps absolute cwd path to dbrain entity name |
| `briefing.maxFacts` | `15` | Max facts to include in briefing |
| `briefing.includeIdentity` | `true` | Include identity, soul, and user docs |
| `briefing.maxChars` | `8000` | Max total briefing length |
| `briefing.maxCharsPerFact` | `200` | Max characters per individual fact |

## Data storage

```
~/.dcontext/
├── config.json     # Configuration (created by init)
├── stats.json      # Usage statistics (briefings served, extractions done)
└── error.log       # Hook errors (hooks never crash — they log and exit 0)
```

## License

[MIT](../../LICENSE)
