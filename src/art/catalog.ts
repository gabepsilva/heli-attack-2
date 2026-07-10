/**
 * Sprite catalog for the art pipeline (#32).
 * Source filenames match iopred/heliattack `ha2/assets` (gitignored locally).
 * Frame names are the atlas keys used by Phaser (`load.atlas` hash format).
 */

import { ART_PLACEHOLDER_SCALE } from '../config/art';
import { PLAYER, WORLD } from '../config/constants';

/** Normalized pivot: (0,0) = top-left, (0.5,1) = bottom-center, etc. */
export type SpritePivot = Readonly<{ x: number; y: number }>;

export type SpriteDef = Readonly<{
  /** Atlas frame name (and logical id). */
  id: string;
  /** Reference PNG basename under `reference/ha2-source/gfx/`. */
  sourceFile: string;
  /** Original Flash-era pixel size (art bible). */
  originalW: number;
  originalH: number;
  /** Pivot used when placing the sprite in the scene. */
  pivot: SpritePivot;
  /** Short role note for ART-SPEC / artists. */
  role: string;
}>;

/**
 * Curated placeholder set for the atlas workflow.
 * Original dimensions are measured from upstream `ha2/assets` / `ha2/assets/old`.
 */
export const SPRITE_DEFS = [
  {
    id: 'player_idle',
    sourceFile: 'guy.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player stand / idle (hero gfx frame)',
  },
  {
    id: 'player_duck',
    sourceFile: 'duck.png',
    originalW: 25,
    originalH: 39,
    pivot: { x: 0.5, y: 1 },
    role: 'Player duck (`gfx.gotoAndStop(2)` / duck.png)',
  },
  {
    id: 'player_jump',
    sourceFile: 'jump.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player jump',
  },
  {
    id: 'player_jump2',
    sourceFile: 'jump2.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player double-jump / air variant',
  },
  {
    id: 'player_step1',
    sourceFile: 'step1.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 1',
  },
  {
    id: 'player_step2',
    sourceFile: 'step2.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 2',
  },
  {
    id: 'heli',
    sourceFile: 'heli.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter',
  },
  {
    id: 'heli_hit',
    sourceFile: 'heli_hit.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter damaged flash',
  },
  {
    id: 'heli_destroyed',
    sourceFile: 'heliDestroyed.png',
    originalW: 173,
    originalH: 89,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter wreck',
  },
  {
    id: 'enemy_guy',
    sourceFile: 'enemyguy.png',
    originalW: 25,
    originalH: 50,
    pivot: { x: 0.5, y: 1 },
    role: 'Paratrooper / ground enemy',
  },
  {
    id: 'bullet_player',
    sourceFile: 'bullett.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Player projectile',
  },
  {
    id: 'bullet_enemy',
    sourceFile: 'enemybullet.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy projectile',
  },
  {
    id: 'weapon_machinegun',
    sourceFile: 'machineGun.png',
    originalW: 29,
    originalH: 16,
    pivot: { x: 0.2, y: 0.5 },
    role: 'Starting machine gun',
  },
  {
    id: 'grenade',
    sourceFile: 'grenade.png',
    originalW: 19,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Grenade projectile',
  },
  {
    id: 'rocket',
    sourceFile: 'Rocket.png',
    originalW: 21,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Rocket projectile',
  },
  {
    id: 'smoke',
    sourceFile: 'smoke.png',
    originalW: 28,
    originalH: 27,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Smoke VFX',
  },
  {
    id: 'blood',
    sourceFile: 'blood.png',
    originalW: 30,
    originalH: 30,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Hit / blood VFX',
  },
  {
    id: 'powerup',
    sourceFile: 'powerup.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Powerup crate base',
  },
  {
    id: 'tile_floor',
    sourceFile: 'Floor.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Solid floor tile (maps to WORLD.tile in game space)',
  },
] as const satisfies readonly SpriteDef[];

export type SpriteId = (typeof SPRITE_DEFS)[number]['id'];

/** Player animation frame ids (wired to states in #33). */
export const PLAYER_ANIM_FRAMES = {
  idle: 'player_idle',
  duck: 'player_duck',
  jump: 'player_jump',
  jump2: 'player_jump2',
  walk: ['player_step1', 'player_step2'],
} as const satisfies {
  idle: SpriteId;
  duck: SpriteId;
  jump: SpriteId;
  jump2: SpriteId;
  walk: readonly SpriteId[];
};

/** Default player frame shown until animation states land (#33). */
export const PLAYER_PLACEHOLDER_FRAME: SpriteId = PLAYER_ANIM_FRAMES.idle;

export function getSpriteDef(id: SpriteId): SpriteDef {
  const def = SPRITE_DEFS.find((s) => s.id === id);
  if (!def) {
    throw new Error(`Unknown sprite id: ${id}`);
  }
  return def;
}

export function isSpriteId(value: string): value is SpriteId {
  return SPRITE_DEFS.some((s) => s.id === value);
}

/** Texture pixel size after placeholder upscale. */
export function textureSize(def: SpriteDef): { w: number; h: number } {
  return {
    w: def.originalW * ART_PLACEHOLDER_SCALE,
    h: def.originalH * ART_PLACEHOLDER_SCALE,
  };
}

/**
 * Game-space draw size for a sprite.
 * Characters map to the spec sprite box; tiles map to {@link WORLD.tile};
 * everything else uses original Flash pixels (1 game unit = 1 Flash px).
 */
export function gameDrawSize(def: SpriteDef): { w: number; h: number } {
  if (def.id.startsWith('player_')) {
    return { w: PLAYER.spriteW, h: PLAYER.spriteH };
  }
  if (def.id === 'tile_floor') {
    return { w: WORLD.tile, h: WORLD.tile };
  }
  return { w: def.originalW, h: def.originalH };
}
