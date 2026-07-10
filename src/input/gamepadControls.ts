/**
 * Gamepad → {@link PlayerIntent} — issue #31.
 *
 * Pure sampling: takes a normalized pad snapshot (no Phaser) and maps it onto
 * the same intent layer keyboard/mouse (#29) and touch (#30) use. Hotplug
 * helpers track connect/disconnect so unplugging falls back to keyboard.
 * Gameplay never reads gamepad APIs directly.
 */

import {
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_AIM_RANGE_PX,
  GAMEPAD_DEADZONE,
} from '../config/gamepad';
import { createPlayerIntent, type PlayerIntent } from './playerIntent';

/**
 * Normalized stick / button snapshot from a Standard Gamepad.
 * Stick axes are −1…+1 (x right, y down). Face / shoulder / trigger buttons
 * are level-triggered; weapon bumpers are edge-detected via
 * {@link advanceGamepadWeaponEdges}.
 */
export type GamepadControlSample = {
  /** Left stick X (−1 left … +1 right). */
  moveX: number;
  /** Left stick Y (−1 up … +1 down). Down past deadzone → duck. */
  moveY: number;
  /** Right stick X (−1 … +1). */
  aimStickX: number;
  /** Right stick Y (−1 … +1). */
  aimStickY: number;
  jump: boolean;
  boost: boolean;
  bulletTime: boolean;
  fire: boolean;
  /** D-pad left / right / down / up (mirrors stick move / duck / jump). */
  dpadLeft: boolean;
  dpadRight: boolean;
  dpadDown: boolean;
  dpadUp: boolean;
  /** Edge: cycle to previous owned weapon (LB). */
  prevWeapon: boolean;
  /** Edge: cycle to next owned weapon (RB). */
  nextWeapon: boolean;
  /**
   * When false, fire is forced off (not playing, debug-box drag, etc.).
   * Aim / movement still update.
   */
  allowFire: boolean;
};

/** Player AABB used to place the aim point relative to the body center. */
export type GamepadAimOrigin = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SampleGamepadIntentOptions = {
  /**
   * Aim fallback when the right stick is inside the deadzone (typically the
   * keyboard/mouse or touch aim).
   */
  fallbackAimX: number;
  fallbackAimY: number;
};

/** True when a stick vector is outside the configured deadzone. */
export function gamepadStickActive(
  x: number,
  y: number,
  deadzone = GAMEPAD_DEADZONE,
): boolean {
  return Math.hypot(x, y) >= deadzone;
}

/**
 * Build player intent from a gamepad sample using {@link DEFAULT_GAMEPAD_BINDINGS}
 * semantics (bindings table is the hardware mapping).
 *
 * - Left stick X / D-pad → left / right; Y down / D-pad down → duck
 * - D-pad up / A → jump; B → boost; X → bullet-time; RT → fire
 * - Right stick outside deadzone → aim at player center + dir × range
 * - LB / RB edges → prev / next weapon
 */
export function sampleGamepadIntent(
  sample: GamepadControlSample,
  origin: GamepadAimOrigin,
  options: SampleGamepadIntentOptions,
): PlayerIntent {
  const intent = createPlayerIntent(options.fallbackAimX, options.fallbackAimY);

  intent.left = sample.moveX <= -GAMEPAD_DEADZONE || sample.dpadLeft;
  intent.right = sample.moveX >= GAMEPAD_DEADZONE || sample.dpadRight;
  intent.duck = sample.moveY >= GAMEPAD_DEADZONE || sample.dpadDown;
  intent.jump = sample.jump || sample.dpadUp;
  intent.boost = sample.boost;
  intent.bulletTime = sample.bulletTime;
  intent.prevWeapon = sample.prevWeapon;
  intent.nextWeapon = sample.nextWeapon;
  intent.fire = sample.allowFire && sample.fire;

  const aiming = gamepadStickActive(sample.aimStickX, sample.aimStickY);
  if (aiming) {
    const cx = origin.x + origin.w / 2;
    const cy = origin.y + origin.h / 2;
    intent.aimX = cx + sample.aimStickX * GAMEPAD_AIM_RANGE_PX;
    intent.aimY = cy + sample.aimStickY * GAMEPAD_AIM_RANGE_PX;
  }

  return intent;
}

