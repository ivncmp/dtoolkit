<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/adapter-opencode</h1>
<p align="center">dproxy adapter for OpenCode CLI</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/adapter-opencode"><img src="https://img.shields.io/npm/v/@dtoolkit/adapter-opencode.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## What it does

Shell-out adapter that wraps the [OpenCode CLI](https://github.com/nicholasgriffintn/opencode) (`opencode run --format json`). Parses JSONL event output to extract text from `text` events, token usage and cost from `step_finish` events, and session IDs for conversation continuity.

Used by `@dtoolkit/dproxy` when `--provider opencode` is specified.

## Prerequisites

The `opencode` CLI must be installed and on your PATH:

```bash
npm install -g opencode
```

## Install

```bash
npm install @dtoolkit/adapter-opencode
```

## Usage

```ts
import { createOpenCodeAdapter } from "@dtoolkit/adapter-opencode";

const adapter = createOpenCodeAdapter();

const result = await adapter.execute({
  prompt: "Explain what this function does",
  model: "sonnet",
});

console.log(result.text);
console.log(result.costUsd);       // from step_finish cost
console.log(result.sessionId);     // for resuming later
console.log(result.usage);         // { inputTokens, outputTokens, totalTokens }
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

// Or continue the latest session
const third = await adapter.execute({
  prompt: "Now explain generics",
  continueSession: true,
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bin` | `string` | `"opencode"` | Path to the OpenCode CLI binary |
| `skipPermissions` | `boolean` | `false` | Pass `--dangerously-skip-permissions` |

```ts
const adapter = createOpenCodeAdapter({
  bin: "/usr/local/bin/opencode",
  skipPermissions: true,
});
```

## Result fields

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Response text (from `text` events) |
| `sessionId` | `string?` | Session ID for resuming |
| `costUsd` | `number?` | Cost in USD (from `step_finish` event) |
| `durationMs` | `number` | Execution time |
| `isError` | `boolean` | Whether the CLI exited with error |
| `usage` | `AdapterUsage?` | Token counts (from `step_finish` event) |
| `raw` | `unknown?` | Parsed JSONL events array |

## License

[MIT](../../LICENSE)
