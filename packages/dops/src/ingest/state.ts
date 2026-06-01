import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { IngestState } from '@dtoolkit/core';

const STATE_PATH = join(homedir(), '.dops', 'ingest-state.json');

export function loadState(): IngestState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as IngestState;
    }
  } catch {
    // corrupted state, start fresh
  }
  return { sessions: {} };
}

export function saveState(state: IngestState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}
