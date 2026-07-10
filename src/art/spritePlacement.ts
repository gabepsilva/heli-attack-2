/**
 * Map collision AABB → sprite draw position using catalog pivots.
 * Keeps Phaser scenes free of placement math.
 */

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
