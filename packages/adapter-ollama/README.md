<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/adapter-ollama</h1>
<p align="center">dproxy adapter for local models via Ollama</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/adapter-ollama"><img src="https://img.shields.io/npm/v/@dtoolkit/adapter-ollama.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## What it does

Shell-out adapter that wraps the [Ollama CLI](https://ollama.com/) (`ollama run <model>`). Enables fully offline, private agent sessions with local models. Strips ANSI escape codes and suppresses thinking output for clean text responses.

Used by `@dtoolkit/dproxy` when `--provider ollama` is specified.

## Prerequisites

Ollama must be installed and running:

```bash
# macOS
brew install ollama

# Then pull a model
ollama pull llama3
```

## Install

```bash
npm install @dtoolkit/adapter-ollama
```

## Usage

```ts
import { createOllamaAdapter } from "@dtoolkit/adapter-ollama";

const adapter = createOllamaAdapter();

const result = await adapter.execute({
  prompt: "Explain what this function does",
});

console.log(result.text);
console.log(result.model);  // "llama3" (default)
```

### Using a specific model

```ts
const result = await adapter.execute({
  prompt: "Write a haiku about TypeScript",
  model: "codellama",
});
```

### Custom default model

```ts
const adapter = createOllamaAdapter({
  defaultModel: "mistral",
});

// All calls now use mistral unless overridden
const result = await adapter.execute({ prompt: "Hello" });
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bin` | `string` | `"ollama"` | Path to the Ollama binary |
| `defaultModel` | `string` | `"llama3"` | Default model when none specified in the request |

```ts
const adapter = createOllamaAdapter({
  bin: "/usr/local/bin/ollama",
  defaultModel: "codellama",
});
```

## Result fields

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Response text (ANSI codes stripped) |
| `durationMs` | `number` | Execution time |
| `isError` | `boolean` | Whether the CLI exited with error |
| `model` | `string` | Model used |

## License

[MIT](../../LICENSE)
