/**
 * Touch → {@link PlayerIntent} — issue #30.
 *
 * Pure sampling: the DOM HUD writes stick / button state; this module maps it
 * onto the same intent layer keyboard/mouse (#29) and gamepad (#31) use.
 * Gameplay never reads touch events directly.
 */

import { TOUCH_AIM_RANGE_PX, TOUCH_DEADZONE } from '../config/touch';
import { createPlayerIntent, type PlayerIntent } from './playerIntent';

/** Re-export shared merge so existing touch imports keep working. */
export { mergePlayerIntents } from './playerIntent';

/**
 * Normalized stick / button snapshot from the on-screen HUD.
 * Stick axes are −1…+1 (x right, y down). Buttons are level-triggered except
 * weapon switch, which is edge-triggered and drained each sample.
 */
export type TouchControlSample = {
  /** Move joystick X (−1 left … +1 right). */
  moveX: number;
  /** Move joystick Y (−1 up … +1 down). Down past deadzone → duck. */
  moveY: number;
  /** Aim / fire stick X (−1 … +1). */
  aimStickX: number;
  /** Aim / fire stick Y (−1 … +1). */
  aimStickY: number;
  jump: boolean;
  boost: boolean;
  bulletTime: boolean;
  /** Edge: cycle to previous owned weapon. */
  prevWeapon: boolean;
  /** Edge: cycle to next owned weapon. */
  nextWeapon: boolean;
  /**
   * When false, fire is forced off (not playing, debug-box drag, etc.).
   * Aim / movement still update.
   */
  allowFire: boolean;
};

/** Player AABB used to place the aim point relative to the body center. */
export type TouchAimOrigin = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SampleTouchIntentOptions = {
  /**
   * Aim fallback when the aim stick is inside the deadzone (typically the
   * keyboard/mouse aim, or the last touch aim).
   */
  fallbackAimX: number;
  fallbackAimY: number;
};

/** True when a stick vector is outside the configured deadzone. */
export function stickActive(
  x: number,
  y: number,
  deadzone = TOUCH_DEADZONE,
): boolean {
  return Math.hypot(x, y) >= deadzone;
}

/**
 * Build player intent from an on-screen touch sample.
 *
 * - Move stick X → left / right; Y down → duck
 * - Jump / boost / bullet-time buttons → held flags
 * - Aim stick outside deadzone → aim at player center + dir × range, and fire
 * - Weapon buttons are one-shot (caller clears after sample)
 */
export function sampleTouchIntent(
  sample: TouchControlSample,
  origin: TouchAimOrigin,
  options: SampleTouchIntentOptions,
): PlayerIntent {
  const intent = createPlayerIntent(options.fallbackAimX, options.fallbackAimY);

  intent.left = sample.moveX <= -TOUCH_DEADZONE;
  intent.right = sample.moveX >= TOUCH_DEADZONE;
  intent.duck = sample.moveY >= TOUCH_DEADZONE;
  intent.jump = sample.jump;
  intent.boost = sample.boost;
  intent.bulletTime = sample.bulletTime;
  intent.prevWeapon = sample.prevWeapon;
  intent.nextWeapon = sample.nextWeapon;

  const aiming = stickActive(sample.aimStickX, sample.aimStickY);
  if (aiming) {
    const cx = origin.x + origin.w / 2;
    const cy = origin.y + origin.h / 2;
    intent.aimX = cx + sample.aimStickX * TOUCH_AIM_RANGE_PX;
    intent.aimY = cy + sample.aimStickY * TOUCH_AIM_RANGE_PX;
    intent.fire = sample.allowFire;
  }

  return intent;
}
