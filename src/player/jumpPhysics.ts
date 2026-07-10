import { PLAYER } from '../config/constants';

/**
 * Jump / double-jump state matching `heroAction` in the decompiled AS.
 *
 * Variable height: while the jump key is held and {@link JumpState.up} > 0,
 * each frame forces `vy = min(vy, jumpVel)` (−8) and decrements `up` by
 * `timeStep` (issue #90 — hold duration is in sim time so bullet-time arcs
 * stay meaningful). Releasing the key refills `up` to
 * {@link PLAYER.jumpHoldFrames} when `!jump || (!jump2 && !duck)` — duck
 * blocks only the double-jump refill term. The press path is ungated
 * (grounded crouch hops are allowed).
 */
export type JumpState = {
  /** True after leaving the ground (jump, fall, or ceiling bonk). */
  jump: boolean;
  /** True after the second jump (or ceiling bonk). */
  jump2: boolean;
  /**
   * Remaining hold-window time (0..{@link PLAYER.jumpHoldFrames}).
   * At `timeStep === 1` this matches Flash frame counts; under bullet-time
   * it drains by `timeStep` so a full hold still lasts 6 units of sim time.
   */
  up: number;
  /** Previous-frame jump-key latch (`upk` in the original). */
  upHeld: boolean;
};

export type JumpInput = {
  /** Jump key currently held (↑). */
  jump: boolean;
  /** Duck key currently held — blocks double-jump hold refill. */
  duck: boolean;
};

/** Fresh grounded state: full hold window, no jump flags. */
export function createJumpState(): JumpState {
  return {
    jump: false,
    jump2: false,
    up: PLAYER.jumpHoldFrames,
    upHeld: false,
  };
}

/**
 * If vertical speed is non-zero and we have not yet marked airborne, consume
 * the first jump flag (walking off a ledge). Original:
 * `if (yspeed) { if (!jump) jump = 1; }`.
 */
export function markAirborneIfMoving(state: JumpState, vy: number): void {
  if (vy !== 0 && !state.jump) {
    state.jump = true;
  }
}

/**
 * One frame of jump input. Returns the possibly updated `vy`.
 *
 * Call after walk friction and before gravity. Does not apply gravity or
 * terminal clamp — those stay in the player step / tile resolver.
 *
 * {@link timeStep} drains the hold window (Flash used 1/frame; under
 * bullet-time we drain by the live scale so jump height stays playable).
 */
export function applyJumpInput(
  vy: number,
  state: JumpState,
  input: JumpInput,
  timeStep: number = 1,
): number {
  if (input.jump) {
    if (state.up > 0) {
      vy = Math.min(vy, PLAYER.jumpVel);
      if (!state.upHeld) {
        if (!state.jump) {
          state.jump = true;
        } else if (!state.jump2) {
          state.jump2 = true;
        }
      }
      state.up = Math.max(0, state.up - timeStep);
    }
    state.upHeld = true;
  } else {
    if (!state.jump || (!state.jump2 && !input.duck)) {
      state.up = PLAYER.jumpHoldFrames;
    } else {
      state.up = 0;
    }
    state.upHeld = false;
  }

  return vy;
}

/** Floor contact: clear jump flags so the next press is a fresh first jump. */
export function resetJumpOnLand(state: JumpState): void {
  state.jump = false;
  state.jump2 = false;
}

/**
 * Ceiling contact: burn both jumps and zero the hold window (original sets
 * `jump = jump2 = 1; up = 0`).
 */
export function cancelJumpOnCeiling(state: JumpState): void {
  state.jump = true;
  state.jump2 = true;
  state.up = 0;
}
