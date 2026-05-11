<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dbrain-client</h1>
<p align="center">Typed HTTP client for dbrain — your persistent AI memory server</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dbrain-client"><img src="https://img.shields.io/npm/v/@dtoolkit/dbrain-client.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

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
