<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/adapter-codex</h1>
<p align="center">dproxy adapter for Codex CLI</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/adapter-codex"><img src="https://img.shields.io/npm/v/@dtoolkit/adapter-codex.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## What it does

Shell-out adapter that wraps the [Codex CLI](https://github.com/openai/codex) (`codex exec --json`). Parses JSONL event output to extract text from `item.completed` events and token usage from `turn.completed` events.

Used by `@dtoolkit/dproxy` when `--provider codex` is specified.

## Prerequisites

The `codex` CLI must be installed and on your PATH:

```bash
npm install -g @openai/codex
```

## Install

```bash
npm install @dtoolkit/adapter-codex
```

## Usage

```ts
import { createCodexAdapter } from "@dtoolkit/adapter-codex";

const adapter = createCodexAdapter();

const result = await adapter.execute({
  prompt: "Explain what this function does",
  model: "o4-mini",
});

console.log(result.text);
console.log(result.usage);  // { inputTokens, outputTokens, totalTokens }
```

### Approval modes

```ts
// Default: suggest (no auto-apply)
const safe = createCodexAdapter({ approval: "suggest" });

// Auto-edit: apply file changes automatically
const autoEdit = createCodexAdapter({ approval: "auto-edit" });

// Full auto: bypass all approvals and sandbox
const fullAuto = createCodexAdapter({ approval: "full-auto" });
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bin` | `string` | `"codex"` | Path to the Codex CLI binary |
| `approval` | `"suggest" \| "auto-edit" \| "full-auto"` | `"suggest"` | Approval mode for file changes |

```ts
const adapter = createCodexAdapter({
  bin: "/usr/local/bin/codex",
  approval: "auto-edit",
});
```

## Result fields

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Response text (from `item.completed` events) |
| `durationMs` | `number` | Execution time |
| `isError` | `boolean` | Whether the CLI exited with error |
| `usage` | `AdapterUsage?` | Token counts (from `turn.completed` event) |
| `raw` | `unknown?` | Parsed JSONL events array |

## License

[MIT](../../LICENSE)
