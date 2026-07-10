import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ATLAS_KEY,
  ATLAS_IMAGE_PATH,
  ATLAS_JSON_PATH,
  ATLAS_PADDING,
  ATLAS_MAX_SIZE,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import {
  PLAYER_ANIM_FRAMES,
  PLAYER_FINAL_FRAME_IDS,
  SPRITE_DEFS,
  finalPlayerSourcePath,
  gameDrawSize,
  getSpriteDef,
  isFinalSprite,
  isSpriteId,
  textureSize,
} from './catalog';

describe('art catalog (issue #32 / #33 acceptance)', () => {
  it('documents exact Flash-era original sizes from the art bible', () => {
    expect(getSpriteDef('player_idle')).toMatchObject({
      sourceFile: 'player_idle.png',
      originalW: 24,
      originalH: 49,
      pivot: { x: 0.5, y: 1 },
      final: true,
    });
    expect(getSpriteDef('player_duck')).toMatchObject({
      sourceFile: 'player_duck.png',
      originalW: 25,
      originalH: 39,
      final: true,
    });
    expect(getSpriteDef('player_death')).toMatchObject({
      originalW: 40,
      originalH: 49,
      final: true,
    });
    expect(getSpriteDef('heli')).toMatchObject({
      originalW: 212,
      originalH: 106,
      pivot: { x: 0.5, y: 0.5 },
    });
    expect(getSpriteDef('tile_floor')).toMatchObject({
      originalW: 52,
      originalH: 52,
      pivot: { x: 0, y: 0 },
    });
  });

  it('upscales non-player placeholders by ART_PLACEHOLDER_SCALE (4×)', () => {
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    const heli = textureSize(getSpriteDef('heli'));
    expect(heli).toEqual({ w: 848, h: 424 });
    expect(isFinalSprite(getSpriteDef('heli'))).toBe(false);
  });

  it('sizes final player textures at ART_PLAYER_FINAL_SCALE (8×) — crisp 1080p', () => {
    expect(ART_PLAYER_FINAL_SCALE).toBe(8);
    expect(ART_PLAYER_FINAL_DIR).toBe('art/player');
    const idle = textureSize(getSpriteDef('player_idle'));
    expect(idle).toEqual({ w: 192, h: 392 });
    const death = textureSize(getSpriteDef('player_death'));
    expect(death).toEqual({ w: 320, h: 392 });
    for (const id of PLAYER_FINAL_FRAME_IDS) {
      expect(isFinalSprite(getSpriteDef(id))).toBe(true);
    }
  });

  it('ships committed final player PNGs (no placeholder player remains)', () => {
    for (const id of PLAYER_FINAL_FRAME_IDS) {
      const def = getSpriteDef(id);
      const rel = finalPlayerSourcePath(def);
      const abs = resolve(import.meta.dirname, '../..', rel);
      expect(existsSync(abs), `missing ${rel}`).toBe(true);
      const tex = textureSize(def);
      // PNG signature
      const buf = readFileSync(abs);
      expect([...buf.subarray(0, 8)]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      // File must match catalog texture size (identify via IHDR).
      const w =
        (buf[16]! << 24) | (buf[17]! << 16) | (buf[18]! << 8) | buf[19]!;
      const h =
        (buf[20]! << 24) | (buf[21]! << 16) | (buf[22]! << 8) | buf[23]!;
      expect({ id, w, h }).toEqual({ id, w: tex.w, h: tex.h });
    }
  });

  it('maps player frames to the spec 48×48 sprite box', () => {
    expect(PLAYER.spriteW).toBe(48);
    expect(PLAYER.spriteH).toBe(48);
    for (const id of PLAYER_FINAL_FRAME_IDS) {
      expect(gameDrawSize(getSpriteDef(id))).toEqual({ w: 48, h: 48 });
    }
  });

  it('maps floor tiles to WORLD.tile (50px)', () => {
    expect(WORLD.tile).toBe(50);
    expect(gameDrawSize(getSpriteDef('tile_floor'))).toEqual({
      w: 50,
      h: 50,
    });
  });

  it('lists every player animation frame for Flash states + hurt/death', () => {
    expect(PLAYER_ANIM_FRAMES).toEqual({
      idle: 'player_idle',
      duck: 'player_duck',
      jump: 'player_jump',
      jump2: 'player_jump2',
      walk: ['player_step1', 'player_step2'],
      hurt: 'player_hurt',
      death: 'player_death',
    });
    expect(PLAYER_FINAL_FRAME_IDS).toEqual([
      'player_idle',
      'player_duck',
      'player_jump',
      'player_jump2',
      'player_step1',
      'player_step2',
      'player_hurt',
      'player_death',
    ]);
  });

  it('exposes atlas load paths under public/atlas/', () => {
    expect(ATLAS_KEY).toBe('game-atlas');
    expect(ATLAS_IMAGE_PATH).toBe('atlas/game-atlas.png');
    expect(ATLAS_JSON_PATH).toBe('atlas/game-atlas.json');
  });

  it('keeps packer script catalog in parity with TypeScript SPRITE_DEFS', () => {
    const scriptPath = resolve(
      import.meta.dirname,
      '../../scripts/art/pack-atlas.mjs',
    );
    const src = readFileSync(scriptPath, 'utf8');
    for (const def of SPRITE_DEFS) {
      expect(src).toContain(`id: '${def.id}'`);
      expect(src).toContain(`sourceFile: '${def.sourceFile}'`);
      expect(src).toContain(`originalW: ${def.originalW}`);
      expect(src).toContain(`originalH: ${def.originalH}`);
      if (isFinalSprite(def)) {
        expect(src).toContain(`final: true`);
      }
    }
    expect(src).toContain(`PLACEHOLDER_SCALE = ${ART_PLACEHOLDER_SCALE}`);
    expect(src).toContain(`PLAYER_FINAL_SCALE = ${ART_PLAYER_FINAL_SCALE}`);
    expect(src).toContain(`ATLAS_PADDING = ${ATLAS_PADDING}`);
    expect(src).toContain(`ATLAS_MAX_SIZE = ${ATLAS_MAX_SIZE}`);
  });

  it('rejects unknown sprite ids', () => {
    expect(isSpriteId('player_idle')).toBe(true);
    expect(isSpriteId('nope')).toBe(false);
    expect(() => getSpriteDef('nope' as never)).toThrow(/Unknown sprite id/);
  });
});
