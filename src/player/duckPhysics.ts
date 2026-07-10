import { PLAYER, WORLD } from '../config/constants';
import { hitCheck } from '../world/hitCheck';
import type { TileMap } from '../world/tileMap';

/** Standing hitbox from the spec. */
export const STAND_SIZE = { w: PLAYER.boxW, h: PLAYER.boxH } as const;

/** Ducked hitbox: 2/3 of standing W&H → ≈6.67 × 28. */
export const DUCK_SIZE = {
  w: PLAYER.boxW * PLAYER.duckScale,
  h: PLAYER.boxH * PLAYER.duckScale,
} as const;

export type DuckBody = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Apply one frame of duck / stand hitbox changes.
 *
 * - Ducking: shrink to {@link DUCK_SIZE}, keep feet planted, center X.
 * - Standing from duck: restore {@link STAND_SIZE} with feet planted (top-anchored
 *   hitbox; the original's `_y` nudge compensated sprite-anchored coords we don't use).
 *
 * If overhead tiles block the standing box, the player stays ducked until
 * headroom clears (standard crouch rule).
 *
 * Returns whether the player is currently ducked.
 */
export function applyDuckHitbox(
  body: DuckBody,
  wantDuck: boolean,
  wasDuck: boolean,
  map: TileMap,
): boolean {
  if (wantDuck) {
    if (!wasDuck) {
      shrinkToDuck(body);
    } else {
      // Stay ducked — keep exact ducked size (idempotent).
      body.w = DUCK_SIZE.w;
      body.h = DUCK_SIZE.h;
    }
    return true;
  }

  if (wasDuck) {
    if (hasStandingHeadroom(map, body)) {
      growToStand(body);
    } else {
      // Ceiling blocks expansion — remain crouched until clear.
      body.w = DUCK_SIZE.w;
      body.h = DUCK_SIZE.h;
      return true;
    }
  } else {
    body.w = STAND_SIZE.w;
    body.h = STAND_SIZE.h;
  }
  return false;
}

function shrinkToDuck(body: DuckBody): void {
  const oldW = body.w;
  const oldH = body.h;
  body.w = DUCK_SIZE.w;
  body.h = DUCK_SIZE.h;
  // Keep feet planted; center the narrower box.
  body.y += oldH - body.h;
  body.x += (oldW - body.w) / 2;
}

/** True when the standing hitbox (feet planted, centered) would not overlap solids. */
export function hasStandingHeadroom(map: TileMap, body: DuckBody): boolean {
  const tile = map.tileSize ?? WORLD.tile;
  const feetY = body.y + body.h;
  const centerX = body.x + body.w / 2;
  const standX = centerX - STAND_SIZE.w / 2;
  const standY = feetY - STAND_SIZE.h;

  const tilex = Math.floor((standX + 1) / tile);
  const tile2x = Math.floor((standX + STAND_SIZE.w) / tile);
  const tiley = Math.floor(standY / tile);
  const tile2y = Math.floor((standY + STAND_SIZE.h) / tile);

  return hitCheck(map, tiley, tilex, tile2y, tile2x, 0) === 0;
}

function growToStand(body: DuckBody): void {
  const oldW = body.w;
  const oldH = body.h;
  body.w = STAND_SIZE.w;
  body.h = STAND_SIZE.h;
  // Keep feet planted (top-anchored hitbox).
  body.y -= body.h - oldH;
  body.x -= (body.w - oldW) / 2;
}
