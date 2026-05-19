import { DBrainClient } from '@dtoolkit/sdk';

import type { Connection } from './config.js';

const TIMEOUT_MS = 5000;

const cache = new Map<string, DBrainClient>();

export function getConnection(connections: Connection[], name?: string): DBrainClient | null {
  const conn = name ? connections.find((c) => c.name === name) : connections[0];
  if (!conn) return null;

  const key = conn.url;
  let client = cache.get(key);
  if (!client) {
    client = new DBrainClient({ baseUrl: conn.url, token: conn.token, timeoutMs: TIMEOUT_MS });
    cache.set(key, client);
  }
  return client;
}

export function getAllConnections(
  connections: Connection[],
): Array<{ name: string; client: DBrainClient }> {
  return connections.map((c) => ({
    name: c.name,
    client: getConnection(connections, c.name) as DBrainClient,
  }));
}

export function clearCache(): void {
  cache.clear();
}
