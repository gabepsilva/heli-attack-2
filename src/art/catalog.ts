/**
 * Sprite catalog for the art pipeline (#32 / #33).
 * Non-player `sourceFile` names match iopred/heliattack `ha2/assets` (gitignored).
 * Player frames are final redraws under {@link ART_PLAYER_FINAL_DIR} (#33).
 * Frame names are the atlas keys used by Phaser (`load.atlas` hash format).
 */

import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';

/** Normalized pivot: (0,0) = top-left, (0.5,1) = bottom-center, etc. */
export type SpritePivot = Readonly<{ x: number; y: number }>;

export type SpriteDef = Readonly<{
  /** Atlas frame name (and logical id). */
  id: string;
  /**
   * Source PNG basename.
   * Placeholders: under `reference/ha2-source/gfx/`.
   * Final player: under {@link ART_PLAYER_FINAL_DIR}.
   */
  sourceFile: string;
  /** Original Flash-era pixel size (art bible / pose reference). */
  originalW: number;
  originalH: number;
  /** Pivot used when placing the sprite in the scene. */
  pivot: SpritePivot;
  /** Short role note for ART-SPEC / artists. */
  role: string;
  /**
   * When true, the packer loads the committed final PNG (no placeholder
   * upscale). Player frames are final after #33.
   */
  final?: boolean;
}>;

/**
 * Curated atlas set. Player entries are final hi-res redraws (#33);
 * everything else remains a 4× placeholder until #34.
 */
export const SPRITE_DEFS = [
  {
    id: 'player_idle',
    sourceFile: 'player_idle.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player stand / idle (final hi-res; Flash guy.png pose)',
    final: true,
  },
  {
    id: 'player_duck',
    sourceFile: 'player_duck.png',
    originalW: 25,
    originalH: 39,
    pivot: { x: 0.5, y: 1 },
    role: 'Player duck (final hi-res; Flash gfx frame 2 / duck.png)',
    final: true,
  },
  {
    id: 'player_jump',
    sourceFile: 'player_jump.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player jump (final hi-res; Flash gfx frame 3)',
    final: true,
  },
  {
    id: 'player_jump2',
    sourceFile: 'player_jump2.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player double-jump (final hi-res; Flash gfx frame 5)',
    final: true,
  },
  {
    id: 'player_step1',
    sourceFile: 'player_step1.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 1 (final hi-res; Flash gfx frame 4)',
    final: true,
  },
  {
    id: 'player_step2',
    sourceFile: 'player_step2.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 2 (final hi-res; Flash gfx frame 4)',
    final: true,
  },
  {
    id: 'player_hurt',
    sourceFile: 'player_hurt.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player hurt flash pose (final hi-res; shown during i-frames)',
    final: true,
  },
  {
    id: 'player_death',
    sourceFile: 'player_death.png',
    originalW: 40,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player death (final hi-res; Flash guyBurned swap)',
    final: true,
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

/**
 * Player animation frame ids wired to Flash hero gfx states (#33).
 * Walk is the two-frame nested cycle under Flash gfx frame 4.
 */
export const PLAYER_ANIM_FRAMES = {
  idle: 'player_idle',
  duck: 'player_duck',
  jump: 'player_jump',
  jump2: 'player_jump2',
  walk: ['player_step1', 'player_step2'],
  hurt: 'player_hurt',
  death: 'player_death',
} as const satisfies {
  idle: SpriteId;
  duck: SpriteId;
  jump: SpriteId;
  jump2: SpriteId;
  walk: readonly SpriteId[];
  hurt: SpriteId;
  death: SpriteId;
};

/** All player atlas frame ids (final art — no placeholder player remains). */
export const PLAYER_FINAL_FRAME_IDS: readonly SpriteId[] = [
  PLAYER_ANIM_FRAMES.idle,
  PLAYER_ANIM_FRAMES.duck,
  PLAYER_ANIM_FRAMES.jump,
  PLAYER_ANIM_FRAMES.jump2,
  ...PLAYER_ANIM_FRAMES.walk,
  PLAYER_ANIM_FRAMES.hurt,
  PLAYER_ANIM_FRAMES.death,
];

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

/** True when this catalog entry is a committed final redraw (not a placeholder). */
export function isFinalSprite(def: SpriteDef): boolean {
  return def.final === true;
}

/** Repo-relative path to a final player source PNG. */
export function finalPlayerSourcePath(def: SpriteDef): string {
  return `${ART_PLAYER_FINAL_DIR}/${def.sourceFile}`;
}

/**
 * Texture pixel size in the packed atlas.
 * Final player frames use {@link ART_PLAYER_FINAL_SCALE}; placeholders use
 * {@link ART_PLACEHOLDER_SCALE}.
 */
export function textureSize(def: SpriteDef): { w: number; h: number } {
  const scale = isFinalSprite(def)
    ? ART_PLAYER_FINAL_SCALE
    : ART_PLACEHOLDER_SCALE;
  return {
    w: def.originalW * scale,
    h: def.originalH * scale,
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
