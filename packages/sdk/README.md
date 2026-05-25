<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/sdk</h1>
<p align="center">Typed HTTP clients for dtoolkit services (dbrain + dproxy + dwork)</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/sdk"><img src="https://img.shields.io/npm/v/@dtoolkit/sdk.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

## Install

```bash
npm install @dtoolkit/sdk
```

## Quick Start

### DBrainClient

Connect to a [dbrain](../dbrain/) persistent memory server:

```ts
import { DBrainClient } from "@dtoolkit/sdk";

const brain = new DBrainClient("http://localhost:7878", "sk-dbr_...");

// Search memory
const results = await brain.search("authentication flow");

// Manage entities
const entities = await brain.listEntities({ category: "projects" });
const entity = await brain.getEntity("my-project");

// Add facts
await brain.addFact("my-project", {
  id: "fact-1",
  fact: "Uses JWT for session management",
});

// Conversations
const conv = await brain.startConversation("claude-code");
await brain.sendMessages(conv.id, [
  { role: "user", content: "How does auth work?" },
]);

// Documents
const docs = await brain.listDocuments();
await brain.putDocument("notes", {
  title: "Architecture Notes",
  content: "...",
});

// Federation (personal brains with shared brain connections)
const connections = await brain.listConnections();
const federated = await brain.searchFederated("auth flow");
console.log(federated.federation); // { local: 3, remote: 2, partial: false, ... }
await brain.shareFact("fact_abc123", "team-brain");

// API key management (shared brains only)
const key = await brain.createApiKey({ userId: "ivan", userName: "Ivan" });
const keys = await brain.listApiKeys();
await brain.revokeApiKey(key.id);
```

### DProxyClient

Connect to a [dproxy](../dproxy/) HTTP API server:

```ts
import { DProxyClient } from "@dtoolkit/sdk";

const proxy = new DProxyClient("http://localhost:7880", "my-token");

// Single-shot prompt
const result = await proxy.ask("explain monads in one sentence", {
  provider: "claude",
  model: "sonnet",
});
console.log(result.text);

// Streaming
for await (const event of proxy.askStream("write a haiku")) {
  if (event.type === "text") {
    process.stdout.write(event.text ?? "");
  }
}

// Memory
await proxy.setMemory("project-context", "This project uses React + Fastify");
const keys = await proxy.listMemoryKeys();

// Templates
const templates = await proxy.listTemplates();
const output = await proxy.runTemplate("code-review", {
  vars: { file: "src/index.ts" },
});

// History
const history = await proxy.listHistory(10);
const matches = await proxy.searchHistory("monads");
```

### DWorkClient

Connect to a [dwork](../dwork/) project manager:

```ts
import { DWorkClient } from "@dtoolkit/sdk";

const work = new DWorkClient("http://localhost:7881", "sk-dwk_...");

// Projects
const projects = await work.listProjects();
const project = await work.getProject("my-project");
await work.createProject({ slug: "new-project", name: "New Project" });

// Tasks
const tasks = await work.listTasks("my-project", { status: "doing" });
await work.addTask("my-project", {
  title: "Implement auth",
  priority: "P0",
  status: "todo",
});
await work.updateTask("task_abc", { status: "done" });

// Docs
const docs = await work.listDocs("my-project");
const doc = await work.getDoc("doc_xyz");
await work.addDoc("my-project", {
  title: "Auth Design",
  body: "# Auth Design\n\n...",
  type: "detail",
});

// Search & overview
const results = await work.search("authentication");
const overview = await work.overview();
const next = await work.whatToDoNext("my-project");

// Sync docs from source via dproxy
await work.sync("my-project");
```

## Authentication

All dtoolkit services use unified `Authorization: Bearer <token>` authentication. Pass the token as the second constructor argument:

```ts
// All clients use the same auth mechanism
const brain = new DBrainClient("http://localhost:7878", "my-token");
const proxy = new DProxyClient("http://localhost:7880", "my-token");
const work = new DWorkClient("http://localhost:7881", "my-token");

// Or use the options object
const brain = new DBrainClient({
  baseUrl: "http://localhost:7878",
  token: "my-token",
});
```

## Error Handling

Both clients throw `SdkError` on HTTP errors:

