import type Database from 'better-sqlite3';

import type { Config } from '../core/config.js';

export interface SyncResult {
  success: boolean;
  message: string;
}

export function syncProject(_db: Database.Database, config: Config, _slug: string): SyncResult {
  if (!config.dproxy) {
    return {
      success: false,
      message: 'dproxy not configured. Add dproxy settings to config.json or run dwork configure.',
    };
  }

  // Stub — real implementation in phase 2 via DProxyClient
  return {
    success: false,
    message: 'Sync via dproxy is not yet implemented. Coming in a future release.',
  };
}
