<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/adapter-claude</h1>
<p align="center">dproxy adapter for Claude Code CLI</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/adapter-claude"><img src="https://img.shields.io/npm/v/@dtoolkit/adapter-claude.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## What it does

Shell-out adapter that wraps the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude -p --output-format json`). The richest adapter in the toolkit — provides structured JSON output with session management, cost tracking, and full token usage (including cache tokens).

Used by `@dtoolkit/dproxy` as the default adapter.

## Prerequisites

The `claude` CLI must be installed and on your PATH:

```bash
npm install -g @anthropic-ai/claude-code
```

## Install

```bash
npm install @dtoolkit/adapter-claude
```

## Usage

```ts
import { createClaudeAdapter } from "@dtoolkit/adapter-claude";

const adapter = createClaudeAdapter();

const result = await adapter.execute({
  prompt: "Explain what this function does",
  model: "sonnet",
  maxTurns: 3,
});

console.log(result.text);
console.log(result.costUsd);       // e.g. 0.0042
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

### Advanced options

```ts
const result = await adapter.execute({
  prompt: "Refactor this file",
  systemPrompt: "You are a senior TypeScript engineer",
  options: {
    appendSystemPrompt: "Focus on readability",
    allowedTools: ["Read", "Edit", "Write"],
    maxBudgetUsd: 0.50,
    additionalArgs: ["--verbose"],
  },
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bin` | `string` | `"claude"` | Path to the Claude CLI binary |
| `skipPermissions` | `boolean` | `false` | Pass `--dangerously-skip-permissions` |

```ts
const adapter = createClaudeAdapter({
  bin: "/usr/local/bin/claude",
  skipPermissions: true,
});
```

## Result fields

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Response text |
| `sessionId` | `string?` | Session ID for resuming |
| `costUsd` | `number?` | Total cost in USD |
| `durationMs` | `number` | Execution time |
| `isError` | `boolean` | Whether the CLI reported an error |
| `usage` | `AdapterUsage?` | Token counts (input, output, total incl. cache) |
| `model` | `string?` | Model used |
| `raw` | `unknown?` | Full parsed JSON from the CLI |

## License

[MIT](../../LICENSE)
