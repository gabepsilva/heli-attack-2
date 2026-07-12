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

/**
 * Sim ticks to hold each walk bitmap before advancing.
 * Flash `gfx.gfx.nextFrame()` ran once per move tick, but the nested walk clip
 * had a longer timeline than our 2 exported bitmaps (step1/step2) — advancing
 * every tick here strobes the feet. Hold ~4 ticks ≈ 7.5 pose changes/sec @30Hz.
 */
export const PLAYER_WALK_HOLD_TICKS = 4;

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
  /** Flash `heroStart` parachute drop — uses jump hang pose (gfx frame 6). */
  parachuting?: boolean;
  /**
   * Walk-cycle phase into {@link PLAYER_ANIM_FRAMES.walk}.
   * Advanced every {@link PLAYER_WALK_HOLD_TICKS} move ticks while moving.
   */
  walkPhase: number;
}>;

/**
 * Accumulate sim ticks spent walking (Flash nested `gfx.gfx`). Ticks stop while
 * airborne or idle and resume where they left off, so the cycle never restarts
 * mid-stride. Pass `steps` to fold a whole sim batch in one call.
 */
export function advanceWalkTicks(
  ticks: number,
  moving: boolean,
  steps: number,
): number {
  return moving ? ticks + steps : ticks;
}

/**
 * Walk bitmap for the accumulated tick count — each is held for
 * {@link PLAYER_WALK_HOLD_TICKS} ticks before the cycle advances.
 */
export function walkPhaseFor(ticks: number): number {
  return (
    Math.floor(ticks / PLAYER_WALK_HOLD_TICKS) % PLAYER_ANIM_FRAMES.walk.length
  );
}

/**
 * Pick the atlas frame for the current player state.
 *
 * Priority (death / hurt first, then Flash order: duck → jump/jump2 → walk → idle):
 * 1. dead → `player_death`
 * 2. hurt → `player_hurt`
 * 3. parachuting → `player_jump` (Flash `heroStart` gotoAndStop(6) hang pose)
 * 4. ducking → `player_duck`
 * 5. jump + jump2 → `player_jump2`; jump → `player_jump`
 * 6. moving → walk cycle frame
 * 7. else → `player_idle`
 */
export function selectPlayerAnimFrame(input: PlayerAnimInput): SpriteId {
  if (input.dead) {
    return PLAYER_ANIM_FRAMES.death;
  }
  if (input.hurt) {
    return PLAYER_ANIM_FRAMES.hurt;
  }
  if (input.parachuting) {
    return PLAYER_ANIM_FRAMES.jump;
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
