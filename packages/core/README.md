<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/core</h1>
<p align="center">Shared types and schemas for the dtoolkit ecosystem</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/core"><img src="https://img.shields.io/npm/v/@dtoolkit/core.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## Install

```bash
npm install @dtoolkit/core
```

## What's inside

### Adapter types

The universal adapter contract used by all `@dtoolkit/adapter-*` packages:

| Export | Description |
| --- | --- |
| `Adapter` | Interface: `{ provider: string; execute(request): Promise<AdapterResult> }` |
| `AdapterRequest` | Request shape: prompt, model, maxTurns, sessionId, options |
| `AdapterResult` | Result shape: text, sessionId, costUsd, durationMs, usage, model, raw |
| `AdapterUsage` | Token counts: inputTokens, outputTokens, totalTokens |

```ts
import type { Adapter, AdapterRequest, AdapterResult, AdapterUsage } from "@dtoolkit/core";
```

### Data types and schemas

| Export | Description |
| --- | --- |
| `Entity` | Entity type, PARA category, and Zod schema |
| `Fact` | Fact type with tier config and `computeTier()` |
| `ContextBlock` | Context injection block schema |
| `HistoryEntry` | Prompt history entry type |
| `TemplateDefinition` | YAML prompt template types |

```ts
import { EntitySchema, computeTier, Tier } from "@dtoolkit/core";

const entity = EntitySchema.parse(data);

const tier = computeTier(fact, { hotDays: 7, hotMinAccess: 10, warmDays: 30 });
// Tier.HOT | Tier.WARM | Tier.COLD
```

## License

[MIT](../../LICENSE)
