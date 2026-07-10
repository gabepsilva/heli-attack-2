/**
 * Keyboard + mouse → {@link PlayerIntent} — issue #29.
 *
 * Pure sampling: takes abstract held/pointer/action state (no Phaser) and
 * returns intent. GameScene (or a future adapter) is responsible for reading
 * Phaser keys/pointers into that sample.
 *
 * Default bindings match the migration-plan fixed controls. The bindings
 * table is the seam for a future rebind UI — gameplay never sees key codes.
 */

import { createPlayerIntent, type PlayerIntent } from './playerIntent';

/**
 * Fixed default controls (rebinding out of scope; table kept for later).
 * Values are human-readable labels, not Phaser key codes — adapters map
 * hardware onto the semantic slots below.
 */
export const DEFAULT_KEY_BINDINGS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  duck: 'ArrowDown',
  boost: 'Control',
  bulletTime: 'Shift',
  prevWeapon: 'KeyQ',
  nextWeapon: 'KeyE',
  /** Digits 0–9 select weapons (Flash number-key map). */
  weaponDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const,
  /** Primary mouse button aims + fires while held. */
  fire: 'MousePrimary',
} as const;

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
 * semantic slots (bindings table documents the hardware mapping).
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
