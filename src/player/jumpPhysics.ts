import { PLAYER } from '../config/constants';

/**
 * Jump / double-jump state matching `heroAction` in the decompiled AS.
 *
 * Variable height: while the jump key is held and {@link JumpState.up} > 0,
 * each frame forces `vy = min(vy, jumpVel)` (−8) and decrements `up`.
 * Releasing the key refills `up` to {@link PLAYER.jumpHoldFrames} when not
 * ducking and a jump is still available (`!jump2`, or grounded with `!jump`).
 * The hold window and double-jump press are blocked entirely while ducking.
 */
export type JumpState = {
  /** True after leaving the ground (jump, fall, or ceiling bonk). */
  jump: boolean;
  /** True after the second jump (or ceiling bonk). */
  jump2: boolean;
  /** Remaining frames of the hold window (0..{@link PLAYER.jumpHoldFrames}). */
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
 */
export function applyJumpInput(
  vy: number,
  state: JumpState,
  input: JumpInput,
): number {
  if (input.jump) {
    // Spec §Duck: no jump clamp, flag consume, or hold-window spend while ducked.
    if (!input.duck && state.up > 0) {
      vy = Math.min(vy, PLAYER.jumpVel);
      if (!state.upHeld) {
        if (!state.jump) {
          state.jump = true;
        } else if (!state.jump2) {
          state.jump2 = true;
        }
      }
      state.up -= 1;
    }
    state.upHeld = true;
  } else {
    // Refill when not ducking and at least one jump remains.
    if (!input.duck && (!state.jump || !state.jump2)) {
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