/** Tracks bumper held-state so weapon switch fires once per press. */
export type GamepadWeaponEdgeState = {
  prevHeld: boolean;
  nextHeld: boolean;
};

export function createGamepadWeaponEdgeState(): GamepadWeaponEdgeState {
  return { prevHeld: false, nextHeld: false };
}

/**
 * Rising-edge detector for LB / RB. Call once per frame with current held
 * flags; returns one-shot edges and updates the tracker.
 */
export function advanceGamepadWeaponEdges(
  state: GamepadWeaponEdgeState,
  held: { prevWeapon: boolean; nextWeapon: boolean },
): { prevWeapon: boolean; nextWeapon: boolean } {
  const prevWeapon = held.prevWeapon && !state.prevHeld;
  const nextWeapon = held.nextWeapon && !state.nextHeld;
  state.prevHeld = held.prevWeapon;
  state.nextHeld = held.nextWeapon;
  return { prevWeapon, nextWeapon };
}

/**
 * Hotplug connection state for the active pad.
 * `padIndex` is the Standard Gamepad index while connected; `null` when none.
 */
export type GamepadHotplugState = {
  connected: boolean;
  padIndex: number | null;
};

export function createGamepadHotplugState(): GamepadHotplugState {
  return { connected: false, padIndex: null };
}

/**
 * Apply a connect / disconnect event. Disconnect of the active pad clears
 * the connection so callers fall back to keyboard (AC: unplug → keyboard).
 * A disconnect of a different pad is ignored. A new connect replaces the
 * active pad (last-connected wins).
 */
export function applyGamepadHotplugEvent(
  state: GamepadHotplugState,
  event: { type: 'connected' | 'disconnected'; index: number },
): GamepadHotplugState {
  if (event.type === 'connected') {
    return { connected: true, padIndex: event.index };
  }
  // disconnected
  if (state.padIndex === event.index) {
    return { connected: false, padIndex: null };
  }
  return state;
}

/**
 * True when a pad is connected and should be sampled into intent.
 * Unplugged → false → keyboard-only path.
 */
export function isGamepadConnected(state: GamepadHotplugState): boolean {
  return state.connected && state.padIndex !== null;
}

/**
 * Pick the first connected pad from a Phaser-style pad list, or `null`.
 * Used on scene start / each frame to sync hotplug when the browser already
 * trusted the pad (no 'connected' event).
 */
export function findConnectedPadIndex(
  pads: ReadonlyArray<
    { index: number; connected?: boolean } | null | undefined
  >,
): number | null {
  for (const pad of pads) {
    if (pad != null && pad.connected !== false) {
      return pad.index;
    }
  }
  return null;
}

/** Sync hotplug state from the live pad list (handles already-connected pads). */
export function syncGamepadHotplugFromPads(
  state: GamepadHotplugState,
  pads: ReadonlyArray<
    { index: number; connected?: boolean } | null | undefined
  >,
): GamepadHotplugState {
  // Prefer keeping the current pad if it is still present and connected.
  if (state.padIndex !== null) {
    const stillThere = pads.some(
      (p) => p != null && p.index === state.padIndex && p.connected !== false,
    );
    if (stillThere) {
      return state.connected
        ? state
        : { connected: true, padIndex: state.padIndex };
    }
  }
  const index = findConnectedPadIndex(pads);
  if (index === null) {
    return { connected: false, padIndex: null };
  }
  return { connected: true, padIndex: index };
}

/** Expose bindings for tests / docs — sampler semantics follow this table. */
export { DEFAULT_GAMEPAD_BINDINGS };
