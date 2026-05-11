# @dtoolkit/dbrain

[![npm](https://img.shields.io/npm/v/@dtoolkit/dbrain.svg)](https://www.npmjs.com/package/@dtoolkit/dbrain)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Your distributed mind. Persistent knowledge across all your AIs.

Install it once, connect every AI you use — Claude Code at home, Claude Code at work, Gemini on your phone. All share the same identity, the same memories, the same knowledge.

```
[Home]   Claude Code ──MCP──┐
[Work]   Claude Code ──MCP──┤     ┌─────────────────────────────────┐
[Mobile] Gemini ──REST──────┼────→│  dbrain (your mind)             │
[Server] OpenClaw ──REST────┤     │  identity + memory + knowledge  │
[Other]  Custom AI ──API────┘     └─────────────────────────────────┘
```

## Install

```bash
npm install -g @dtoolkit/dbrain
```

## Quick start

```bash
dbrain init       # interactive wizard — creates DB, config, identity
dbrain start      # starts API on :7878 + dashboard on :7879
```

Then connect Claude Code from any machine:

```bash
dbrain connect claude
```

## Docker

```bash
docker compose up -d
```

Then from any client machine:

```bash
dbrain connect claude http://your-server:7878
```

## How it works

The brain has 4 layers:

| Layer             | What                                                  | How                                                  |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **Identity**      | Who is the AI? Who is the user? How should it behave? | `documents` table                                    |
| **Conversations** | Raw chat history from every AI session                | `conversations` + `messages` tables                  |
| **Knowledge**     | Structured facts organized by PARA                    | `entities` + `facts` tables with hot/warm/cold tiers |
| **Recall**        | Full-text search over all facts                       | FTS5 with OR logic for multi-language queries        |

### Memory tiers

Memories fade if you don't use them — like a real brain.

| Tier     | Rule                                              |
| -------- | ------------------------------------------------- |
| **hot**  | Accessed in the last 7 days, or accessCount >= 10 |
| **warm** | 8–30 days since last access                       |
| **cold** | > 30 days — fading, candidate for archival        |

## MCP tools

| Tool            | Purpose                                     |
| --------------- | ------------------------------------------- |
| `recall`        | Search memory + get identity (primary tool) |
| `remember`      | Save a fact to an entity                    |
| `get_entity`    | Read entity with all its facts              |
| `list_entities` | List entities by category or type           |
| `create_entity` | Create a new entity                         |
| `bump`          | Touch a memory to keep it hot               |
| `log`           | Send conversation messages for storage      |
| `wake_up`       | Full identity load                          |
| `overview`      | Brain stats                                 |

## REST API

All endpoints require `Authorization: Bearer <token>` except `/health`.

| Method            | Endpoint              | Purpose                                        |
| ----------------- | --------------------- | ---------------------------------------------- |
| `GET`             | `/health`             | Brain pulse                                    |
| `GET`             | `/connect`            | Client config (MCP, permissions, instructions) |
| `GET/PUT/DELETE`  | `/workspace/:key`     | Identity documents                             |
| `GET/POST/DELETE` | `/entities/:id`       | Knowledge entities                             |
| `POST`            | `/entities/:id/facts` | Add facts to an entity                         |
| `PATCH`           | `/facts/:id/access`   | Bump a memory (keep it hot)                    |
| `GET/POST`        | `/conversations`      | Chat history                                   |
| `POST`            | `/search`             | Full-text search over all facts                |
| `GET`             | `/memory/summary`     | Overview: entities x tiers                     |

## CLI commands

| Command                          | Where  | Purpose                                   |
| -------------------------------- | ------ | ----------------------------------------- |
| `dbrain init [path]`             | Server | Create a new brain (DB, config, identity) |
| `dbrain start [path]`            | Server | Start the API server + dashboard          |
| `dbrain connect <client> [url]`  | Client | Connect a client to a running brain       |
| `dbrain status [path]`           | Server | Check brain status                        |

## Dashboard

Web dashboard on port `7879`. Shows brain stats, entities with PARA categories, fact tiers, conversations, and full-text search.

## Stack

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Language   | Node.js + TypeScript                       |
| API        | Fastify                                    |
| DB         | SQLite + FTS5 (better-sqlite3)             |
| MCP        | @modelcontextprotocol/sdk (HTTP transport) |
| Validation | Zod                                        |
| CLI        | @clack/prompts                             |
| Dashboard  | React 18 (CDN, no build step)              |

## Environment variables

For non-interactive setup (Docker, CI):

| Variable            | Default        | Purpose          |
| ------------------- | -------------- | ---------------- |
| `DBRAIN_DATA`       | `~/.dbrain`    | Data path        |
| `DBRAIN_PORT`       | `7878`         | API port         |
| `DBRAIN_HOST`       | `0.0.0.0`      | Bind address     |
| `DBRAIN_TOKEN`      | Auto-generated | Access token     |
| `DBRAIN_AGENT_NAME` | `dBrain`       | AI identity name |
| `DBRAIN_OWNER_NAME` | `Human`        | Owner name       |
| `DBRAIN_TIMEZONE`   | Auto-detected  | Owner timezone   |

## License

[MIT](../../LICENSE)
