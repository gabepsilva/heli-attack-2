import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, relPath), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('dev tooling quality gate (issue #2)', () => {
  it('exposes lint and typecheck scripts that cover app + vite config', () => {
    const pkg = readJson('package.json') as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lint).toBe('eslint .');
    expect(pkg.scripts.typecheck).toBe(
      'tsc --noEmit && tsc --noEmit -p tsconfig.node.json',
    );
    expect(pkg.scripts.dev).toBe('vite');
    expect(pkg.scripts.build).toContain('typecheck');
  });

  it('commits the hygiene files required by the ticket', () => {
    for (const rel of [
      '.editorconfig',
      'LICENSE',
      'tsconfig.json',
      'tsconfig.node.json',
      'eslint.config.js',
      '.prettierrc.json',
      '.githooks/pre-commit',
      'scripts/install-git-hooks.mjs',
    ]) {
      expect(existsSync(join(root, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it('typechecks vite.config.ts via tsconfig.node.json', () => {
    const nodeTsconfig = readJson('tsconfig.node.json') as {
      include: string[];
    };
    expect(nodeTsconfig.include).toEqual(
      expect.arrayContaining(['vite.config.ts']),
    );
  });

  it('catches a deliberately introduced type error (acceptance criterion)', () => {
    const result = spawnSync(
      'npx',
      [
        'tsc',
        '--noEmit',
        '-p',
        'scripts/fixtures/tsconfig.deliberate-error.json',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(
      /Type 'number' is not assignable to type 'string'/,
    );
  });

  it('passes a clean typecheck over app and node projects', () => {
    const result = spawnSync('npm', ['run', 'typecheck'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it('passes lint', () => {
    const result = spawnSync('npm', ['run', 'lint'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
