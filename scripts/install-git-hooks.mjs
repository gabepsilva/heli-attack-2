#!/usr/bin/env node
/**
 * Optional local quality gate: point git at .githooks/ so pre-commit runs
 * lint + typecheck. No-ops outside a git checkout (e.g. npm pack / CI cache).
 *
 * Skips when HELI_SKIP_GIT_HOOKS=1. Does not overwrite an existing hooksPath
 * unless it is already .githooks.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooksDir = join(root, '.githooks');

if (process.env.HELI_SKIP_GIT_HOOKS === '1') {
  process.exit(0);
}

if (!existsSync(join(root, '.git')) || !existsSync(hooksDir)) {
  process.exit(0);
}

const existing = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
  cwd: root,
  encoding: 'utf8',
});

const current = existing.status === 0 ? existing.stdout.trim() : '';

if (current && current !== '.githooks') {
  process.exit(0);
}

if (current === '.githooks') {
  process.exit(0);
}

spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  encoding: 'utf8',
});

console.log(
  'Installed optional git hooks → .githooks/ (lint + typecheck on commit)',
);

// prepare must not fail npm install when git is missing or config write fails.
process.exit(0);
