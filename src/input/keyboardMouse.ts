/**
 * Keyboard + mouse → {@link PlayerIntent} — issue #29.
 *
 * Pure sampling: takes abstract held/pointer/action state (no Phaser) and
 * returns intent. GameScene binds hardware from {@link DEFAULT_KEY_BINDINGS}
 * (the rebind seam) and samples those keys into this module.
 *
 * Default bindings match the migration-plan fixed controls. Rebinding UI is
 * out of scope, but swapping this table (or pointing the scene at another)
 * is how a future rebind would work — gameplay never sees key codes.
 */

import { createPlayerIntent, type PlayerIntent } from './playerIntent';

/**
 * One keyboard binding: numeric code for `keyboard.addKey`, plus the Phaser
 * `keydown-${event}` suffix used for edge-triggered handlers.
 *
 * Codes match `Phaser.Input.Keyboard.KeyCodes` (Phaser 4) so the scene can
 * call `addKey(binding.code)` without hardcoding CTRL/SHIFT/arrows.
 */
export type KeyBinding = {
  code: number;
  event: string;
};

/** Phaser KeyCodes.LEFT / UP / RIGHT / DOWN / CTRL / SHIFT / Q / E / 0–9. */
const PHASER = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  CTRL: 17,
  SHIFT: 16,
  Q: 81,
  E: 69,
  ZERO: 48,
  ONE: 49,
  TWO: 50,
  THREE: 51,
  FOUR: 52,
  FIVE: 53,
  SIX: 54,
  SEVEN: 55,
  EIGHT: 56,
  NINE: 57,
} as const;

const WEAPON_DIGIT_EVENTS = [
  'ZERO',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
] as const;

/**
 * Fixed default controls — single source of truth for GameScene key binding.
 * Change a slot here and the shipped keyboard mapping changes with it.
 */
export const DEFAULT_KEY_BINDINGS = {
  left: { code: PHASER.LEFT, event: 'LEFT' } satisfies KeyBinding,
  right: { code: PHASER.RIGHT, event: 'RIGHT' } satisfies KeyBinding,
  jump: { code: PHASER.UP, event: 'UP' } satisfies KeyBinding,
  duck: { code: PHASER.DOWN, event: 'DOWN' } satisfies KeyBinding,
  boost: { code: PHASER.CTRL, event: 'CTRL' } satisfies KeyBinding,
  bulletTime: { code: PHASER.SHIFT, event: 'SHIFT' } satisfies KeyBinding,
  prevWeapon: { code: PHASER.Q, event: 'Q' } satisfies KeyBinding,
  nextWeapon: { code: PHASER.E, event: 'E' } satisfies KeyBinding,
  /**
   * Digit 0–9 → Phaser keydown event name (Flash number-key map).
   * Index is the digit; value is the `keydown-${name}` suffix.
   */
  weaponDigitEvents: WEAPON_DIGIT_EVENTS,
  /** Digits accepted by {@link queueWeaponDigit}. */
  weaponDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const,
  /** Primary mouse button aims + fires while held. */
  fire: 'MousePrimary',
  /**
   * Mouse wheel weapon cycle (#104).
   * Positive `deltaY` (wheel down) → nextWeapon; negative (wheel up) → prevWeapon.
   * Same inventory rules as Q/E (empty-slot skip, no predator, PredatorMode lock).
   */
  wheelWeapon: {
    /** Sign of WheelEvent.deltaY that queues nextWeapon. */
    nextDeltaYSign: 1,
  },
} as const;

/** Phaser `keydown-…` suffix for weapon digit 0–9. */
export function weaponDigitKeydownEvent(digit: number): string {
  const event = DEFAULT_KEY_BINDINGS.weaponDigitEvents[digit];
  if (event === undefined) {
    throw new Error(`weapon digit out of range: ${digit}`);
  }
  return event;
}

/** Level-triggered keys after the adapter has applied {@link DEFAULT_KEY_BINDINGS}. */
export type KeyboardHeldSample = {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  boost: boolean;
  bulletTime: boolean;
};

