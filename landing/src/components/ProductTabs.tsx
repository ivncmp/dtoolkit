import type { JSX } from 'react';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  code: string;
  install: string;
}

const products: Product[] = [
  {
    id: 'dbrain',
    name: 'dbrain',
    tagline: 'Your distributed mind',
    description:
      'Persistent knowledge that follows your AI agents across sessions, tools, and projects. SQLite + FTS5 full-text search, REST API + MCP protocol, and federation across multiple brains.',
    features: [
      'Entities, facts, and conversations with automatic tiering',
      'Full-text search with FTS5 across all memories',
      'MCP server — works with Claude Code, Cursor, Windsurf',
      'Federation — connect personal and shared team brains',
      'React dashboard for browsing and searching',
    ],
    install: 'npm install -g @dtoolkit/dbrain',
    code: `# Create and start your brain
$ dbrain init
$ dbrain start
✓ API on :7878 — Dashboard on :7879

# Connect your coding CLI
$ dbrain connect claude
✓ MCP server configured
✓ Permissions added
✓ CLAUDE.md instructions written

# Your agents remember everything (via MCP)
> remember "Deploy uses blue-green on prod"
✓ Fact stored (entity: infrastructure)

> recall "how do we deploy?"
→ Deploy uses blue-green on prod
  (tier: hot, confidence: 0.95)`,
  },
  {
    id: 'dcontext',
    name: 'dcontext',
    tagline: 'Automatic context injection',
    description:
      'Hooks into your coding CLI to inject identity, project facts, and memory at session start. No manual setup — your agents know who you are and what you\'re working on from the first message.',
    features: [
      'Hooks for Claude Code, Codex, Gemini CLI, and OpenCode',
      'Injects identity, soul, and project facts automatically',
      'Saves conversation exchanges before context compaction',
      'Zero-config after install — just works',
    ],
    install: 'npm install -g @dtoolkit/dcontext',
    code: `# Connect to dbrain and map projects
$ dcontext init
? dbrain URL: http://localhost:7878
? Map this directory to entity: my-app
✓ Connected to dbrain

# Install hooks for your CLI
$ dcontext install claude
✓ Hook added to .claude/settings.json

# Every new session now starts with:
## Session Context (from dbrain)
### Identity
- Name: Assistant
### Project: my-app
- [context] React 19 + Vite + Supabase
- [preference] Always use pnpm`,
  },
  {
    id: 'dproxy',
    name: 'dproxy',
    tagline: 'One CLI, any model',
    description:
      'Universal adapter for invoking models through local CLIs. Swap between Claude, Codex, Gemini, and OpenCode with a flag. Built-in context pipeline, templates, memory, and an HTTP API.',
    features: [
      'Single-shot (ask) and interactive (chat) modes',
      'HTTP API via serve command — integrate anywhere',
      'Context pipeline: memory + workspace + day log',
      'Template system for reusable prompts',
      '4 providers: Claude, Codex, Gemini, OpenCode',
    ],
    install: 'npm install -g @dtoolkit/dproxy',
    code: `# Ask any model from the terminal
$ dproxy "explain this error" --provider claude
→ The error occurs because...

# Pipe code for review
$ cat src/index.ts | dproxy "review this code"

# Interactive REPL
$ dproxy chat --provider gemini

# Start as HTTP API
$ dproxy serve --port 7880
✓ API ready on :7880

# Use from anywhere
$ curl localhost:7880/api/ask \\
  -d '{"prompt": "summarize changes"}'`,
  },
  {
    id: 'dwork',
    name: 'dwork',
    tagline: 'AI-native project manager',
    description:
      'Markdown files are the source of truth. Tasks, docs, roadmaps — all in plain text, indexed with FTS5, served via MCP. Your agents can create tasks, update status, and search across projects.',
    features: [
      'BACKLOG.md as kanban — parsed and indexed automatically',
      'Numbered docs with full-text search',
      'MCP tools: add_task, update_task, update_project, update_doc, search, what_to_do_next',
      'React dashboard with kanban board and file tree',
      'Sync across projects via dproxy',
    ],
    install: 'npm install -g @dtoolkit/dwork',
    code: `# Create and start project management
$ dwork init
? Project name: my-app
✓ BACKLOG.md scaffolded
$ dwork start
✓ API on :7881 — Dashboard on :7882

# Your agents manage the project (via MCP)
> add_task "Fix login redirect bug" --priority high
✓ Task TASK-042 added (status: todo)

> what_to_do_next
→ 1. Fix login redirect bug (high, todo)
  2. Add password reset flow (medium, todo)
  3. Write API docs (low, todo)`,
  },
];

