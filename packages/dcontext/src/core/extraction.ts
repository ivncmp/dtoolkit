import type { Target, TranscriptEntry } from '@dtoolkit/core';
import { DBrainClient } from '@dtoolkit/sdk';

import type { DcontextConfig } from './config.js';
import { logError, updateStats } from './config.js';

export async function extractAndSave(
  sessionId: string,
  target: Target,
  cwd: string,
  config: DcontextConfig,
): Promise<string | null> {
  const transcriptPath = target.resolveTranscriptPath(sessionId, cwd);
  let entries: TranscriptEntry[];
  try {
    entries = await target.parseTranscript(transcriptPath);
  } catch (err) {
    await logError(`Failed to parse transcript: ${(err as Error).message}`);
    return null;
  }

  const filtered = entries.filter((e) => e.content.length >= 50);
  if (filtered.length === 0) return null;

  const messages = filtered.map((e) => ({ role: e.role, content: e.content }));

  try {
    const client = new DBrainClient(config.dbrain.url, config.dbrain.token);
    const conv = await client.startConversation(`dcontext-${target.name}`);
    await client.sendMessages(conv.id, messages);
  } catch (err) {
    await logError(`Failed to save to dbrain: ${(err as Error).message}`);
  }

  await updateStats((stats) => {
    stats.extractions.total++;
    stats.extractions.lastAt = new Date().toISOString();
    stats.extractions.messagesSaved += messages.length;
    if (!stats.byTarget[target.name]) {
      stats.byTarget[target.name] = { briefings: 0, extractions: 0 };
    }
    stats.byTarget[target.name].extractions++;
  });

  return `Session log saved to dbrain (${messages.length} messages from ${target.name})`;
}
