import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
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
  it('routes build through typecheck so both projects are checked', () => {
    const pkg = readJson('package.json') as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toContain('typecheck');
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
    const probePath = join(root, 'src', '__typecheck-probe.ts');
    try {
      writeFileSync(probePath, 'const x: string = 123;\n');
      const result = spawnSync('npm', ['run', 'typecheck'], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(
        /Type 'number' is not assignable to type 'string'/,
      );
    } finally {
      if (existsSync(probePath)) {
        unlinkSync(probePath);
      }
    }
  });
});
