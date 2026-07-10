/**
 * Sprite catalog for the art pipeline (#32 / #33 / #34).
 * Every entry is a committed final redraw (`final: true`) — no placeholders.
 * Player frames live under {@link ART_PLAYER_FINAL_DIR} (8×); world frames
 * under {@link ART_WORLD_FINAL_DIR} (4×). Frame names are Phaser atlas keys.
 */

import {
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ART_WORLD_FINAL_DIR,
  ART_WORLD_FINAL_SCALE,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';

/** Normalized pivot: (0,0) = top-left, (0.5,1) = bottom-center, etc. */
export type SpritePivot = Readonly<{ x: number; y: number }>;

export type SpriteDef = Readonly<{
  /** Atlas frame name (and logical id). */
  id: string;
  /**
   * Source PNG basename.
   * Player: under {@link ART_PLAYER_FINAL_DIR}.
   * World: under {@link ART_WORLD_FINAL_DIR}.
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
   * upscale). All catalog entries are final after #34.
   */
  final?: boolean;
}>;

/**
 * Curated atlas set — all final hi-res redraws (#33 player, #34 world).
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
    role: 'Enemy helicopter look 0 / hover (final hi-res; warm desert)',
    final: true,
  },
  {
    id: 'heli_strafe',
    sourceFile: 'heli_strafe.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter look 1 / strafe (final hi-res; cool steel)',
    final: true,
  },
  {
    id: 'heli_hit',
    sourceFile: 'heli_hit.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter damaged flash (final hi-res)',
    final: true,
  },
  {
    id: 'heli_destroyed',
    sourceFile: 'heliDestroyed.png',
    originalW: 173,
    originalH: 89,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter wreck (final hi-res)',
    final: true,
  },
  {
    id: 'enemy_guy',
    sourceFile: 'enemyguy.png',
    originalW: 25,
    originalH: 50,
    pivot: { x: 0.5, y: 1 },
    role: 'Paratrooper / ground enemy (final hi-res)',
    final: true,
  },
  {
    id: 'bullet_player',
    sourceFile: 'bullett.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Player projectile (final hi-res)',
    final: true,
  },
  {
    id: 'bullet_enemy',
    sourceFile: 'enemybullet.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy projectile (final hi-res)',
    final: true,
  },
  {
    id: 'weapon_machinegun',
    sourceFile: 'machineGun.png',
    originalW: 29,
    originalH: 16,
    pivot: { x: 0.2, y: 0.5 },
    role: 'Starting machine gun (final hi-res)',
    final: true,
  },
  {
    id: 'muzzle_flash',
    sourceFile: 'muzzle_flash.png',
    originalW: 16,
    originalH: 16,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Weapon muzzle flash (final hi-res)',
    final: true,
  },
  {
    id: 'grenade',
    sourceFile: 'grenade.png',
    originalW: 19,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Grenade projectile (final hi-res)',
    final: true,
  },
  {
    id: 'rocket',
    sourceFile: 'Rocket.png',
    originalW: 21,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Rocket projectile (final hi-res)',
    final: true,
  },
  {
    id: 'smoke',
    sourceFile: 'smoke.png',
    originalW: 28,
    originalH: 27,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Smoke VFX (final hi-res)',
    final: true,
  },
  {
    id: 'blood',
    sourceFile: 'blood.png',
    originalW: 30,
    originalH: 30,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Hit / blood VFX (final hi-res)',
    final: true,
  },
  {
    id: 'explosion',
    sourceFile: 'explosion.png',
    originalW: 187,
    originalH: 186,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death explosion (final hi-res; half Flash bigboom)',
    final: true,
  },
  {
    id: 'powerup',
    sourceFile: 'powerup.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Powerup crate base (final hi-res)',
    final: true,
  },
  {
    id: 'tile_floor',
    sourceFile: 'Floor.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Solid floor tile (final hi-res; maps to WORLD.tile)',
    final: true,
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

/**
 * Heli look → atlas frame (#20 / #34).
 * Look 0 = hover (warm desert), look 1 = strafe (cool steel).
 */
export const HELI_LOOK_FRAMES = [
  'heli',
  'heli_strafe',
] as const satisfies readonly SpriteId[];

/** World (non-player) final frame ids — acceptance: zero placeholders (#34). */
export const WORLD_FINAL_FRAME_IDS: readonly SpriteId[] = SPRITE_DEFS.filter(
  (d) => !d.id.startsWith('player_'),
).map((d) => d.id);

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

/** True when every catalog sprite is a committed final redraw (#34). */
export function catalogHasNoPlaceholders(): boolean {
  return SPRITE_DEFS.every((d) => isFinalSprite(d));
}

/** Repo-relative path to a final player source PNG. */
export function finalPlayerSourcePath(def: SpriteDef): string {
  return `${ART_PLAYER_FINAL_DIR}/${def.sourceFile}`;
}

/** Repo-relative path to a final world source PNG. */
export function finalWorldSourcePath(def: SpriteDef): string {
  return `${ART_WORLD_FINAL_DIR}/${def.sourceFile}`;
}

/** Repo-relative path to the committed final source for a catalog entry. */
export function finalSourcePath(def: SpriteDef): string {
  if (def.id.startsWith('player_')) {
    return finalPlayerSourcePath(def);
  }
  return finalWorldSourcePath(def);
}

/** Texture scale for a catalog entry (player 8×, world 4×). */
export function textureScaleFor(def: SpriteDef): number {
  if (!isFinalSprite(def)) {
    // Legacy path — catalog no longer ships placeholders after #34.
    return ART_WORLD_FINAL_SCALE;
  }
  return def.id.startsWith('player_')
    ? ART_PLAYER_FINAL_SCALE
    : ART_WORLD_FINAL_SCALE;
}

/**
 * Texture pixel size in the packed atlas.
 * Final player frames use {@link ART_PLAYER_FINAL_SCALE}; world finals use
 * {@link ART_WORLD_FINAL_SCALE}.
 */
export function textureSize(def: SpriteDef): { w: number; h: number } {
  const scale = textureScaleFor(def);
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
  if (def.id === 'explosion') {
    // Flash bigboom ~374px; catalog stores half-res source, draw at full feel.
    return { w: 120, h: 120 };
  }
  if (def.id === 'muzzle_flash') {
    return { w: 18, h: 18 };
  }
  return { w: def.originalW, h: def.originalH };
}

/** Atlas frame for a heli look index (#20/#34). */
export function heliFrameForLook(look: number): SpriteId {
  return HELI_LOOK_FRAMES[look] ?? HELI_LOOK_FRAMES[0];
}
