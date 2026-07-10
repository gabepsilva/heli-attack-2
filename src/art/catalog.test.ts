import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ATLAS_KEY,
  ATLAS_IMAGE_PATH,
  ATLAS_JSON_PATH,
  ATLAS_PADDING,
  ATLAS_MAX_SIZE,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import {
  PLAYER_ANIM_FRAMES,
  PLAYER_PLACEHOLDER_FRAME,
  SPRITE_DEFS,
  gameDrawSize,
  getSpriteDef,
  isSpriteId,
  textureSize,
} from './catalog';

describe('art catalog (issue #32 acceptance)', () => {
  it('documents exact Flash-era original sizes from the art bible', () => {
    expect(getSpriteDef('player_idle')).toMatchObject({
      sourceFile: 'guy.png',
      originalW: 24,
      originalH: 49,
      pivot: { x: 0.5, y: 1 },
    });
    expect(getSpriteDef('player_duck')).toMatchObject({
      sourceFile: 'duck.png',
      originalW: 25,
      originalH: 39,
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

  it('upscales placeholders by ART_PLACEHOLDER_SCALE (4×)', () => {
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    const idle = textureSize(getSpriteDef('player_idle'));
    expect(idle).toEqual({ w: 96, h: 196 });
    const heli = textureSize(getSpriteDef('heli'));
    expect(heli).toEqual({ w: 848, h: 424 });
  });

  it('maps player frames to the spec 48×48 sprite box', () => {
    expect(PLAYER.spriteW).toBe(48);
    expect(PLAYER.spriteH).toBe(48);
    for (const id of [
      'player_idle',
      'player_duck',
      'player_jump',
      'player_jump2',
      'player_step1',
      'player_step2',
    ] as const) {
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

  it('lists player animation frames for the documented process', () => {
    expect(PLAYER_PLACEHOLDER_FRAME).toBe('player_idle');
    expect(PLAYER_ANIM_FRAMES).toEqual({
      idle: 'player_idle',
      duck: 'player_duck',
      jump: 'player_jump',
      jump2: 'player_jump2',
      walk: ['player_step1', 'player_step2'],
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
    }
    expect(src).toContain(`PLACEHOLDER_SCALE = ${ART_PLACEHOLDER_SCALE}`);
    expect(src).toContain(`ATLAS_PADDING = ${ATLAS_PADDING}`);
    expect(src).toContain(`ATLAS_MAX_SIZE = ${ATLAS_MAX_SIZE}`);
  });

  it('rejects unknown sprite ids', () => {
    expect(isSpriteId('player_idle')).toBe(true);
    expect(isSpriteId('nope')).toBe(false);
    expect(() => getSpriteDef('nope' as never)).toThrow(/Unknown sprite id/);
  });
});
