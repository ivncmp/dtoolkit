# LinkedIn Post — English

> Tone: technical but approachable, personal storytelling, no empty hype.

---

I've been working with AI coding agents (Claude Code, Gemini CLI, Codex, OpenCode) for months, and I kept hitting the same walls:

- Every session starts from scratch. The agent remembers nothing.
- It doesn't know what project you're in or what decisions you made yesterday.
- Switching providers means rewriting everything.
- You have no idea what it costs or where it fails.

So I built dtoolkit.

dtoolkit is an open-source engineering toolkit for AI coding agents. It's not another LLM wrapper — it's the infrastructure they're missing: memory, context, project management, and observability.

The idea is simple: one layer, one job.

🧠 **dbrain** — Persistent memory. SQLite + FTS5, MCP server, federation between personal and team brains. Your agent remembers decisions, preferences, and project context across sessions.

🔗 **dcontext** — Automatic hooks. Injects identity and project facts at session start. Saves transcripts before they're lost to compaction. Zero config.

🔀 **dproxy** — One CLI, four providers. Claude, Gemini, Codex, OpenCode. Switch with a flag. REST API included.

📋 **dwork** — AI-native project manager. Markdown is the source of truth. Kanban board, FTS5 search, 21 MCP tools including code graph. SQLite is just an index.

📊 **dops** — Observability. Tokens, costs, tools, success rate, errors. Dashboard with charts and timeseries. Multi-provider transcript ingestion.

Plus: a typed SDK, 4 adapters, codegraph-sdk for code intelligence... 20 packages total. All MIT, all composable.

Philosophy:
- CLI-first, dashboard as bonus
- SQLite everywhere (zero external dependencies)
- MCP + REST on the same port
- Markdown as source of truth
- No vendor lock-in

It's in production. I use it every day. My agent knows who I am, what project I'm working on, what I decided last week, and how much the previous session cost.

If you work with AI coding agents and want them to stop being amnesiac:

→ GitHub: github.com/ivncmp/dtoolkit
→ npm: @dtoolkit/*
→ Docs: dtoolkit.dev/docs

v1.0.0 just shipped. Feedback welcome.

#OpenSource #AIEngineering #DeveloperTools #CodingAgents #MCP
