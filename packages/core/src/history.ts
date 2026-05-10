export interface HistoryEntry {
  id: string;
  timestamp: string;
  prompt: string;
  result: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  model?: string;
  templateUsed?: string;
}

export interface SessionInfo {
  sessionId: string;
  startedAt: string;
  name?: string;
}
