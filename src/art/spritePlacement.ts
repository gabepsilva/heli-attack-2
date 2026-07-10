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

/** Placement for the player placeholder from body + sprite def. */
export function playerSpritePlacement(
  body: Aabb,
  def: SpriteDef,
): SpritePlacement {
  return placeOnAabbBottomCenter(body, def.pivot, gameDrawSize(def));
}
