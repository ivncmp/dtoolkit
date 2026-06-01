import { hostname } from 'node:os';

import { createClaudeTelemetry } from '@dtoolkit/adapter-claude';
import { createCodexTelemetry } from '@dtoolkit/adapter-codex';
import { createGeminiTelemetry } from '@dtoolkit/adapter-gemini';
import { createOpenCodeTelemetry } from '@dtoolkit/adapter-opencode';
import type { TelemetryExtractor } from '@dtoolkit/core';
import pc from 'picocolors';

import type { DopsClientConfig } from '../ingest/client.js';
import { pushSession } from '../ingest/client.js';
import { loadState, saveState } from '../ingest/state.js';

const EXTRACTORS: Record<string, () => TelemetryExtractor> = {
  claude: createClaudeTelemetry,
  codex: createCodexTelemetry,
  gemini: createGeminiTelemetry,
  opencode: createOpenCodeTelemetry,
};

export async function ingest(opts: {
  url: string;
  token: string;
  days: number;
  dryRun?: boolean;
  sources?: string[];
}) {
  const since = new Date();
  since.setDate(since.getDate() - opts.days);

  const config: DopsClientConfig = { url: opts.url, token: opts.token };
  const machine = hostname();

  console.log(
    `${pc.cyan('dops ingest')} — scanning last ${opts.days} days (since ${since.toISOString().slice(0, 10)}) from ${pc.green(machine)}`,
  );
  if (opts.dryRun) {
    console.log(pc.dim('  Dry run — no data will be sent'));
  }

  const state = loadState();
  const enabledSources = opts.sources ?? Object.keys(EXTRACTORS);

  const allSessions: Array<{ source: string; sessions: ReturnType<TelemetryExtractor['scan']> }> =
    [];

  for (const source of enabledSources) {
    const factory = EXTRACTORS[source];
    if (!factory) {
      console.log(`  ${pc.red('?')} Unknown source: ${source}`);
      continue;
    }

    try {
      const extractor = factory();
      const sessions = extractor.scan(state, since);
      allSessions.push({ source, sessions });
      const tokens = sessions.reduce((sum, s) => sum + s.token_usage.length, 0);
      const tools = sessions.reduce((sum, s) => sum + s.tool_calls.length, 0);
      console.log(
        `  ${pc.green('✓')} ${source.padEnd(10)} ${sessions.length} sessions, ${tokens} token records, ${tools} tool calls`,
      );
    } catch (err) {
      console.log(`  ${pc.red('✗')} ${source.padEnd(10)} ${(err as Error).message}`);
    }
  }

  const totalSessions = allSessions.reduce((sum, s) => sum + s.sessions.length, 0);

  if (totalSessions === 0) {
    console.log(pc.dim('\nNo new sessions to ingest.'));
    return;
  }

  console.log(`\n  Total: ${pc.bold(String(totalSessions))} sessions to push`);

  if (opts.dryRun) {
    console.log(pc.dim('\nDry run complete. Use without --dry-run to push data.'));
    return;
  }

  let pushed = 0;
  let failed = 0;

  for (const { sessions } of allSessions) {
    for (const session of sessions) {
      session.source = `${session.source}@${machine}`;
      try {
        await pushSession(config, session);
        pushed++;
      } catch (err) {
        failed++;
        console.log(`  ${pc.red('✗')} ${session.id}: ${(err as Error).message}`);
      }
    }
  }

  saveState(state);

  console.log(
    `\n${pc.green('Done.')} Pushed ${pushed} sessions${failed > 0 ? `, ${pc.red(String(failed))} failed` : ''}.`,
  );
}
