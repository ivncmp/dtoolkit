export interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Target {
  readonly name: string;
  install(): Promise<void>;
  uninstall(): Promise<void>;
  isInstalled(): Promise<boolean>;
  parseTranscript(path: string): Promise<TranscriptEntry[]>;
  resolveTranscriptPath(sessionId: string, cwd: string): string;
  detectFromEnv(env: Record<string, string | undefined>): boolean;
  getSessionId(
    env: Record<string, string | undefined>,
    input: Record<string, unknown>,
  ): string | undefined;
}

export const DBRAIN_START = "<!-- dbrain:start -->";
export const DBRAIN_END = "<!-- dbrain:end -->";
export const DCONTEXT_MARKER = "<!-- dcontext:active -->";

export const DBRAIN_DCONTEXT_SECTION = `# dbrain

You have an AI brain connected via MCP (dbrain). Your identity, soul, user profile, and project facts are **automatically injected at session start** by dcontext — you already have them in your context under "Session Context (from dbrain)".

## Tools

- \`recall\` — Search the brain. **Only use when the user asks about something NOT already in your Session Context.** Do not call at session start — your context is already loaded.
- \`remember\` — Save important facts. Decisions, preferences, personal details, milestones. One atomic fact per call. Use proactively across ALL projects.
- \`log\` — Store conversation messages at natural breakpoints (end of task, before user leaves, every few exchanges).
- \`get_entity\` — Full context about a specific entity.
- \`list_entities\` — List entities by category or type.
- \`create_entity\` — Create new entity, then \`remember\` facts about it.
- \`bump\` — Touch a memory to keep it hot.
- \`overview\` — Brain stats.

## Rules

- Do NOT call \`recall\` or \`wake_up\` at session start. Your context is already loaded by dcontext.
- Use \`recall\` only mid-conversation when the user asks about something not in the injected context.
- Never say "I don't know" about the user without searching first.
- When storing facts, be specific and atomic. "Favorite ice cream is pistachio" not "We talked about food preferences".
- Use \`remember\` proactively. Decisions, milestones, preferences, people, learnings — if it's worth remembering, store it.`;

export function writeDcontextMdSection(
  existingContent: string,
): string {
  const section = `${DBRAIN_START}\n${DCONTEXT_MARKER}\n${DBRAIN_DCONTEXT_SECTION}\n${DBRAIN_END}`;

  if (!existingContent.trim()) return section.trim() + "\n";

  const startIdx = existingContent.indexOf(DBRAIN_START);
  const endIdx = existingContent.indexOf(DBRAIN_END);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = existingContent.slice(0, startIdx).trimEnd();
    const after = existingContent.slice(endIdx + DBRAIN_END.length).trimStart();
    const parts = [before, section, after].filter(Boolean);
    return parts.join("\n\n").trim() + "\n";
  }

  return (section + "\n\n" + existingContent.trim()).trim() + "\n";
}

export function removeDcontextMdSection(
  existingContent: string,
): string | null {
  if (!existingContent.includes(DCONTEXT_MARKER)) return null;

  const startIdx = existingContent.indexOf(DBRAIN_START);
  const endIdx = existingContent.indexOf(DBRAIN_END);
  if (startIdx === -1 || endIdx === -1) return null;

  const before = existingContent.slice(0, startIdx).trimEnd();
  const after = existingContent.slice(endIdx + DBRAIN_END.length).trimStart();
  return [before, after].filter(Boolean).join("\n\n").trim() + "\n";
}
