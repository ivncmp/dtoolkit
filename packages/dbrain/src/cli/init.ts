import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { Config } from '../core/config.js';
import { createDatabase } from '../core/db.js';

function generateToken(): string {
  return `sk-dbr_${randomBytes(24).toString('base64url')}`;
}

function defaultDataPath(): string {
  return join(homedir(), '.dbrain');
}

export async function init(pathArg?: string, flags?: { nonInteractive?: boolean }) {
  const nonInteractive = flags?.nonInteractive || process.env.DBRAIN_NON_INTERACTIVE === '1';

  if (nonInteractive) {
    return initNonInteractive(pathArg);
  }

  p.intro(pc.cyan('dbrain') + ' — Your distributed mind');

  const existingPath = resolve(pathArg || defaultDataPath());
  if (existsSync(join(existingPath, 'config.json'))) {
    p.log.info(`Brain already exists at ${pc.green(existingPath)}`);
    p.log.info(`To connect a client, run: ${pc.cyan('dbrain connect <url>')}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const answers = await p.group(
    {
      dataPath: () =>
        p.text({
          message: 'Where should the brain live?',
          initialValue: pathArg || defaultDataPath(),
          validate: (v) => (!v || v.length === 0 ? 'Path is required' : undefined),
        }),
      port: () =>
        p.text({
          message: 'API port?',
          initialValue: '7878',
          validate: (v) => {
            const n = parseInt(v ?? '', 10);
            if (isNaN(n) || n < 1 || n > 65535) return 'Invalid port';
          },
        }),
      host: () =>
        p.select({
          message: 'Bind address?',
          options: [
            { value: '0.0.0.0', label: '0.0.0.0 — All interfaces (accessible from network)' },
            { value: '127.0.0.1', label: '127.0.0.1 — Localhost only' },
          ],
          initialValue: '0.0.0.0',
        }),
      token: () =>
        p.text({
          message: 'Access token (leave default to auto-generate)',
          initialValue: generateToken(),
        }),
      agentName: () =>
        p.text({
          message: "What's my name? (your AI's identity)",
          initialValue: 'dBrain',
          validate: (v) => (!v || v.length === 0 ? 'Name is required' : undefined),
        }),
      ownerName: () =>
        p.text({
          message: 'And you are...? (your name)',
          validate: (v) => (!v || v.length === 0 ? 'Name is required' : undefined),
        }),
      ownerTimezone: () =>
        p.text({
          message: 'Your timezone',
          initialValue: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Init cancelled.');
        process.exit(0);
      },
    },
  );

  const dataPath = resolve(answers.dataPath.replace('~', homedir()));

  if (existsSync(join(dataPath, 'config.json'))) {
    p.log.info(`Brain already exists at ${pc.green(dataPath)}`);
    p.log.info(`To connect a client, run: ${pc.cyan('dbrain connect <url>')}`);
    p.outro(pc.green('Done.'));
    return;
  }

  const port = parseInt(answers.port, 10);

  const config: Config = {
    dataPath,
    port,
    host: answers.host as string,
    token: answers.token,
    tiers: { hotDays: 7, hotMinAccess: 10, warmDays: 30 },
  };

  const s = p.spinner();

  s.start('Creating data directory');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  s.stop('Config saved');

  s.start('Initializing database');
  const db = createDatabase(config);

  const now = new Date().toISOString();
  const insertDoc = db.prepare(
    'INSERT INTO documents (key, title, content, updated_at) VALUES (?, ?, ?, ?)',
  );

  insertDoc.run(
    'identity',
    'Identity',
    [
      `# Identity`,
      ``,
      `- **Name:** ${answers.agentName}`,
      `- **Created:** ${now.split('T')[0]}`,
    ].join('\n'),
    now,
  );

  insertDoc.run(
    'user',
    'User',
    [
      `# User`,
      ``,
      `- **Name:** ${answers.ownerName}`,
      `- **Timezone:** ${answers.ownerTimezone}`,
    ].join('\n'),
    now,
  );

  insertDoc.run(
    'soul',
    'Soul',
    [
      `# Soul`,
      ``,
      `Be genuinely helpful, not performatively helpful.`,
      `Have opinions. Be resourceful before asking.`,
      `Private things stay private. When in doubt, ask before acting externally.`,
    ].join('\n'),
    now,
  );

  insertDoc.run(
    'memory',
    'Memory',
    [`# Memory`, ``, `Narrative memory: reflections, decisions, learnings.`].join('\n'),
    now,
  );

  const insertEntity = db.prepare(
    'INSERT INTO entities (id, name, type, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const ownerId = (answers.ownerName as string).toLowerCase().replace(/\s+/g, '-');
  const agentId = (answers.agentName as string).toLowerCase().replace(/\s+/g, '-');
  insertEntity.run(ownerId, answers.ownerName, 'person', 'areas', now, now);
  insertEntity.run(agentId, answers.agentName, 'system', 'areas', now, now);

  db.close();
  s.stop(`Brain ready — I'm ${answers.agentName}, and I know ${answers.ownerName}`);

  p.note(
    [
      `Data:   ${pc.green(dataPath)}`,
      `Port:   ${pc.green(String(port))}`,
      `Host:   ${pc.green(config.host)}`,
      `Token:  ${pc.green(config.token)}`,
    ].join('\n'),
    'Configuration',
  );

  p.note(
    [
      `Start the server:`,
      `  ${pc.cyan('dbrain start')}`,
      ``,
      `Then connect clients:`,
      `  ${pc.cyan('dbrain connect http://localhost:' + port)}`,
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.green("Brain online. Wherever you go, I'll remember."));
}

function initNonInteractive(pathArg?: string) {
  const dataPath = resolve(pathArg || process.env.DBRAIN_DATA || defaultDataPath());
  const port = parseInt(process.env.DBRAIN_PORT || '7878', 10);
  const host = process.env.DBRAIN_HOST || '0.0.0.0';
  const token = process.env.DBRAIN_TOKEN || generateToken();
  const agentName = process.env.DBRAIN_AGENT_NAME || 'dBrain';
  const ownerName = process.env.DBRAIN_OWNER_NAME || 'Human';
  const ownerTimezone =
    process.env.DBRAIN_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (existsSync(join(dataPath, 'config.json'))) {
    console.log(`Config already exists at ${dataPath}, skipping init.`);
    return;
  }

  const config: Config = {
    dataPath,
    port,
    host,
    token,
    tiers: { hotDays: 7, hotMinAccess: 10, warmDays: 30 },
  };

  mkdirSync(dataPath, { recursive: true });
  writeFileSync(join(dataPath, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');

  const db = createDatabase(config);
  const now = new Date().toISOString();
  const insertDoc = db.prepare(
    'INSERT INTO documents (key, title, content, updated_at) VALUES (?, ?, ?, ?)',
  );

  insertDoc.run(
    'identity',
    'Identity',
    `# Identity\n\n- **Name:** ${agentName}\n- **Created:** ${now.split('T')[0]}`,
    now,
  );
  insertDoc.run(
    'user',
    'User',
    `# User\n\n- **Name:** ${ownerName}\n- **Timezone:** ${ownerTimezone}`,
    now,
  );
  insertDoc.run(
    'soul',
    'Soul',
    `# Soul\n\nBe genuinely helpful, not performatively helpful.\nHave opinions. Be resourceful before asking.\nPrivate things stay private. When in doubt, ask before acting externally.`,
    now,
  );
  insertDoc.run(
    'memory',
    'Memory',
    `# Memory\n\nNarrative memory: reflections, decisions, learnings.`,
    now,
  );

  const insertEntity = db.prepare(
    'INSERT INTO entities (id, name, type, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const ownerId = ownerName.toLowerCase().replace(/\s+/g, '-');
  const agentId = agentName.toLowerCase().replace(/\s+/g, '-');
  insertEntity.run(ownerId, ownerName, 'person', 'areas', now, now);
  insertEntity.run(agentId, agentName, 'system', 'areas', now, now);

  db.close();

  console.log(`Brain initialized at ${dataPath} (agent: ${agentName}, owner: ${ownerName})`);
  console.log(`Token: ${token}`);
  console.log(`Connect clients with: dbrain connect http://localhost:${port}`);
}
