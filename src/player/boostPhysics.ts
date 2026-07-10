import { PLAYER } from '../config/constants';

/**
 * Charged hyper-jump (boost) matching `heroAction` in the decompiled AS.
 *
 * Charge ticks +1/frame up to {@link PLAYER.boostChargeFrames} (150 ≈ 5s @30Hz).
 * On a rising edge of the fire condition (not the key — holding Ctrl refires
 * as soon as the meter refills after landing) while fully charged and a jump slot remains
 * (`!jump || !jump2`) and `!hjump`, fires `vy = {@link PLAYER.boostVel}` (−32),
 * zeroes the meter, and marks `hjump` so it cannot re-fire until landing.
 *
 * {@link BoostState.charge} is the raw meter (0..150) for the HUD (#23).
 */
export type BoostState = {
  /** Charge meter frames (0..{@link PLAYER.boostChargeFrames}). */
  charge: number;
  /** True after a hyper-jump until floor contact (`hjump` in the original). */
  hjump: boolean;
  /** Previous-frame boost-key latch (`boostK` in the original). */
  boostHeld: boolean;
};

export type BoostInput = {
  /** Boost key currently held (Ctrl). */
  boost: boolean;
};

/** Jump flags the boost gate reads (same `jump` / `jump2` as jump physics). */
export type BoostJumpFlags = {
  jump: boolean;
  jump2: boolean;
};

/** Fresh state: meter full, no hyper-jump spent. */
export function createBoostState(): BoostState {
  return {
    charge: PLAYER.boostChargeFrames,
    hjump: false,
    boostHeld: false,
  };
}

/** Charge fraction 0..1 for the HUD meter (#23). */
export function boostChargeRatio(state: BoostState): number {
  return state.charge / PLAYER.boostChargeFrames;
}

/** Floor contact: clear the once-per-airtime hyper-jump latch. */
export function resetBoostOnLand(state: BoostState): void {
  state.hjump = false;
}

/** Result of one boost charge/fire step. */
export type BoostApplyResult = {
  vy: number;
  /** True when a hyper-jump burst fired this frame (Flash `shjump`). */
  fired: boolean;
};

/**
 * One frame of boost charge + fire. Returns the possibly updated `vy` and
 * whether a hyper-jump burst fired (for SFX #27).
 *
 * Call after airborne mark and before the regular jump hold (original order:
 * charge/fire → jump key). Mutates {@link BoostJumpFlags} when the boost
 * consumes a jump slot.
 */
export function applyBoostInput(
  vy: number,
  state: BoostState,
  jumpFlags: BoostJumpFlags,
  input: BoostInput,
): BoostApplyResult {
  // Charge +1/frame while below cap (original: `if (move && hyperjump < 150)`).
  if (state.charge < PLAYER.boostChargeFrames) {
    state.charge += 1;
  }

  const canFire =
    state.charge >= PLAYER.boostChargeFrames &&
    input.boost &&
    (!jumpFlags.jump || !jumpFlags.jump2) &&
    !state.hjump;

  let fired = false;
  if (canFire) {
    if (!state.boostHeld) {
      vy = PLAYER.boostVel;
      if (jumpFlags.jump) {
        jumpFlags.jump2 = true;
      }
      jumpFlags.jump = true;
      state.hjump = true;
      state.charge = 0;
      fired = true;
    }
    state.boostHeld = true;
  } else {
    state.boostHeld = false;
  }

  return { vy, fired };
}
