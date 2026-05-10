<p align="center">
  <img src="logo.png" alt="dtoolkit" />
</p>

# dtoolkit

Open-source harness engineering toolkit for AI coding agents.

The frontier isn't the model — it's the harness: loop, context, tools, hooks, memory, observability. dtoolkit is a family of composable products that make your coding agents smarter, faster, and observable.

## Packages

| Package | Description |
|---|---|
| `@dtoolkit/core` | Shared types (`ContextBlock`, `Fact`, `Entity`, hooks API) |
| `@dtoolkit/dbrain` | Persistent memory server (SQLite + FTS5) with MCP, REST API and dashboard |
| `@dtoolkit/dbrain-client` | JS/TS client for dbrain |
| `@dtoolkit/dcontext` | Tool cache + background compactor (local) |
| `@dtoolkit/dprime` | Auto-briefing before touching a module |
| `@dtoolkit/dproxy` | Universal adapter for invoking models via local CLIs |
| `@dtoolkit/adapter-claude` | Adapter for Claude Code CLI |
| `@dtoolkit/adapter-openai` | Adapter for OpenAI CLI |
| `@dtoolkit/adapter-gemini` | Adapter for Gemini CLI |
| `@dtoolkit/adapter-ollama` | Adapter for Ollama |
| `@dtoolkit/dstream` | Daily digest — what each agent learned, decided, or blocked today |
| `@dtoolkit/dreplay` | Session browser for the team (privacy-aware) |
| `@dtoolkit/dpair` | Real-time shared pair-programming with an agent |
| `@dtoolkit/dops` | Observability: tokens/cost, tools, success rate, errors per hook |
| `@dtoolkit/dpolicy` | Policy-as-code for the team harness |
| `@dtoolkit/dguard` | Pre-commit for agents: validate LLM output before applying |
| `@dtoolkit/dforge` | Internal marketplace for skills/hooks/slash commands |
| `@dtoolkit/droute` | Model router (Haiku trivial, Sonnet search, Opus codegen) + cost tracking |
| `@dtoolkit/dcouncil` | Multi-agent debate for architecture decisions |

## Getting Started

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
