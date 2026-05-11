# @dtoolkit/core

[![npm](https://img.shields.io/npm/v/@dtoolkit/core.svg)](https://www.npmjs.com/package/@dtoolkit/core)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Shared types and schemas for the [dtoolkit](https://github.com/ivncmp/dtoolkit) ecosystem.

## Install

```bash
npm install @dtoolkit/core
```

## What's inside

| Export             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `Entity`           | Entity type, PARA category, and Zod schema       |
| `Fact`             | Fact type with tier config and `computeTier()`   |
| `ContextBlock`     | Context injection block schema                   |
| `HistoryEntry`     | Prompt history entry type                        |
| `TemplateDefinition` | YAML prompt template types                     |

## Usage

```ts
import { EntitySchema, computeTier, Tier } from "@dtoolkit/core";

const entity = EntitySchema.parse(data);

const tier = computeTier(fact, { hotDays: 7, hotMinAccess: 10, warmDays: 30 });
// Tier.HOT | Tier.WARM | Tier.COLD
```

## License

[MIT](../../LICENSE)
