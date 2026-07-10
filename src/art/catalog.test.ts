import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ART_WORLD_FINAL_DIR,
  ART_WORLD_FINAL_SCALE,
  ATLAS_KEY,
  ATLAS_IMAGE_PATH,
  ATLAS_JSON_PATH,
  ATLAS_PADDING,
  ATLAS_MAX_SIZE,
  BG_IMAGE_PATH,
  BG_ORIGINAL_H,
  BG_ORIGINAL_W,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import {
  HELI_LOOK_FRAMES,
  PLAYER_ANIM_FRAMES,
  PLAYER_FINAL_FRAME_IDS,
  SPRITE_DEFS,
  WORLD_FINAL_FRAME_IDS,
  catalogHasNoPlaceholders,
  finalSourcePath,
  gameDrawSize,
  getSpriteDef,
  heliFrameForLook,
  isFinalSprite,
  isSpriteId,
  textureSize,
} from './catalog';

function pngSize(abs: string): { w: number; h: number } {
  const buf = readFileSync(abs);
  expect([...buf.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const w = (buf[16]! << 24) | (buf[17]! << 16) | (buf[18]! << 8) | buf[19]!;
  const h = (buf[20]! << 24) | (buf[21]! << 16) | (buf[22]! << 8) | buf[23]!;
  return { w, h };
}

describe('art catalog (issue #32 / #33 / #34 acceptance)', () => {
  it('documents exact Flash-era original sizes from the art bible', () => {
    expect(getSpriteDef('player_idle')).toMatchObject({
      sourceFile: 'player_idle.png',
      originalW: 24,
      originalH: 49,
      pivot: { x: 0.5, y: 1 },
      final: true,
    });
    expect(getSpriteDef('heli')).toMatchObject({
      originalW: 212,
      originalH: 106,
      pivot: { x: 0.5, y: 0.5 },
      final: true,
    });
    expect(getSpriteDef('heli_strafe')).toMatchObject({
      originalW: 212,
      originalH: 106,
      final: true,
    });
    expect(getSpriteDef('explosion')).toMatchObject({
      originalW: 187,
      originalH: 186,
      pivot: { x: 0.5, y: 0.5 },
      final: true,
    });
    expect(getSpriteDef('muzzle_flash')).toMatchObject({
      originalW: 16,
      originalH: 16,
      final: true,
    });
    expect(getSpriteDef('tile_floor')).toMatchObject({
      originalW: 52,
      originalH: 52,
      pivot: { x: 0, y: 0 },
      final: true,
    });
  });

  it('AC: no placeholders remain — every catalog sprite is final', () => {
    expect(catalogHasNoPlaceholders()).toBe(true);
    for (const def of SPRITE_DEFS) {
      expect(isFinalSprite(def), def.id).toBe(true);
    }
  });

  it('sizes final player textures at ART_PLAYER_FINAL_SCALE (8×) — crisp 1080p', () => {
    expect(ART_PLAYER_FINAL_SCALE).toBe(8);
    expect(ART_PLAYER_FINAL_DIR).toBe('art/player');
    const idle = textureSize(getSpriteDef('player_idle'));
    expect(idle).toEqual({ w: 192, h: 392 });
    const death = textureSize(getSpriteDef('player_death'));
    expect(death).toEqual({ w: 320, h: 392 });
  });

  it('sizes final world textures at ART_WORLD_FINAL_SCALE (4×) — crisp 1080p', () => {
    expect(ART_WORLD_FINAL_SCALE).toBe(4);
    expect(ART_WORLD_FINAL_DIR).toBe('art/world');
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    expect(textureSize(getSpriteDef('heli'))).toEqual({ w: 848, h: 424 });
    expect(textureSize(getSpriteDef('heli_strafe'))).toEqual({
      w: 848,
      h: 424,
    });
    expect(textureSize(getSpriteDef('explosion'))).toEqual({
      w: 748,
      h: 744,
    });
    expect(textureSize(getSpriteDef('muzzle_flash'))).toEqual({
      w: 64,
      h: 64,
    });
    expect(textureSize(getSpriteDef('weapon_machinegun'))).toEqual({
      w: 116,
      h: 64,
    });
    expect(textureSize(getSpriteDef('tile_floor'))).toEqual({
      w: 208,
      h: 208,
    });
  });

  it('ships committed final PNGs for every catalog frame (AC: no placeholders)', () => {
    for (const def of SPRITE_DEFS) {
      const rel = finalSourcePath(def);
      const abs = resolve(import.meta.dirname, '../..', rel);
      expect(existsSync(abs), `missing ${rel}`).toBe(true);
      const tex = textureSize(def);
      expect(pngSize(abs)).toEqual({ w: tex.w, h: tex.h });
    }
  });

  it('ships committed background plate at Flash bg.png × world final scale', () => {
    expect(BG_ORIGINAL_W).toBe(452);
    expect(BG_ORIGINAL_H).toBe(322);
    const src = resolve(
      import.meta.dirname,
      '../..',
      ART_WORLD_FINAL_DIR,
      'bg.png',
    );
    const pub = resolve(import.meta.dirname, '../..', 'public', BG_IMAGE_PATH);
    expect(existsSync(src), `missing ${ART_WORLD_FINAL_DIR}/bg.png`).toBe(true);
    expect(existsSync(pub), `missing public/${BG_IMAGE_PATH}`).toBe(true);
    const expected = {
      w: BG_ORIGINAL_W * ART_WORLD_FINAL_SCALE,
      h: BG_ORIGINAL_H * ART_WORLD_FINAL_SCALE,
    };
    expect(pngSize(src)).toEqual(expected);
    expect(pngSize(pub)).toEqual(expected);
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

  it('maps heli looks 0/1 to distinct final frames (#20/#34)', () => {
    expect(HELI_LOOK_FRAMES).toEqual(['heli', 'heli_strafe']);
    expect(heliFrameForLook(0)).toBe('heli');
    expect(heliFrameForLook(1)).toBe('heli_strafe');
    expect(WORLD_FINAL_FRAME_IDS).toContain('heli_strafe');
    expect(WORLD_FINAL_FRAME_IDS).toContain('explosion');
    expect(WORLD_FINAL_FRAME_IDS).toContain('muzzle_flash');
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
      expect(src).toContain(`final: true`);
    }
    expect(src).toContain(`PLACEHOLDER_SCALE = ${ART_PLACEHOLDER_SCALE}`);
    expect(src).toContain(`PLAYER_FINAL_SCALE = ${ART_PLAYER_FINAL_SCALE}`);
    expect(src).toContain(`WORLD_FINAL_SCALE = ${ART_WORLD_FINAL_SCALE}`);
    expect(src).toContain(`ATLAS_PADDING = ${ATLAS_PADDING}`);
    expect(src).toContain(`ATLAS_MAX_SIZE = ${ATLAS_MAX_SIZE}`);
  });

  it('rejects unknown sprite ids', () => {
    expect(isSpriteId('player_idle')).toBe(true);
    expect(isSpriteId('nope')).toBe(false);
    expect(() => getSpriteDef('nope' as never)).toThrow(/Unknown sprite id/);
  });
});
