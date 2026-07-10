/**
 * Keyboard/mouse source — unit tests for issue #29.
 * Pins default bindings and the sample → intent mapping (unchanged controls).
 */

import { describe, expect, it } from 'vitest';
import {
  createIntentActionBuffer,
  DEFAULT_KEY_BINDINGS,
  drainIntentActions,
  queueNextWeapon,
  queuePrevWeapon,
  queueWeaponDigit,
  sampleKeyboardMouseIntent,
  type KeyboardHeldSample,
  type PointerSample,
} from './keyboardMouse';

function held(overrides: Partial<KeyboardHeldSample> = {}): KeyboardHeldSample {
  return {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
    bulletTime: false,
    ...overrides,
  };
}

function pointer(overrides: Partial<PointerSample> = {}): PointerSample {
  return {
    aimX: 100,
    aimY: 200,
    primaryDown: false,
    rightDown: false,
    ...overrides,
  };
}

describe('keyboardMouse source (issue #29)', () => {
  it('documents the fixed default bindings from the migration plan', () => {
    // Rebinding is out of scope, but this table is the future rebind seam.
    expect(DEFAULT_KEY_BINDINGS).toEqual({
      left: 'ArrowLeft',
      right: 'ArrowRight',
      jump: 'ArrowUp',
      duck: 'ArrowDown',
      boost: 'Control',
      bulletTime: 'Shift',
      prevWeapon: 'KeyQ',
      nextWeapon: 'KeyE',
      weaponDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      fire: 'MousePrimary',
    });
  });

  it('maps held move / jump / duck / boost / bullet-time slots onto intent', () => {
    const intent = sampleKeyboardMouseIntent({
      held: held({
        left: true,
        right: true,
        jump: true,
        duck: true,
        boost: true,
        bulletTime: true,
      }),
      pointer: pointer({ aimX: 320, aimY: 180 }),
      actions: createIntentActionBuffer(),
      allowFire: true,
    });

    expect(intent.left).toBe(true);
    expect(intent.right).toBe(true);
    expect(intent.jump).toBe(true);
    expect(intent.duck).toBe(true);
    expect(intent.boost).toBe(true);
    expect(intent.bulletTime).toBe(true);
    expect(intent.aimX).toBe(320);
    expect(intent.aimY).toBe(180);
    expect(intent.fire).toBe(false);
    expect(intent.selectWeaponDigit).toBeNull();
    expect(intent.prevWeapon).toBe(false);
    expect(intent.nextWeapon).toBe(false);
  });

  it('fires only when primary is down, right is up, and allowFire is true', () => {
    const actions = createIntentActionBuffer();

    expect(
      sampleKeyboardMouseIntent({
        held: held(),
        pointer: pointer({ primaryDown: true }),
        actions,
        allowFire: true,
      }).fire,
    ).toBe(true);

    expect(
      sampleKeyboardMouseIntent({
        held: held(),
        pointer: pointer({ primaryDown: true, rightDown: true }),
        actions: createIntentActionBuffer(),
        allowFire: true,
      }).fire,
    ).toBe(false);

    expect(
      sampleKeyboardMouseIntent({
        held: held(),
        pointer: pointer({ primaryDown: true }),
        actions: createIntentActionBuffer(),
        allowFire: false,
      }).fire,
    ).toBe(false);
  });

  it('drains edge-triggered weapon actions once per sample (unchanged 1–0 / Q / E)', () => {
    const buffer = createIntentActionBuffer();
    queueWeaponDigit(buffer, 5);
    queuePrevWeapon(buffer);
    queueNextWeapon(buffer);

    const intent = sampleKeyboardMouseIntent({
      held: held(),
      pointer: pointer(),
      actions: buffer,
      allowFire: true,
    });

    expect(intent.selectWeaponDigit).toBe(5);
    expect(intent.prevWeapon).toBe(true);
    expect(intent.nextWeapon).toBe(true);

    // Buffer is cleared — a second sample must not re-fire the same press.
    const again = sampleKeyboardMouseIntent({
      held: held(),
      pointer: pointer(),
      actions: buffer,
      allowFire: true,
    });
    expect(again.selectWeaponDigit).toBeNull();
    expect(again.prevWeapon).toBe(false);
    expect(again.nextWeapon).toBe(false);
  });

  it('queueWeaponDigit ignores out-of-range digits and keeps last valid press', () => {
    const buffer = createIntentActionBuffer();
    queueWeaponDigit(buffer, 3);
    queueWeaponDigit(buffer, 99);
    expect(drainIntentActions(buffer).selectWeaponDigit).toBe(3);

    queueWeaponDigit(buffer, -1);
    expect(drainIntentActions(buffer).selectWeaponDigit).toBeNull();
  });

  it('accepts every default weapon digit 0–9 into the action buffer', () => {
    for (const digit of DEFAULT_KEY_BINDINGS.weaponDigits) {
      const buffer = createIntentActionBuffer();
      queueWeaponDigit(buffer, digit);
      expect(drainIntentActions(buffer).selectWeaponDigit).toBe(digit);
    }
  });
});
