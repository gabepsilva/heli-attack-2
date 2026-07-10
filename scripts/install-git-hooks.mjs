#!/usr/bin/env node
/**
 * Optional local quality gate: point git at .githooks/ so pre-commit runs
 * lint + typecheck. No-ops outside a git checkout (e.g. npm pack / CI cache).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooksDir = join(root, '.githooks');

if (!existsSync(join(root, '.git')) || !existsSync(hooksDir)) {
  process.exit(0);
}

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'ignore',
});

process.exit(result.status === 0 ? 0 : 0);
