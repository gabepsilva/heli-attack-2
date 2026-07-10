import { PLAYER } from '../config/constants';

/** Standing hitbox from the spec. */
export const STAND_SIZE = { w: PLAYER.boxW, h: PLAYER.boxH } as const;

/** Ducked hitbox: 2/3 of standing W&H → ≈6.67 × 28. */
export const DUCK_SIZE = {
  w: PLAYER.boxW * PLAYER.duckScale,
  h: PLAYER.boxH * PLAYER.duckScale,
} as const;

/**
 * Stand-up Y nudge from the original (`_y -= 2/3 · defPlayerWidth`).
 * Uses Width, not Height — a faithful-port quirk.
 */
export const STAND_UP_NUDGE = PLAYER.boxW * PLAYER.duckScale;

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
 * - Standing from duck while grounded: restore {@link STAND_SIZE}, keep feet
 *   planted, then apply {@link STAND_UP_NUDGE} upward (original quirk).
 * - Standing from duck in air: restore size with feet-relative top only (no
 *   quirk nudge — original only nudges when the duck branch runs on release;
 *   we still restore dimensions every frame while not ducking).
 *
 * Returns whether the player is currently ducked.
 */
export function applyDuckHitbox(
  body: DuckBody,
  wantDuck: boolean,
  wasDuck: boolean,
  onGround: boolean,
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
    growToStand(body, onGround);
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

function growToStand(body: DuckBody, onGround: boolean): void {
  const oldW = body.w;
  const oldH = body.h;
  body.w = STAND_SIZE.w;
  body.h = STAND_SIZE.h;
  // Keep feet planted.
  body.y -= body.h - oldH;
  body.x -= (body.w - oldW) / 2;
  if (onGround) {
    body.y -= STAND_UP_NUDGE;
  }
}
