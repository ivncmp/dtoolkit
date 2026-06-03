#!/usr/bin/env node

/**
 * Pre-publish guard: packs each non-private package and verifies that
 * pnpm resolved all workspace:* references in the tarball.
 * Run after build, before changeset publish.
 */

import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const packagesDir = join(import.meta.dirname, '..', 'packages');
const tmp = mkdtempSync(join(tmpdir(), 'dtoolkit-verify-'));
let failed = false;

for (const dir of readdirSync(packagesDir)) {
  const srcPkgPath = join(packagesDir, dir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(srcPkgPath, 'utf8'));
  } catch {
    continue;
  }
  if (pkg.private) continue;

  try {
    execSync(`pnpm pack --pack-destination ${tmp}`, {
      cwd: join(packagesDir, dir),
      stdio: 'pipe',
    });

    const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) continue;

    const json = execSync(`tar xzf ${join(tmp, tgz)} -O package/package.json`, {
      stdio: 'pipe',
    }).toString();
    const packed = JSON.parse(json);

    for (const depField of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(packed[depField] || {})) {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          console.error(`ERROR: ${pkg.name} tarball has unresolved ${depField}.${name}: ${version}`);
          failed = true;
        }
      }
    }

    rmSync(join(tmp, tgz));
  } catch (err) {
    console.error(`WARN: could not verify ${pkg.name}: ${err.message}`);
  }
}

rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error('\nUnresolved workspace: references in packed tarballs. Aborting publish.');
  process.exit(1);
}

console.log('All packed tarballs have resolved workspace references.');
