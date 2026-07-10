import { PLAYER } from '../config/constants';

/**
 * Horizontal input for one sim tick. Matches the original's left/right/duck
 * gates around `xspeed` accel + friction (see `heroAction` in the decompiled AS).
 */
export type WalkInput = {
  left: boolean;
  right: boolean;
  /** When true, blocks accel; friction still runs (issue #6 wires duck fully). */
  duck?: boolean;
  /**
   * Jump flag — original skips the duck-forced friction branch while airborne
   * (`duck && !jump`). Unused until jump exists; defaults to false.
   */
  jump?: boolean;
};

/**
 * Apply one frame of HA2 horizontal walk physics to `vx`.
 *
 * Spec / original order:
 * 1. Accel ±{@link PLAYER.walkAccel} toward ±{@link PLAYER.walkCap} while
 *    holding a direction and not ducking (`if (xspeed > -5) xspeed--` etc.).
 * 2. Friction −{@link PLAYER.friction} toward 0 when neither/both keys are held,
 *    or when ducking on the ground (`duck && !jump`).
 * 3. Hard-cap decay: if `|vx| > {@link PLAYER.hardCap}`, step 1 toward the cap
 *    (knockback can exceed the input cap briefly; not an instant clamp).
 *
 * Pure — no tile resolve, no gravity. Call before AABB resolve each sim tick.
 */
export function applyHorizontalWalk(vx: number, input: WalkInput): number {
  const duck = input.duck === true;
  const jump = input.jump === true;

  // Accel — original: `if (move && !this.duck) { left/right }`
  if (!duck) {
    if (input.left && vx > -PLAYER.walkCap) {
      vx -= PLAYER.walkAccel;
    }
    if (input.right && vx < PLAYER.walkCap) {
      vx += PLAYER.walkAccel;
    }
  }

  // Friction — original: neither, both, or (duck && !jump)
  const both = input.left && input.right;
  const neither = !input.left && !input.right;
  if (both || neither || (duck && !jump)) {
    if (vx > 0) {
      vx -= PLAYER.friction;
    } else if (vx < 0) {
      vx += PLAYER.friction;
    }
  }

  // Hard cap decay — original: `if (xspeed>6) xspeed--; if (xspeed<-6) xspeed++;`
  if (vx > PLAYER.hardCap) {
    vx -= PLAYER.friction;
  }
  if (vx < -PLAYER.hardCap) {
    vx += PLAYER.friction;
  }

  return vx;
}
