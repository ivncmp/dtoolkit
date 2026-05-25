<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/adapter-gemini</h1>
<p align="center">dproxy adapter for Gemini CLI</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/adapter-gemini"><img src="https://img.shields.io/npm/v/@dtoolkit/adapter-gemini.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## What it does

Shell-out adapter that wraps the [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini -p --output-format json`). Provides structured JSON output with session management and token usage extracted from model stats.

Used by `@dtoolkit/dproxy` when `--provider gemini` is specified.

## Prerequisites

The `gemini` CLI must be installed and on your PATH:

```bash
npm install -g @anthropic-ai/gemini-cli
```

## Install

```bash
npm install @dtoolkit/adapter-gemini
```

## Usage

```ts
import { createGeminiAdapter } from "@dtoolkit/adapter-gemini";

const adapter = createGeminiAdapter();

const result = await adapter.execute({
  prompt: "Explain what this function does",
  model: "gemini-2.5-pro",
});

console.log(result.text);
console.log(result.sessionId);  // for resuming later
console.log(result.usage);      // { inputTokens, outputTokens, totalTokens }
console.log(result.model);      // actual model name from stats
```

### Session management

```ts
// Start a conversation
const first = await adapter.execute({ prompt: "What is TypeScript?" });

// Resume with session ID
const second = await adapter.execute({
  prompt: "Give me an example",
  sessionId: first.sessionId,
});
```

### YOLO mode

```ts
// Auto-approve all tool executions
const adapter = createGeminiAdapter({ yolo: true });
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bin` | `string` | `"gemini"` | Path to the Gemini CLI binary |
| `yolo` | `boolean` | `false` | Auto-approve all tool executions (`-y` flag) |

```ts
const adapter = createGeminiAdapter({
  bin: "/usr/local/bin/gemini",
  yolo: true,
});
```

## Result fields

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Response text |
| `sessionId` | `string?` | Session ID for resuming |
| `durationMs` | `number` | Execution time |
| `isError` | `boolean` | Whether the CLI reported an error |
| `usage` | `AdapterUsage?` | Token counts (from `stats.models.*.tokens`) |
| `model` | `string?` | Model name (from stats) |
| `raw` | `unknown?` | Full parsed JSON from the CLI |

## License

[MIT](../../LICENSE)
