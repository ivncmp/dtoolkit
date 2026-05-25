import type Database from 'better-sqlite3';

import type { Config } from './core/config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
    config: Config;
  }

  interface FastifyRequest {
    dworkUser?: {
      userId: string;
      userName: string;
      permissions: string;
    };
  }
}
