/**
 * Player animation frame selection — issue #33.
 *
 * Mirrors Flash `heroAction` gfx frames (decompiled AS):
 *   1 idle · 2 duck · 3 jump · 4 walk (nested step cycle) · 5 jump2
 * Death swaps the clip to `guyBurned` (`gameover == 1`). Hurt is a dedicated
 * hi-res frame shown while the Flash `lasthealth > health` flash / i-frames
 * are active (original tinted the whole scene; we keep a body pose).
 */

import { PLAYER_ANIM_FRAMES, type SpriteId } from '../art/catalog';

/** Inputs derived from live player / combat state each render (or sim) tick. */
export type PlayerAnimInput = Readonly<{
  /** Collision duck flag (`Player.ducking`). */
  ducking: boolean;
  /** First-jump / airborne flag (`jumpState.jump`). */
  jump: boolean;
  /** Double-jump spent (`jumpState.jump2`). */
  jump2: boolean;
  /**
   * Horizontal motion this tick — Flash `xchange != 0`.
   * Use body velocity (post-step) so friction still shows a walk frame.
   */
  moving: boolean;
  /** Hurt flash / i-frames while alive (`isPlayerHurtFlashing` or i-frames). */
  hurt: boolean;
  /** Death / dying (`!alive` or flow dying). */
  dead: boolean;
  /**
   * Walk-cycle phase into {@link PLAYER_ANIM_FRAMES.walk}.
   * Flash advances the nested walk clip one frame per `move` tick.
   */
  walkPhase: number;
}>;

/**
 * Advance the 2-frame walk cycle when the player is moving on a sim move tick.
 * Matches Flash `gfx.gfx.nextFrame()` / wrap to 1 inside the walk parent frame.
 */
export function advanceWalkPhase(
  phase: number,
  moving: boolean,
  moveTick: boolean,
): number {
  if (!moving || !moveTick) {
    return phase;
  }
  const len = PLAYER_ANIM_FRAMES.walk.length;
  return (phase + 1) % len;
}

/**
 * Pick the atlas frame for the current player state.
 *
 * Priority (death / hurt first, then Flash order: duck → jump/jump2 → walk → idle):
 * 1. dead → `player_death`
 * 2. hurt → `player_hurt`
 * 3. ducking → `player_duck`
 * 4. jump + jump2 → `player_jump2`; jump → `player_jump`
 * 5. moving → walk cycle frame
 * 6. else → `player_idle`
 */
export function selectPlayerAnimFrame(input: PlayerAnimInput): SpriteId {
  if (input.dead) {
    return PLAYER_ANIM_FRAMES.death;
  }
  if (input.hurt) {
    return PLAYER_ANIM_FRAMES.hurt;
  }
  if (input.ducking) {
    return PLAYER_ANIM_FRAMES.duck;
  }
  if (input.jump) {
    return input.jump2 ? PLAYER_ANIM_FRAMES.jump2 : PLAYER_ANIM_FRAMES.jump;
  }
  if (input.moving) {
    const walk = PLAYER_ANIM_FRAMES.walk;
    const idx = ((input.walkPhase % walk.length) + walk.length) % walk.length;
    return walk[idx]!;
  }
  return PLAYER_ANIM_FRAMES.idle;
}

/** True when |vx| is non-zero enough to count as Flash `xchange != 0`. */
export function playerAnimMoving(vx: number): boolean {
  return vx !== 0;
}
