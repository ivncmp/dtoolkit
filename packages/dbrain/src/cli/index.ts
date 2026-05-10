#!/usr/bin/env node

import { argv } from 'node:process';

const command = argv[2];

async function main() {
  switch (command) {
    case 'init': {
      const { init } = await import('./init.js');
      const nonInteractive = argv.includes('--non-interactive');
      const pathArg = argv.slice(3).find((a) => !a.startsWith('--'));
      await init(pathArg, { nonInteractive });
      break;
    }
    case 'start': {
      const { start } = await import('./start.js');
      await start(argv[3]);
      break;
    }
    case 'connect': {
      const { connect } = await import('./connect.js');
      const connectArgs = argv.slice(3).filter((a) => !a.startsWith('--'));
      const tokenFlag = argv.find((a) => a.startsWith('--token='))?.split('=')[1];
      await connect(connectArgs[0], connectArgs[1], tokenFlag);
      break;
    }
    case 'status': {
      const { status } = await import('./status.js');
      await status(argv[3]);
      break;
    }
    default:
      console.log(`
dbrain — Your distributed mind. Wherever you go, I remember.

Usage:
  dbrain init [path]                 Initialize a new brain (server)
  dbrain start [path]                Wake up
  dbrain connect <client> [url] [--token=]    Connect a client to a brain
      clients: claude, opencode
  dbrain status [path]               Check brain status
`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
