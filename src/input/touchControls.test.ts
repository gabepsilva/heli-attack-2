/**
 * Touch → intent — unit tests for issue #30.
 * Asserts joystick / aim-fire / button mapping and merge with keyboard intent.
 */

import { describe, expect, it } from 'vitest';
import {
  createWeaponInventory,
  getActiveWeaponDef,
} from '../combat/weaponInventory';
import { TOUCH_AIM_RANGE_PX, TOUCH_DEADZONE } from '../config/touch';
import { SimSession } from '../core/simSession';
import { applyPlayerIntent, createPlayerIntent } from './playerIntent';
import {
  mergePlayerIntents,
  sampleTouchIntent,
  stickActive,
  type TouchAimOrigin,
  type TouchControlSample,
} from './touchControls';

function origin(overrides: Partial<TouchAimOrigin> = {}): TouchAimOrigin {
  return { x: 100, y: 200, w: 10, h: 42, ...overrides };
}

function sample(
  overrides: Partial<TouchControlSample> = {},
): TouchControlSample {
  return {
    moveX: 0,
    moveY: 0,
    aimStickX: 0,
    aimStickY: 0,
    jump: false,
    boost: false,
    bulletTime: false,
    prevWeapon: false,
    nextWeapon: false,
    allowFire: true,
    ...overrides,
  };
}

