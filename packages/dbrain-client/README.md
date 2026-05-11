# @dtoolkit/dbrain-client

[![npm](https://img.shields.io/npm/v/@dtoolkit/dbrain-client.svg)](https://www.npmjs.com/package/@dtoolkit/dbrain-client)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Typed HTTP client for [dbrain](https://www.npmjs.com/package/@dtoolkit/dbrain) — your persistent AI memory server.

## Install

```bash
npm install @dtoolkit/dbrain-client
```

## Quick start

```ts
import { DBrainClient } from "@dtoolkit/dbrain-client";

const brain = new DBrainClient("http://localhost:7878", "sk-dbr_...");

// Search memories
const results = await brain.search("favorite stack");

// Create an entity
await brain.createEntity({
  id: "proj-website",
  name: "Website Redesign",
  type: "project",
  category: "projects",
});

// Remember a fact
await brain.addFact("proj-website", {
  id: "fact-1",
  fact: "Using Next.js 15 with App Router",
});

// Check brain status
const health = await brain.health();
```

## API

| Method | Description |
| --- | --- |
| `health()` | Brain pulse |
| `connect()` | Client config (MCP, permissions, instructions) |
| `listEntities(filters?)` | List entities by category/type |
| `getEntity(id)` | Entity with all its facts |
| `createEntity(entity)` | Create a new entity |
| `archiveEntity(id)` | Archive an entity |
| `listFacts(entityId, filters?)` | Facts for an entity |
| `addFact(entityId, fact)` | Add a fact |
| `bumpFact(id)` | Keep a memory hot |
| `search(query, options?)` | Full-text search over all facts |
| `memorySummary()` | Entity x tier overview |
| `listConversations(filters?)` | List conversations |
| `getConversation(id)` | Full conversation with messages |
| `startConversation(source, id?)` | Start a new conversation |
| `sendMessages(conversationId, messages)` | Send messages |
| `listDocuments()` | List identity documents |
| `getDocument(key)` | Read a document |
| `putDocument(key, doc)` | Create or update a document |
| `deleteDocument(key)` | Delete a document |

## Error handling

```ts
import { DBrainClient, DBrainError } from "@dtoolkit/dbrain-client";

try {
  await brain.getEntity("unknown");
} catch (err) {
  if (err instanceof DBrainError) {
    console.log(err.status); // 404
    console.log(err.path);   // /entities/unknown
  }
}
```

## License

[MIT](../../LICENSE)