/** Pointer sample in arena / world space. */
export type PointerSample = {
  aimX: number;
  aimY: number;
  /** Primary button down (Flash `mouseD`). */
  primaryDown: boolean;
  /** Right button — never fires. */
  rightDown: boolean;
};

/**
 * Edge-triggered weapon actions queued between frames (keydown).
 * Drained once per sample so each press applies at most once.
 */
export type IntentActionBuffer = {
  selectWeaponDigit: number | null;
  prevWeapon: boolean;
  nextWeapon: boolean;
};

export function createIntentActionBuffer(): IntentActionBuffer {
  return {
    selectWeaponDigit: null,
    prevWeapon: false,
    nextWeapon: false,
  };
}

/** Queue a digit weapon select (0–9). Last press this frame wins. */
export function queueWeaponDigit(
  buffer: IntentActionBuffer,
  digit: number,
): void {
  if (digit < 0 || digit > 9) {
    return;
  }
  buffer.selectWeaponDigit = digit;
}

export function queuePrevWeapon(buffer: IntentActionBuffer): void {
  buffer.prevWeapon = true;
}

export function queueNextWeapon(buffer: IntentActionBuffer): void {
  buffer.nextWeapon = true;
}

/**
 * Queue prev/next weapon from a mouse-wheel `deltaY` (#104).
 *
 * Mapping (documented in {@link DEFAULT_KEY_BINDINGS.wheelWeapon}):
 * - `deltaY > 0` (wheel down) → {@link queueNextWeapon}
 * - `deltaY < 0` (wheel up) → {@link queuePrevWeapon}
 * - `deltaY === 0` → no-op
 *
 * Inventory rules (empty slots, predator skip, PredatorMode) are applied later
 * when intent is applied via the same path as Q/E.
 */
export function queueWeaponFromWheelDelta(
  buffer: IntentActionBuffer,
  deltaY: number,
): void {
  if (deltaY > 0) {
    queueNextWeapon(buffer);
  } else if (deltaY < 0) {
    queuePrevWeapon(buffer);
  }
}

/**
 * Wheel listeners on the game canvas must use `{ passive: false }` and call
 * `preventDefault` so page scroll does not fight weapon cycling (#104).
 */
export function shouldPreventGameWheelDefault(): boolean {
  return true;
}

/** Take and clear one-shot actions. */
export function drainIntentActions(
  buffer: IntentActionBuffer,
): Pick<PlayerIntent, 'selectWeaponDigit' | 'prevWeapon' | 'nextWeapon'> {
  const actions = {
    selectWeaponDigit: buffer.selectWeaponDigit,
    prevWeapon: buffer.prevWeapon,
    nextWeapon: buffer.nextWeapon,
  };
  buffer.selectWeaponDigit = null;
  buffer.prevWeapon = false;
  buffer.nextWeapon = false;
  return actions;
}

export type KeyboardMouseSample = {
  held: KeyboardHeldSample;
  pointer: PointerSample;
  actions: IntentActionBuffer;
  /**
   * When false, fire is forced off (not playing, debug-box drag, etc.).
   * Aim / movement still update so the gun tracks the cursor.
   */
  allowFire: boolean;
};

/**
 * Build player intent from a keyboard+mouse sample using the default
 * semantic slots (bindings table is the hardware mapping).
 */
export function sampleKeyboardMouseIntent(
  sample: KeyboardMouseSample,
): PlayerIntent {
  const actions = drainIntentActions(sample.actions);
  const intent = createPlayerIntent(sample.pointer.aimX, sample.pointer.aimY);
  intent.left = sample.held.left;
  intent.right = sample.held.right;
  intent.jump = sample.held.jump;
  intent.duck = sample.held.duck;
  intent.boost = sample.held.boost;
  intent.bulletTime = sample.held.bulletTime;
  intent.fire =
    sample.allowFire && sample.pointer.primaryDown && !sample.pointer.rightDown;
  intent.selectWeaponDigit = actions.selectWeaponDigit;
  intent.prevWeapon = actions.prevWeapon;
  intent.nextWeapon = actions.nextWeapon;
  return intent;
}
