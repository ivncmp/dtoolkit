import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { loadConnections } from '../../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
const VERSION = pkg.version;

const CLAUDE_MD_CONTENT = `# dbrain

You have an AI brain connected via MCP (dbrain). This is your persistent memory across all conversations and machines.

## What's in the brain

- **Documents**: Identity (who you are), User (who the user is), Soul (how to behave), Memory (narrative reflections). These are returned automatically with every \`recall\` call.
- **Entities + Facts**: Structured knowledge organized by PARA (Projects, Areas, Resources, Archives). Each entity (person, project, system, event) has facts attached. Facts have tiers: hot (recent/frequent), warm, cold.
- **Conversations**: Raw chat history from every AI session. Stored with source (e.g. 'claude-code-home', 'gemini-mobile').

## When to use each tool

- \`recall\` — Search the brain. Use when you need to look up something about the user, their preferences, projects, people, or past conversations. Also returns identity docs. Skip if "Session Context (from dbrain)" is already in your context.
- \`remember\` — Save important facts. Use when the user shares preferences, makes decisions, mentions personal details, or says "remember this". One clear atomic fact per call.
- \`log\` — Store conversation messages. Use periodically to log what's happening in the conversation. Send both user and assistant messages.
- \`get_entity\` — Deep dive. When you need full context about a specific project, person, or system.
- \`list_entities\` — Discover. When you need to see what entities exist, filter by category or type.
- \`create_entity\` — New knowledge. When the user mentions a new project, person, or system worth tracking. Create the entity first, then \`remember\` facts about it.
- \`bump\` — Keep memories alive. When you use a fact to answer a question, bump it so it stays hot.
- \`overview\` — Brain stats. When the user asks "what do you know?" or you need a high-level picture.
- \`wake_up\` — Full identity load. Only needed if you want the complete identity documents outside of a recall.

## Rules

- **IMPORTANT**: If your context already contains "Session Context (from dbrain)", your identity and project facts are already loaded by dcontext. Do NOT call \`recall\` at the start. Only use \`recall\` later if the user asks about something not in the injected context.
- If there is NO "Session Context (from dbrain)" in your context, call \`recall\` with the user's first question or topic at the start of the conversation.
- Never say "I don't know" about the user without searching first.
- When storing facts, be specific and atomic. "Favorite ice cream is pistachio" not "We talked about food preferences".
- Use \`remember\` proactively across ALL projects — not just dbrain. Decisions, milestones, preferences, people, learnings: if it's worth remembering, store it in the brain.
- Use \`log\` to store conversations. At natural breakpoints (end of a task, before the user leaves, or every few exchanges), log a summary of what was discussed and decided. Source: \`claude-code-{hostname}\`.
`;

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const db = app.db;
    const { entities } = db.prepare('SELECT COUNT(*) as entities FROM entities').get() as {
      entities: number;
    };
    const { facts } = db.prepare('SELECT COUNT(*) as facts FROM facts').get() as {
      facts: number;
    };
    const { documents } = db.prepare('SELECT COUNT(*) as documents FROM documents').get() as {
      documents: number;
    };
    const { conversations } = db
      .prepare('SELECT COUNT(*) as conversations FROM conversations')
      .get() as { conversations: number };
    const { unprocessed } = db
      .prepare('SELECT COUNT(*) as unprocessed FROM messages WHERE processed = 0')
      .get() as { unprocessed: number };
    const config = app.config;
    let name = config.brainName;
    if (!name) {
      const identity = db.prepare("SELECT content FROM documents WHERE key = 'identity'").get() as
        | { content: string }
        | undefined;
      name = identity?.content?.match(/\*\*Name:\*\* (.+)/)?.[1] || 'dbrain';
    }
    return {
      status: 'awake',
      name,
      brainType: config.brainType ?? 'personal',
      version: VERSION,
      entities,
      facts,
      documents,
      conversations,
      unprocessed,
      connectedBrains: loadConnections(config.dataPath).length,
    };
  });

  app.get('/me', async (request) => {
    const u = request.brainUser;
    return {
      userId: u?.userId ?? '_admin',
      userName: u?.userName ?? 'Admin',
      permissions: u?.permissions ?? 'read+write',
      isAdmin: u?.userId === '_admin',
    };
  });

  app.get('/connections', async () => {
    const conns = loadConnections(app.config.dataPath);
    const results = await Promise.all(
      conns.map(async (conn) => {
        try {
          const res = await fetch(`${conn.url}/health`, {
            headers: { Authorization: `Bearer ${conn.token}` },
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) return { name: conn.name, url: conn.url, online: false };
          const h = (await res.json()) as {
            name: string;
            entities: number;
            facts: number;
          };
          return {
            name: conn.name,
            url: conn.url,
            online: true,
            brainName: h.name,
            entities: h.entities,
            facts: h.facts,
          };
        } catch {
          return { name: conn.name, url: conn.url, online: false };
        }
      }),
    );
    return results;
  });

  app.get('/connect', async (request) => {
    const config = app.config;
    const host = request.headers.host || `localhost:${config.port}`;
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;

    return {
      mcp: {
        dbrain: {
          type: 'http',
          url: `${baseUrl}/mcp`,
          headers: { Authorization: `Bearer ${config.token}` },
        },
      },
      permissions: ['mcp__dbrain__*'],
      claudeMd: CLAUDE_MD_CONTENT,
    };
  });
}
