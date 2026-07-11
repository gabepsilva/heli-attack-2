/**
 * Player spawn parachute — Flash `heroStart`.
 *
 * Slow chute descent from above the map; when a solid is ~5 tiles below the
 * feet the canopy collapses, then control hands off to `heroAction`.
 */

import { PLAYER, WORLD } from '../config/constants';
import type { AabbBody } from '../world/aabbBody';
import { isSolidTile } from '../world/tileMap';
import type { TileMap } from '../world/tileMap';

/**
 * Flash `heroStart` tunables.
 * Descent is `yspeed * timeStep + fallBoost` per tick (yspeed stays 2; the
 * unscaled `+5` is how the original kept the intro snappy).
 */
export const PLAYER_PARACHUTE = {
  /** Flash `yspeed = 2` while the chute is open / collapsing. */
  chuteFallSpeed: 2,
  /** Flash `_y += 5` each `heroStart` call (not scaled by timeStep there). */
  fallBoost: 5,
  /** Flash `chute._xscale ± 10` per step. */
  chuteScaleRate: 10,
  /** Flash `_xscale` is a percentage — the canopy is fully open at 100. */
  chuteScaleMax: 100,
  /** Flash `map[y+5][x]` near-ground probe (tiles below feet). */
  groundLookaheadTiles: 5,
  /** Flash `player._y = -50` intro spawn. */
  spawnY: -50,
} as const;

export type ParachuteIntroState = {
  /** True while `heroStart` owns the player (before `heroAction`). */
  active: boolean;
  /** Flash `fall` — canopy collapsing after the ground probe trips. */
  fall: boolean;
  /** Flash `gfx.chute._xscale` (0..100). */
  chuteScale: number;
};

export function createParachuteIntroState(active = false): ParachuteIntroState {
  return { active, fall: false, chuteScale: 0 };
}

/** Begin a fresh `heroStart` drop (run start / scene reset). */
export function beginParachuteIntro(state: ParachuteIntroState): void {
  state.active = true;
  state.fall = false;
  state.chuteScale = 0;
}

/** Force-complete the intro (scene reset / tests / cheats). */
export function completeParachuteIntro(state: ParachuteIntroState): void {
  state.active = false;
  state.fall = false;
  state.chuteScale = 0;
}

/**
 * One `heroStart` tick. Mutates {@link body} Y / vy.
 * @returns `true` on the tick the chute finishes collapsing (handoff).
 */
export function stepParachuteIntro(
  state: ParachuteIntroState,
  body: AabbBody,
  map: TileMap,
  timeStep: number,
): boolean {
  if (!state.active) {
    return false;
  }

  // Flash: `yspeed = 2; _y += yspeed * timeStep; _y += 5`. The chute owns
  // motion outright — no walk, no gravity, no tile resolve until handoff.
  body.vx = 0;
  body.vy = PLAYER_PARACHUTE.chuteFallSpeed;
  body.y +=
    PLAYER_PARACHUTE.chuteFallSpeed * timeStep + PLAYER_PARACHUTE.fallBoost;

  const scaleStep = PLAYER_PARACHUTE.chuteScaleRate * timeStep;

  if (state.fall) {
    state.chuteScale = Math.max(0, state.chuteScale - scaleStep);
    if (state.chuteScale > 0) {
      return false;
    }
    state.active = false;
    state.fall = false;
    return true;
  }

  state.chuteScale = Math.min(
    PLAYER_PARACHUTE.chuteScaleMax,
    state.chuteScale + scaleStep,
  );
  state.fall = isGroundNear(body, map);
  return false;
}

/**
 * Flash `map[y+5][x]` — is a solid cell within
 * {@link PLAYER_PARACHUTE.groundLookaheadTiles} below the hero's feet?
 * Probes from the 48px hero clip, not the 10×42 hitbox.
 */
function isGroundNear(body: AabbBody, map: TileMap): boolean {
  const footRow = Math.floor((body.y + PLAYER.spriteH) / WORLD.tile);
  if (footRow <= 0) {
    // Still above the grid on spawn (`_y = -50`) — nothing to probe against.
    return false;
  }
  const col = Math.floor((body.x + body.w / 2) / WORLD.tile);
  return isSolidTile(map, col, footRow + PLAYER_PARACHUTE.groundLookaheadTiles);
}
