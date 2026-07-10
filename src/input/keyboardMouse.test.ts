/**
 * Keyboard/mouse source — unit tests for issue #29.
 * Pins default bindings (the GameScene key-binding source of truth) and
 * the sample → intent mapping (unchanged controls).
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
  weaponDigitKeydownEvent,
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
  it('pins DEFAULT_KEY_BINDINGS to the shipped keyboard/mouse controls', () => {
    // GameScene binds via these codes/events — changing a slot here changes
    // what the player presses. Codes match Phaser.Input.Keyboard.KeyCodes.
    expect(DEFAULT_KEY_BINDINGS.left).toEqual({ code: 37, event: 'LEFT' });
    expect(DEFAULT_KEY_BINDINGS.right).toEqual({ code: 39, event: 'RIGHT' });
    expect(DEFAULT_KEY_BINDINGS.jump).toEqual({ code: 38, event: 'UP' });
    expect(DEFAULT_KEY_BINDINGS.duck).toEqual({ code: 40, event: 'DOWN' });
    expect(DEFAULT_KEY_BINDINGS.boost).toEqual({ code: 17, event: 'CTRL' });
    expect(DEFAULT_KEY_BINDINGS.bulletTime).toEqual({
      code: 16,
      event: 'SHIFT',
    });
    expect(DEFAULT_KEY_BINDINGS.prevWeapon).toEqual({ code: 81, event: 'Q' });
    expect(DEFAULT_KEY_BINDINGS.nextWeapon).toEqual({ code: 69, event: 'E' });
    expect(DEFAULT_KEY_BINDINGS.fire).toBe('MousePrimary');
    expect([...DEFAULT_KEY_BINDINGS.weaponDigits]).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect([...DEFAULT_KEY_BINDINGS.weaponDigitEvents]).toEqual([
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
    ]);
  });

  it('weaponDigitKeydownEvent maps each digit to the Phaser keydown suffix', () => {
    expect(weaponDigitKeydownEvent(0)).toBe('ZERO');
    expect(weaponDigitKeydownEvent(1)).toBe('ONE');
    expect(weaponDigitKeydownEvent(9)).toBe('NINE');
    expect(() => weaponDigitKeydownEvent(10)).toThrow(/out of range/);
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
