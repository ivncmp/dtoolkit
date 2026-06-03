#!/usr/bin/env node

/**
 * Publish script that guarantees pnpm is used (resolves workspace:*).
 * Replaces `changeset publish` which sometimes falls back to npm.
 *
 * Steps:
 * 1. Find packages with versions not yet on the registry
 * 2. Publish each with `pnpm publish`
 * 3. Create git tags (so changesets/action can create GitHub Releases)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const packagesDir = join(import.meta.dirname, '..', 'packages');
const published = [];

for (const dir of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    continue;
  }
  if (pkg.private || !pkg.name || !pkg.version) continue;

  const npmVersion = (() => {
    try {
      return execSync(`npm view ${pkg.name}@${pkg.version} version 2>/dev/null`, {
        stdio: 'pipe',
      })
        .toString()
        .trim();
    } catch {
      return '';
    }
  })();

  if (npmVersion === pkg.version) {
    console.log(`  skip ${pkg.name}@${pkg.version} (already published)`);
    continue;
  }

  console.log(`  publish ${pkg.name}@${pkg.version}`);
  try {
    execSync('pnpm publish --access public --no-git-checks', {
      cwd: join(packagesDir, dir),
      stdio: 'inherit',
    });
    published.push({ name: pkg.name, version: pkg.version });
  } catch (err) {
    console.error(`  FAILED ${pkg.name}@${pkg.version}`);
    process.exit(1);
  }
}

for (const { name, version } of published) {
  const tag = `${name}@${version}`;
  try {
    execSync(`git tag ${tag}`, { stdio: 'pipe' });
    console.log(`  tag ${tag}`);
  } catch {
    // tag already exists
  }
}

if (published.length) {
  console.log(`\nPublished ${published.length} package(s)`);
} else {
  console.log('\nNo new versions to publish');
}
