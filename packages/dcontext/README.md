<p align="center">
  <img src="https://raw.githubusercontent.com/ivncmp/dtoolkit/main/logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dcontext</h1>
<p align="center">Tool cache + background compactor for AI coding agents</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dcontext"><img src="https://img.shields.io/npm/v/@dtoolkit/dcontext.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

dcontext runs **locally** on the developer's machine and optimizes the agent's context window in real time:

- **Tool cache** — content-addressable cache of tool outputs to avoid redundant reads
- **Background compactor** — compresses context with a fast model (Haiku) while the dev thinks, eliminating the compaction pause
- **Context doctor** — detects and warns about context bloat before it impacts quality
- **Fact extraction** — extracts reusable knowledge during compaction and stores it in dbrain

## Design

dcontext is **not** memory (that's dbrain) — it's a cache with TTL. It doesn't know the provider (that's dproxy) and doesn't format briefings (that's dprime).

```bash
dproxy chat --context dcontext              # enable context optimization
dproxy ask "x" --memory dbrain --context dcontext --prime .  # full stack
```

## License

[MIT](../../LICENSE)
