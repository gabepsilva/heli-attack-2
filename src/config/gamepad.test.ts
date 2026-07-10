/**
 * Gamepad config — unit tests for issue #31.
 * Pins Standard Gamepad indices, default bindings, and sampler thresholds.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_AIM_RANGE_PX,
  GAMEPAD_DEADZONE,
  STANDARD_GAMEPAD,
} from './gamepad';

describe('gamepad config (issue #31)', () => {
  it('locks sampler thresholds to the shipped values', () => {
    expect(GAMEPAD_DEADZONE).toBe(0.25);
    expect(GAMEPAD_AIM_RANGE_PX).toBe(400);
  });

  it('pins Standard Gamepad button indices (W3C / Xbox / Steam)', () => {
    expect(STANDARD_GAMEPAD.A).toBe(0);
    expect(STANDARD_GAMEPAD.B).toBe(1);
    expect(STANDARD_GAMEPAD.X).toBe(2);
    expect(STANDARD_GAMEPAD.Y).toBe(3);
    expect(STANDARD_GAMEPAD.LB).toBe(4);
    expect(STANDARD_GAMEPAD.RB).toBe(5);
    expect(STANDARD_GAMEPAD.LT).toBe(6);
    expect(STANDARD_GAMEPAD.RT).toBe(7);
    expect(STANDARD_GAMEPAD.DPAD_UP).toBe(12);
    expect(STANDARD_GAMEPAD.DPAD_DOWN).toBe(13);
    expect(STANDARD_GAMEPAD.DPAD_LEFT).toBe(14);
    expect(STANDARD_GAMEPAD.DPAD_RIGHT).toBe(15);
  });

  it('pins DEFAULT_GAMEPAD_BINDINGS to the Steam-ready twin-stick map', () => {
    // GameScene / sampler semantics follow this table — changing a slot here
    // changes what the player presses on a Standard Gamepad.
    expect(DEFAULT_GAMEPAD_BINDINGS.moveStick).toBe('left');
    expect(DEFAULT_GAMEPAD_BINDINGS.aimStick).toBe('right');
    expect(DEFAULT_GAMEPAD_BINDINGS.jump).toBe(STANDARD_GAMEPAD.A);
    expect(DEFAULT_GAMEPAD_BINDINGS.boost).toBe(STANDARD_GAMEPAD.B);
    expect(DEFAULT_GAMEPAD_BINDINGS.bulletTime).toBe(STANDARD_GAMEPAD.X);
    expect(DEFAULT_GAMEPAD_BINDINGS.prevWeapon).toBe(STANDARD_GAMEPAD.LB);
    expect(DEFAULT_GAMEPAD_BINDINGS.nextWeapon).toBe(STANDARD_GAMEPAD.RB);
    expect(DEFAULT_GAMEPAD_BINDINGS.fire).toBe(STANDARD_GAMEPAD.RT);
    expect(DEFAULT_GAMEPAD_BINDINGS.dpadLeft).toBe(STANDARD_GAMEPAD.DPAD_LEFT);
    expect(DEFAULT_GAMEPAD_BINDINGS.dpadRight).toBe(
      STANDARD_GAMEPAD.DPAD_RIGHT,
    );
    expect(DEFAULT_GAMEPAD_BINDINGS.dpadDown).toBe(STANDARD_GAMEPAD.DPAD_DOWN);
    expect(DEFAULT_GAMEPAD_BINDINGS.dpadUp).toBe(STANDARD_GAMEPAD.DPAD_UP);
  });
});