describe('touchControls sampler (issue #30)', () => {
  it('pins deadzone and aim-range constants used by the sampler', () => {
    expect(TOUCH_DEADZONE).toBe(0.25);
    expect(TOUCH_AIM_RANGE_PX).toBe(400);
  });

  it('stickActive is false inside the deadzone and true outside', () => {
    expect(stickActive(0, 0)).toBe(false);
    expect(stickActive(TOUCH_DEADZONE - 0.01, 0)).toBe(false);
    expect(stickActive(TOUCH_DEADZONE, 0)).toBe(true);
    expect(stickActive(0, -TOUCH_DEADZONE)).toBe(true);
    expect(stickActive(0.2, 0.2)).toBe(true); // hypot ≈ 0.283
  });

  it('maps move stick X to left/right and Y-down to duck (AC: joystick move)', () => {
    const left = sampleTouchIntent(sample({ moveX: -1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(left.left).toBe(true);
    expect(left.right).toBe(false);
    expect(left.duck).toBe(false);

    const right = sampleTouchIntent(sample({ moveX: 1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(right.right).toBe(true);
    expect(right.left).toBe(false);

    const duck = sampleTouchIntent(sample({ moveY: 1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(duck.duck).toBe(true);

    const idle = sampleTouchIntent(
      sample({ moveX: TOUCH_DEADZONE - 0.05, moveY: TOUCH_DEADZONE - 0.05 }),
      origin(),
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(idle.left).toBe(false);
    expect(idle.right).toBe(false);
    expect(idle.duck).toBe(false);
  });

  it('maps jump / boost / bullet-time / switch buttons onto intent (AC)', () => {
    const intent = sampleTouchIntent(
      sample({
        jump: true,
        boost: true,
        bulletTime: true,
        prevWeapon: true,
        nextWeapon: true,
      }),
      origin(),
      { fallbackAimX: 50, fallbackAimY: 60 },
    );
    expect(intent.jump).toBe(true);
    expect(intent.boost).toBe(true);
    expect(intent.bulletTime).toBe(true);
    expect(intent.prevWeapon).toBe(true);
    expect(intent.nextWeapon).toBe(true);
    expect(intent.aimX).toBe(50);
    expect(intent.aimY).toBe(60);
    expect(intent.fire).toBe(false);
  });

  it('aim stick outside deadzone aims from player center and fires (AC: aim/fire)', () => {
    const body = origin({ x: 100, y: 200, w: 10, h: 42 });
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;

    const intent = sampleTouchIntent(
      sample({ aimStickX: 1, aimStickY: 0 }),
      body,
      { fallbackAimX: 0, fallbackAimY: 0 },
    );

    expect(intent.aimX).toBe(cx + TOUCH_AIM_RANGE_PX);
    expect(intent.aimY).toBe(cy);
    expect(intent.fire).toBe(true);

    const downLeft = sampleTouchIntent(
      sample({ aimStickX: -0.5, aimStickY: 0.5 }),
      body,
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(downLeft.aimX).toBe(cx + -0.5 * TOUCH_AIM_RANGE_PX);
    expect(downLeft.aimY).toBe(cy + 0.5 * TOUCH_AIM_RANGE_PX);
    expect(downLeft.fire).toBe(true);
  });

  it('does not fire when allowFire is false even while aiming', () => {
    const intent = sampleTouchIntent(
      sample({ aimStickX: 1, aimStickY: 0, allowFire: false }),
      origin(),
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(intent.fire).toBe(false);
    // Aim still updates so the gun tracks the stick.
    expect(intent.aimX).toBeGreaterThan(0);
  });

  it('keeps fallback aim and no fire when the aim stick is inside the deadzone', () => {
    const intent = sampleTouchIntent(
      sample({ aimStickX: 0.1, aimStickY: 0.1 }),
      origin(),
      { fallbackAimX: 320, fallbackAimY: 180 },
    );
    expect(intent.aimX).toBe(320);
    expect(intent.aimY).toBe(180);
    expect(intent.fire).toBe(false);
  });

  it('mergePlayerIntents ORs held flags and prefers secondary aim when active', () => {
    const keyboard = createPlayerIntent(10, 20);
    keyboard.left = true;
    keyboard.fire = true;
    keyboard.selectWeaponDigit = 3;

    const touch = createPlayerIntent(900, 400);
    touch.right = true;
    touch.jump = true;
    touch.nextWeapon = true;
    touch.fire = true;

    const merged = mergePlayerIntents(keyboard, touch, {
      preferSecondaryAim: true,
    });
    expect(merged.left).toBe(true);
    expect(merged.right).toBe(true);
    expect(merged.jump).toBe(true);
    expect(merged.fire).toBe(true);
    expect(merged.aimX).toBe(900);
    expect(merged.aimY).toBe(400);
    expect(merged.selectWeaponDigit).toBe(3);
    expect(merged.nextWeapon).toBe(true);

    const kbAim = mergePlayerIntents(keyboard, touch, {
      preferSecondaryAim: false,
    });
    expect(kbAim.aimX).toBe(10);
    expect(kbAim.aimY).toBe(20);
  });

  it('touch sample → applyPlayerIntent drives a full control set (AC: session via touch)', () => {
    // Acceptance: every gameplay action needed for a run is reachable from touch.
    const session = new SimSession();
    session.inventory = createWeaponInventory({ testGrant: true });
    const body = session.player.body;
    const intent = sampleTouchIntent(
      sample({
        moveX: 1,
        moveY: 1,
        aimStickX: 1,
        aimStickY: 0,
        jump: true,
        boost: true,
        bulletTime: true,
        nextWeapon: true,
        allowFire: true,
      }),
      { x: body.x, y: body.y, w: body.w, h: body.h },
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    applyPlayerIntent(session, intent);

    expect(session.player.input.right).toBe(true);
    expect(session.player.input.duck).toBe(true);
    expect(session.player.input.jump).toBe(true);
    expect(session.player.input.boost).toBe(true);
    expect(session.fireHeld).toBe(true);
    expect(session.bulletTimeHeld).toBe(true);
    expect(session.player.mouse.x).toBe(
      body.x + body.w / 2 + TOUCH_AIM_RANGE_PX,
    );
    // nextWeapon from MachineGun → AkimboMac10 (with test arsenal)
    expect(getActiveWeaponDef(session.inventory).name).toBe('AkimboMac10');
  });
});
