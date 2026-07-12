/**
 * Map collision AABB → sprite draw position using catalog pivots.
 * Keeps Phaser scenes free of placement math.
 */

import { TILE_ART_SIZE } from '../config/art';
import { WORLD } from '../config/constants';
import type { SpriteDef, SpritePivot } from './catalog';
import { gameDrawSize } from './catalog';

export type Aabb = Readonly<{ x: number; y: number; w: number; h: number }>;

export type SpritePlacement = Readonly<{
  /** World position of the sprite origin (Phaser setPosition). */
  x: number;
  y: number;
  /** Display size in game pixels. */
  displayW: number;
  displayH: number;
  originX: number;
  originY: number;
}>;

/**
 * Place a character-style sprite so its pivot sits on the AABB bottom-center
 * (feet on the ground line). Used for player / enemy guys.
 */
export function placeOnAabbBottomCenter(
  body: Aabb,
  pivot: SpritePivot,
  display: Readonly<{ w: number; h: number }>,
): SpritePlacement {
  return {
    x: body.x + body.w / 2,
    y: body.y + body.h,
    displayW: display.w,
    displayH: display.h,
    originX: pivot.x,
    originY: pivot.y,
  };
}

/** Placement for center-pivot sprites (helis, projectiles, VFX). */
export function placeOnCenter(
  centerX: number,
  centerY: number,
  pivot: SpritePivot,
  display: Readonly<{ w: number; h: number }>,
): SpritePlacement {
  return {
    x: centerX,
    y: centerY,
    displayW: display.w,
    displayH: display.h,
    originX: pivot.x,
    originY: pivot.y,
  };
}

/**
 * Half the difference between the tile art and the collision grid — Flash
 * `drawMap` draws each tile at `x * tileWidth - 1`, centring the 52×52 art on
 * the 50×50 cell. The 1px bleed on every side is what keeps neighbouring tiles
 * seamless when the canvas is scaled to a non-integer factor.
 */
export const TILE_ART_OFFSET = (WORLD.tile - TILE_ART_SIZE) / 2;

/**
 * Placement for a ground tile at grid (col, row), relative to the arena origin.
 * Tiles pivot top-left, so the origin offset applies directly to the position.
 */
export function tilePlacement(
  col: number,
  row: number,
  arenaOriginX: number,
  arenaOriginY: number,
): SpritePlacement {
  return {
    x: arenaOriginX + col * WORLD.tile + TILE_ART_OFFSET,
    y: arenaOriginY + row * WORLD.tile + TILE_ART_OFFSET,
    displayW: TILE_ART_SIZE,
    displayH: TILE_ART_SIZE,
    originX: 0,
    originY: 0,
  };
}

/** Placement for the player sprite from body + sprite def. */
export function playerSpritePlacement(
  body: Aabb,
  def: SpriteDef,
): SpritePlacement {
  return placeOnAabbBottomCenter(body, def.pivot, gameDrawSize(def));
}

/**
 * Uniformly scale a game-space display size.
 * Prefer this (or re-`setDisplaySize`) over Phaser `setScale` on atlas Images
 * whose native texture is larger than the game draw box — `setScale` overwrites
 * the scale that `setDisplaySize` installed (#34 lead review).
 */
export function scaledDisplaySize(
  baseW: number,
  baseH: number,
  scale: number,
): Readonly<{ w: number; h: number }> {
  return { w: baseW * scale, h: baseH * scale };
}

/**
 * Explosion growth over lifetime: 1 → 2.5 (matches prior Arc `setScale` feel).
 */
export function explosionAgeScale(age: number, maxAge: number): number {
  if (maxAge <= 0) {
    return 1;
  }
  return 1 + (age / maxAge) * 1.5;
}

/**
 * Rail beam alpha over its linger — Flash `railFrame` fades `_alpha` in place
 * instead of moving the clip.
 *
 * The sim steps before the scene draws, so a beam is already one tick old the
 * first time it is seen; the ramp starts from that tick so the beam always
 * flashes at full brightness once rather than appearing pre-faded.
 */
export function railBeamAlpha(age: number, maxLifetime: number): number {
  if (maxLifetime <= 1) {
    return 1;
  }
  const faded = (age - 1) / (maxLifetime - 1);
  return Math.min(1, Math.max(0, 1 - faded));
}

/**
 * Parachute canopy size as it deploys. Flash grew `_xscale` 0..100 with the
 * canopy bulging taller than it is wide, so height leads width and clamps full.
 */
export function chuteOpenDisplaySize(
  base: Readonly<{ w: number; h: number }>,
  openness: number,
  bulge: number,
): Readonly<{ w: number; h: number }> {
  return {
    w: base.w * openness,
    h: base.h * Math.min(1, openness + bulge),
  };
}