```ts
import { SdkError } from "@dtoolkit/sdk";

try {
  await brain.getEntity("nonexistent");
} catch (err) {
  if (err instanceof SdkError) {
    console.error(err.status); // 404
    console.error(err.path); // /entities/nonexistent
    console.error(err.body); // response body
  }
}
```

## API Reference

### DBrainClient

| Method | Description |
| --- | --- |
| `health()` | Server health check |
| `connect()` | Get MCP connection info |
| `listEntities(filters?)` | List entities (filter by category/type) |
| `getEntity(id)` | Get entity with all facts |
| `createEntity(entity)` | Create a new entity |
| `archiveEntity(id)` | Archive an entity |
| `listFacts(entityId, filters?)` | List facts for an entity |
| `addFact(entityId, fact)` | Add a fact to an entity |
| `bumpFact(id)` | Bump fact access (keeps it hot) |
| `search(query, options?)` | Full-text search across facts |
| `memorySummary()` | Get tier summary per entity |
| `listConversations(filters?)` | List conversations |
| `getConversation(id)` | Get conversation with messages |
| `startConversation(source, id?)` | Start a new conversation |
| `sendMessages(conversationId, messages)` | Send messages to a conversation |
| `listMessages(conversationId, filters?)` | List messages in a conversation |
| `pendingMessages()` | Get unprocessed message counts |
| `listDocuments()` | List workspace documents |
| `getDocument(key)` | Get a document by key |
| `putDocument(key, doc)` | Create or update a document |
| `deleteDocument(key)` | Delete a document |
| `listConnections()` | List connected brains with health status |
| `searchFederated(query, options?)` | Federated search across connected brains |
| `shareFact(factId, targetBrain?)` | Push a fact to a connected brain |
| `createApiKey(params)` | Create a per-user API key (shared brains) |
| `listApiKeys()` | List API keys (shared brains) |
| `revokeApiKey(id)` | Revoke an API key (shared brains) |

### DProxyClient

| Method | Description |
| --- | --- |
| `health()` | Server health check |
| `ask(prompt, options?)` | Send a prompt (non-streaming) |
| `askStream(prompt, options?)` | Send a prompt (SSE streaming) |
| `listHistory(limit?)` | List prompt history |
| `getHistory(id)` | Get a history entry |
| `searchHistory(query)` | Search prompt history |
| `clearHistory(before?)` | Clear history entries |
| `listMemoryKeys()` | List memory keys |
| `getMemory(key)` | Get memory content by key |
| `setMemory(key, content)` | Set memory content |
| `deleteMemory(key)` | Delete a memory key |
| `searchMemory(query)` | Search memory content |
| `listTemplates()` | List prompt templates |
| `getTemplate(name)` | Get a template by name |
| `saveTemplate(name, template)` | Save a prompt template |
| `runTemplate(name, options?)` | Execute a prompt template |
| `deleteTemplate(name)` | Delete a template |
| `getConfig()` | Get full server config |
| `getConfigValue(key)` | Get a config value by key |
| `setConfigValue(key, value)` | Set a config value |

### DWorkClient

| Method | Description |
| --- | --- |
| `health()` | Server health check |
| `listProjects(status?)` | List projects (filter by status) |
| `getProject(slug)` | Get project details |
| `createProject(project)` | Create a new project |
| `updateProject(slug, changes)` | Update a project |
| `deleteProject(slug)` | Delete a project |
| `listTasks(project, filters?)` | List tasks (filter by status/priority) |
| `addTask(project, task)` | Add a task to a project |
| `updateTask(id, changes)` | Update a task |
| `deleteTask(id)` | Delete a task |
| `listDocs(project, type?)` | List documents (filter by type) |
| `getDoc(id)` | Get document with content |
| `addDoc(project, doc)` | Create a numbered document |
| `updateDoc(id, changes)` | Update document content |
| `deleteDoc(id)` | Delete a document |
| `search(query, options?)` | Full-text search across tasks + docs |
| `overview()` | Global stats + per-project summaries |
| `whatToDoNext(project?)` | Suggested next tasks by priority/deadline |
| `sync(project)` | Sync docs from source via dproxy |
| `createApiKey(params)` | Create a per-user API key |
| `listApiKeys()` | List API keys |
| `revokeApiKey(id)` | Revoke an API key |

## License

MIT
