<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/core</h1>
<p align="center">Shared types and schemas for the dtoolkit ecosystem</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/core"><img src="https://img.shields.io/npm/v/@dtoolkit/core.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

Foundation package for the dtoolkit ecosystem. Exports TypeScript types, Zod schemas, and shared utilities used by all other `@dtoolkit/*` packages.

## Install

```bash
npm install @dtoolkit/core
```

## What's inside

### Adapter types

The universal adapter contract used by all `@dtoolkit/adapter-*` packages:

| Export | Description |
| --- | --- |
| `Adapter` | Interface: `{ provider, execute(request), stream?(request) }` |
| `AdapterRequest` | Request shape: prompt, model, maxTurns, sessionId, options |
| `AdapterResult` | Result shape: text, sessionId, costUsd, durationMs, usage, model, raw |
| `AdapterUsage` | Token counts: inputTokens, outputTokens, totalTokens |
| `AdapterStreamEvent` | Stream event union: text delta, tool use, result, error |

```ts
import type { Adapter, AdapterRequest, AdapterResult } from "@dtoolkit/core";
```

### Data types and schemas

| Export | Description |
| --- | --- |
| `Entity` / `EntitySchema` | Entity type with PARA category and Zod schema |
| `EntityType` / `ParaCategory` | Enums for entity classification |
| `Fact` / `FactSchema` | Fact type with tier config and `computeTier()` |
| `Tier` / `TierConfig` | Memory tier logic: HOT, WARM, COLD |
| `ContextBlock` / `ContextBlockSchema` | Context injection block schema |
| `HistoryEntry` / `SessionInfo` | Prompt history and session types |
| `TemplateDefinition` / `TemplateVariable` | YAML prompt template types |

```ts
import { EntitySchema, computeTier, Tier } from "@dtoolkit/core";

const entity = EntitySchema.parse(data);
const tier = computeTier(fact, { hotDays: 7, hotMinAccess: 10, warmDays: 30 });
// Tier.HOT | Tier.WARM | Tier.COLD
```

### Telemetry types

Types used by `@dtoolkit/dops` and the adapter packages for telemetry extraction:

| Export | Description |
| --- | --- |
| `Target` | Hook target interface for CLI integrations |
| `TelemetryExtractor` | Interface for extracting sessions from CLI transcripts |
| `ParsedSession` / `ParsedTokenUsage` / `ParsedToolCall` | Parsed telemetry data shapes |
| `TranscriptEntry` | Raw transcript entry type |
| `IngestState` | State tracking for incremental ingestion |

### Streaming utilities

| Export | Description |
| --- | --- |
| `LineBuffer` | Newline-delimited buffer for JSONL stream parsing |

### Dcontext helpers

Shared helpers for reading/writing the dcontext section in instruction files (CLAUDE.md, AGENTS.md, etc.):

| Export | Description |
| --- | --- |
| `writeDcontextMdSection(content, section)` | Write/replace a dcontext section in a markdown file |
| `removeDcontextMdSection(content)` | Remove the dcontext section from a markdown file |
| `DCONTEXT_MARKER` / `DBRAIN_START` / `DBRAIN_END` | Section delimiters |

### File utilities

| Export | Description |
| --- | --- |
| `isTextFile(path)` | Check if a file is text (not binary) |
| `embedTextFiles(files)` | Embed text files into a prompt-friendly format |
| `detectMimeType(path)` | Detect MIME type from extension |
| `InputFile` | File attachment type for adapter requests |

### Other utilities

| Export | Description |
| --- | --- |
| `diceCoefficient(a, b)` | Dice coefficient string similarity (0–1) |

## License

[MIT](../../LICENSE)
