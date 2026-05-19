import type Database from 'better-sqlite3';

import type { Config } from './core/config.js';

export interface BrainUser {
  userId: string;
  userName: string;
  permissions: 'read' | 'write' | 'read+write';
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
    config: Config;
  }
  interface FastifyRequest {
    brainUser?: BrainUser;
  }
}
