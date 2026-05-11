<p align="center">
  <img src="logo.png" alt="dtoolkit" />
</p>

<h1 align="center">dtoolkit</h1>
<p align="center">Open-source harness engineering toolkit for AI coding agents</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/ivncmp/dtoolkit"><img src="https://img.shields.io/github/stars/ivncmp/dtoolkit.svg?style=social" alt="GitHub"></a>
</p>

---

The frontier isn't the model — it's the **harness**: loop, context, tools, hooks, memory, observability. dtoolkit is a family of composable products that make your coding agents smarter, faster, and observable.

Each product has **one job**, works standalone, and composes with the rest via a neutral `ContextBlock[]` contract. No vendor lock-in — works with Claude Code, OpenCode, Cursor, Codex, and any tool that speaks MCP or CLI.

## Packages

### Core

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/core`](packages/core/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/core.svg)](https://www.npmjs.com/package/@dtoolkit/core) | Shared types and Zod schemas (`Adapter`, `ContextBlock`, `Fact`, `Entity`, `Tier`) |

### Memory & Context

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/dbrain`](packages/dbrain/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/dbrain.svg)](https://www.npmjs.com/package/@dtoolkit/dbrain) | Persistent memory server — SQLite + FTS5, MCP, REST API, dashboard |
| [`@dtoolkit/dbrain-client`](packages/dbrain-client/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/dbrain-client.svg)](https://www.npmjs.com/package/@dtoolkit/dbrain-client) | Typed HTTP client for dbrain |
| [`@dtoolkit/dcontext`](packages/dcontext/) | — | Tool cache + background compactor (local) |
| [`@dtoolkit/dprime`](packages/dprime/) | — | Auto-briefing before touching a module |

### Multi-provider Transport

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/dproxy`](packages/dproxy/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/dproxy.svg)](https://www.npmjs.com/package/@dtoolkit/dproxy) | Universal CLI adapter for invoking models |
| [`@dtoolkit/adapter-claude`](packages/adapter-claude/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/adapter-claude.svg)](https://www.npmjs.com/package/@dtoolkit/adapter-claude) | Adapter for Claude Code CLI |
| [`@dtoolkit/adapter-codex`](packages/adapter-codex/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/adapter-codex.svg)](https://www.npmjs.com/package/@dtoolkit/adapter-codex) | Adapter for Codex CLI |
| [`@dtoolkit/adapter-gemini`](packages/adapter-gemini/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/adapter-gemini.svg)](https://www.npmjs.com/package/@dtoolkit/adapter-gemini) | Adapter for Gemini CLI |
| [`@dtoolkit/adapter-ollama`](packages/adapter-ollama/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/adapter-ollama.svg)](https://www.npmjs.com/package/@dtoolkit/adapter-ollama) | Adapter for Ollama CLI |
| [`@dtoolkit/adapter-opencode`](packages/adapter-opencode/) | [![npm](https://img.shields.io/npm/v/@dtoolkit/adapter-opencode.svg)](https://www.npmjs.com/package/@dtoolkit/adapter-opencode) | Adapter for OpenCode CLI |

### Team Coordination

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/dstream`](packages/dstream/) | — | Daily digest — what each agent learned, decided, or blocked today |
| [`@dtoolkit/dreplay`](packages/dreplay/) | — | Session browser for the team (privacy-aware) |
| [`@dtoolkit/dpair`](packages/dpair/) | — | Real-time pair-programming with a shared agent |

### Quality & Observability

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/dops`](packages/dops/) | — | Agent observability — tokens, cost, tools, success rate, errors |
| [`@dtoolkit/dpolicy`](packages/dpolicy/) | — | Policy-as-code for the team harness |
| [`@dtoolkit/dguard`](packages/dguard/) | — | Pre-commit for agents — validate LLM output before applying |

### Distribution & DevEx

| Package | Version | Description |
| --- | --- | --- |
| [`@dtoolkit/dforge`](packages/dforge/) | — | Internal marketplace for skills, hooks, and slash commands |
| [`@dtoolkit/droute`](packages/droute/) | — | Model router (Haiku/Sonnet/Opus) + cost tracking |
| [`@dtoolkit/dcouncil`](packages/dcouncil/) | — | Multi-agent debate for architecture decisions |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Agent                           │
│                  (Claude Code, OpenCode, …)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ContextBlock[] (neutral contract)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │ dprime  │      │ dcontext │      │  dbrain  │
   │ briefing│      │  cache + │      │ memory   │
   │ builder │      │compactor │      │ server   │
   └─────────┘      └──────────┘      └──────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐ ┌──────────┐
              │  dproxy  │ │  dops    │
              │ transport│ │ metrics  │
              └────┬─────┘ └──────────┘
                   │
      ┌────────┬───┴───┬────────┬──────────┐
      ▼        ▼       ▼        ▼          ▼
   claude    codex   gemini   ollama    opencode
   adapter  adapter  adapter  adapter   adapter
```

**Design principle:** one layer, one responsibility. If two products need to sync to function, it's wrong.

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages (dependency-ordered)
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

Per-package:

```bash
pnpm --filter @dtoolkit/dbrain dev      # watch mode
pnpm --filter @dtoolkit/dproxy build    # single build
```

## Contributing

This is a [pnpm workspace](https://pnpm.io/workspaces) monorepo using [Turborepo](https://turbo.build/) for task orchestration and [Changesets](https://github.com/changesets/changesets) for versioning.

```bash
pnpm changeset       # describe your change
git push             # CI runs lint + test + build
                     # release workflow creates a version PR
                     # merging publishes to npm
```

## License

[MIT](LICENSE)
