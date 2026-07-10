import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_PLAYER_FINAL_SCALE, ATLAS_KEY } from '../config/art';
import { PLAYER } from '../config/constants';
import {
  atlasLoadPaths,
  expectedFrameIds,
  validateAtlasManifest,
  type AtlasJson,
} from './atlasManifest';
import { renderArtSpecMarkdown } from './artSpec';
import { SPRITE_DEFS, getSpriteDef, textureSize } from './catalog';

function loadCommittedAtlas(): AtlasJson {
  const path = resolve(
    import.meta.dirname,
    '../../public/atlas/game-atlas.json',
  );
  return JSON.parse(readFileSync(path, 'utf8')) as AtlasJson;
}

describe('committed atlas manifest (issue #32/#33 — scene renders via atlas)', () => {
  it('exposes load paths for Phaser load.atlas', () => {
    expect(atlasLoadPaths()).toEqual({
      key: ATLAS_KEY,
      imagePath: 'atlas/game-atlas.png',
      jsonPath: 'atlas/game-atlas.json',
    });
  });

  it('includes every catalog frame at documented texture size with pivots', () => {
    const json = loadCommittedAtlas();
    const report = validateAtlasManifest(json);

    expect(report.missing).toEqual([]);
    expect(report.unexpected).toEqual([]);
    expect(report.sizeMismatches).toEqual([]);
    expect(report.pivotMismatches).toEqual([]);
    expect(report.ok).toBe(true);

    expect(expectedFrameIds()).toEqual(SPRITE_DEFS.map((s) => s.id));
    expect(json.meta.image).toBe('game-atlas.png');
    expect(json.meta.size.w).toBeGreaterThan(0);
    expect(json.meta.size.h).toBeGreaterThan(0);

    const idle = json.frames.player_idle!;
    expect(idle.frame.w).toBe(24 * ART_PLAYER_FINAL_SCALE);
    expect(idle.frame.h).toBe(49 * ART_PLAYER_FINAL_SCALE);
    expect(idle.pivot).toEqual({ x: 0.5, y: 1 });

    const death = json.frames.player_death!;
    expect(death.frame.w).toBe(40 * ART_PLAYER_FINAL_SCALE);
    expect(death.frame.h).toBe(49 * ART_PLAYER_FINAL_SCALE);
  });

  it('ships a PNG atlas next to the JSON', () => {
    const pngPath = resolve(
      import.meta.dirname,
      '../../public/atlas/game-atlas.png',
    );
    const buf = readFileSync(pngPath);
    // PNG signature
    expect([...buf.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });
});

describe('ART-SPEC.md (issue #32/#33 — documented working process)', () => {
  it('documents every sprite dimension, pivot, and add-sprite steps', () => {
    const md = renderArtSpecMarkdown();
    const committed = readFileSync(
      resolve(import.meta.dirname, '../../docs/ART-SPEC.md'),
      'utf8',
    );

    expect(committed).toBe(md);

    for (const def of SPRITE_DEFS) {
      const tex = textureSize(def);
      expect(md).toContain(`\`${def.id}\``);
      expect(md).toContain(`\`${def.sourceFile}\``);
      expect(md).toContain(`${def.originalW}×${def.originalH}`);
      expect(md).toContain(`${tex.w}×${tex.h}`);
      expect(md).toContain(`(${def.pivot.x}, ${def.pivot.y})`);
    }

    expect(md).toContain('Adding a new sprite');
    expect(md).toContain('npm run art:pack');
    expect(md).toContain('npm run art:player');
    expect(md).toContain(`**${PLAYER.spriteW}×${PLAYER.spriteH}**`);
    expect(md).toContain(getSpriteDef('player_duck').role);
    expect(md).toContain('player_hurt');
    expect(md).toContain('player_death');
    expect(md).toContain('final hi-res');
  });
});