function highlightLine(raw: string): { cls: string; text: string } {
  if (raw.startsWith('#')) return { cls: 'comment', text: raw };
  if (raw.startsWith('✓')) return { cls: 'output', text: raw };
  if (raw.startsWith('→')) return { cls: 'output', text: raw };
  if (raw.startsWith('?')) return { cls: 'output', text: raw };
  if (raw.startsWith('$') || raw.startsWith('>')) return { cls: 'command', text: raw };
  if (raw.trim() === '') return { cls: '', text: '' };
  return { cls: 'text-gray-300', text: raw };
}

function CommandLine({ text }: { text: string }) {
  const parts: JSX.Element[] = [];
  let rest = text;

  const promptMatch = rest.match(/^(\$|>)\s/);
  if (promptMatch) {
    parts.push(<span key="p" className="prompt">{promptMatch[0]}</span>);
    rest = rest.slice(promptMatch[0].length);
  }

  const tokens = rest.split(/("(?:[^"\\]|\\.)*")/g);
  tokens.forEach((token, i) => {
    if (token.startsWith('"') && token.endsWith('"')) {
      parts.push(<span key={`s${i}`} className="string">{token}</span>);
    } else {
      const flagTokens = token.split(/(--[\w-]+)/g);
      flagTokens.forEach((ft, j) => {
        if (ft.startsWith('--')) {
          parts.push(<span key={`f${i}-${j}`} className="flag">{ft}</span>);
        } else if (ft) {
          parts.push(<span key={`t${i}-${j}`}>{ft}</span>);
        }
      });
    }
  });

  return <>{parts}</>;
}

function CodeBlock({ code }: { code: string }) {
  const lines = code.split('\n');

  return (
    <div className="code-block text-[13px]">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-gray-500">terminal</span>
      </div>
      <pre className="whitespace-pre-wrap">
        {lines.map((raw, i) => {
          const { cls, text } = highlightLine(raw);
          if (!text && !raw.trim()) return <span key={i}>{'\n'}</span>;
          if (cls === 'command') {
            return (
              <span key={i}>
                <CommandLine text={text} />
                {'\n'}
              </span>
            );
          }
          return (
            <span key={i} className={cls}>
              {text}
              {'\n'}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export default function ProductTabs() {
  const [active, setActive] = useState('dbrain');
  const product = products.find((p) => p.id === active)!;

  return (
    <section id="products" className="py-24" style={{ background: 'var(--surface-2)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            Products that actually{' '}
            <span className="gradient-text">solve problems</span>
          </h2>
          <p className="mt-4 text-lg text-[var(--text-3)] max-w-2xl mx-auto">
            Four core products, each with a CLI, REST API, MCP server, and React dashboard.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active === p.id
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <div className="mb-1">
              <span className="font-mono text-sm text-brand-purple">@dtoolkit/{product.name}</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">{product.tagline}</h3>
            <p className="text-[var(--text-3)] leading-relaxed mb-6">{product.description}</p>

            <ul className="space-y-3 mb-8">
              {product.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-brand-purple mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-[var(--text-2)]">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="code-block !p-4">
              <code className="text-sm">
                <span className="prompt">$ </span>
                {product.install}
              </code>
            </div>
          </div>

          <CodeBlock code={product.code} />
        </div>
      </div>
    </section>
  );
}
