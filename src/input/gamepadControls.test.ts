/**
 * Gamepad → intent — unit tests for issue #31.
 * Asserts stick/button mapping, hotplug fallback, and a full control session.
 */

import { describe, expect, it } from 'vitest';
import { getActiveWeaponDef } from '../combat/weaponInventory';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_AIM_RANGE_PX,
  GAMEPAD_DEADZONE,
  STANDARD_GAMEPAD,
} from '../config/gamepad';
import { SimSession } from '../core/simSession';
import {
  advanceGamepadWeaponEdges,
  applyGamepadHotplugEvent,
  createGamepadHotplugState,
  createGamepadWeaponEdgeState,
  findConnectedPadIndex,
  gamepadStickActive,
  isGamepadConnected,
  sampleGamepadIntent,
  syncGamepadHotplugFromPads,
  type GamepadAimOrigin,
  type GamepadControlSample,
} from './gamepadControls';
import { applyPlayerIntent, mergePlayerIntents } from './playerIntent';

function origin(overrides: Partial<GamepadAimOrigin> = {}): GamepadAimOrigin {
  return { x: 100, y: 200, w: 10, h: 42, ...overrides };
}

function sample(
  overrides: Partial<GamepadControlSample> = {},
): GamepadControlSample {
  return {
    moveX: 0,
    moveY: 0,
    aimStickX: 0,
    aimStickY: 0,
    jump: false,
    boost: false,
    bulletTime: false,
    fire: false,
    dpadLeft: false,
    dpadRight: false,
    dpadDown: false,
    dpadUp: false,
    prevWeapon: false,
    nextWeapon: false,
    allowFire: true,
    ...overrides,
  };
}

describe('gamepadControls sampler (issue #31)', () => {
  it('pins deadzone / aim-range / bindings used by the sampler', () => {
    expect(GAMEPAD_DEADZONE).toBe(0.25);
    expect(GAMEPAD_AIM_RANGE_PX).toBe(400);
    expect(DEFAULT_GAMEPAD_BINDINGS.fire).toBe(STANDARD_GAMEPAD.RT);
    expect(DEFAULT_GAMEPAD_BINDINGS.jump).toBe(STANDARD_GAMEPAD.A);
  });

  it('gamepadStickActive is false inside the deadzone and true outside', () => {
    expect(gamepadStickActive(0, 0)).toBe(false);
    expect(gamepadStickActive(GAMEPAD_DEADZONE - 0.01, 0)).toBe(false);
    expect(gamepadStickActive(GAMEPAD_DEADZONE, 0)).toBe(true);
    expect(gamepadStickActive(0, -GAMEPAD_DEADZONE)).toBe(true);
    expect(gamepadStickActive(0.2, 0.2)).toBe(true); // hypot ≈ 0.283
  });

  it('maps left stick X to left/right and Y-down to duck (AC: stick move)', () => {
    const left = sampleGamepadIntent(sample({ moveX: -1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(left.left).toBe(true);
    expect(left.right).toBe(false);
    expect(left.duck).toBe(false);

    const right = sampleGamepadIntent(sample({ moveX: 1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(right.right).toBe(true);
    expect(right.left).toBe(false);

    const duck = sampleGamepadIntent(sample({ moveY: 1 }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(duck.duck).toBe(true);

    const idle = sampleGamepadIntent(
      sample({
        moveX: GAMEPAD_DEADZONE - 0.05,
        moveY: GAMEPAD_DEADZONE - 0.05,
      }),
      origin(),
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(idle.left).toBe(false);
    expect(idle.right).toBe(false);
    expect(idle.duck).toBe(false);
  });

  it('maps D-pad onto move / duck / jump alongside the stick', () => {
    const left = sampleGamepadIntent(sample({ dpadLeft: true }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(left.left).toBe(true);

    const jump = sampleGamepadIntent(sample({ dpadUp: true }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(jump.jump).toBe(true);

    const duck = sampleGamepadIntent(sample({ dpadDown: true }), origin(), {
      fallbackAimX: 0,
      fallbackAimY: 0,
    });
    expect(duck.duck).toBe(true);
  });

  it('maps fire / jump / boost / bullet-time / switch buttons onto intent (AC)', () => {
    const intent = sampleGamepadIntent(
      sample({
        jump: true,
        boost: true,
        bulletTime: true,
        fire: true,
        prevWeapon: true,
        nextWeapon: true,
      }),
      origin(),
      { fallbackAimX: 50, fallbackAimY: 60 },
    );
    expect(intent.jump).toBe(true);
    expect(intent.boost).toBe(true);
    expect(intent.bulletTime).toBe(true);
    expect(intent.fire).toBe(true);
    expect(intent.prevWeapon).toBe(true);
    expect(intent.nextWeapon).toBe(true);
    expect(intent.aimX).toBe(50);
    expect(intent.aimY).toBe(60);
  });

  it('right stick outside deadzone aims from player center (AC: stick aim)', () => {
    const body = origin({ x: 100, y: 200, w: 10, h: 42 });
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;

    const intent = sampleGamepadIntent(
      sample({ aimStickX: 1, aimStickY: 0 }),
      body,
      { fallbackAimX: 0, fallbackAimY: 0 },
    );

    expect(intent.aimX).toBe(cx + GAMEPAD_AIM_RANGE_PX);
    expect(intent.aimY).toBe(cy);
    // Fire is a button (RT), not stick deflection.
    expect(intent.fire).toBe(false);

    const downLeft = sampleGamepadIntent(
      sample({ aimStickX: -0.5, aimStickY: 0.5, fire: true }),
      body,
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(downLeft.aimX).toBe(cx + -0.5 * GAMEPAD_AIM_RANGE_PX);
    expect(downLeft.aimY).toBe(cy + 0.5 * GAMEPAD_AIM_RANGE_PX);
    expect(downLeft.fire).toBe(true);
  });

  it('does not fire when allowFire is false even while RT is held', () => {
    const intent = sampleGamepadIntent(
      sample({ fire: true, allowFire: false }),
      origin(),
      { fallbackAimX: 0, fallbackAimY: 0 },
    );
    expect(intent.fire).toBe(false);
  });

  it('keeps fallback aim when the right stick is inside the deadzone', () => {
    const intent = sampleGamepadIntent(
      sample({ aimStickX: 0.1, aimStickY: 0.1 }),
      origin(),
      { fallbackAimX: 320, fallbackAimY: 180 },
    );
    expect(intent.aimX).toBe(320);
    expect(intent.aimY).toBe(180);
  });

  it('advanceGamepadWeaponEdges fires once per press (not while held)', () => {
    const edges = createGamepadWeaponEdgeState();
    const first = advanceGamepadWeaponEdges(edges, {
      prevWeapon: true,
      nextWeapon: true,
    });
    expect(first.prevWeapon).toBe(true);
    expect(first.nextWeapon).toBe(true);

    const held = advanceGamepadWeaponEdges(edges, {
      prevWeapon: true,
      nextWeapon: true,
    });
    expect(held.prevWeapon).toBe(false);
    expect(held.nextWeapon).toBe(false);

    advanceGamepadWeaponEdges(edges, { prevWeapon: false, nextWeapon: false });
    const again = advanceGamepadWeaponEdges(edges, {
      prevWeapon: true,
      nextWeapon: false,
    });
    expect(again.prevWeapon).toBe(true);
    expect(again.nextWeapon).toBe(false);
  });

  it('hotplug: connect then disconnect clears pad (AC: unplug → keyboard)', () => {
    let state = createGamepadHotplugState();
    expect(isGamepadConnected(state)).toBe(false);

    state = applyGamepadHotplugEvent(state, {
      type: 'connected',
      index: 0,
    });
    expect(isGamepadConnected(state)).toBe(true);
    expect(state.padIndex).toBe(0);

    state = applyGamepadHotplugEvent(state, {
      type: 'disconnected',
      index: 0,
    });
    expect(isGamepadConnected(state)).toBe(false);
    expect(state.padIndex).toBeNull();

    // Disconnect of a different pad does not clear the active one.
    state = applyGamepadHotplugEvent(state, {
      type: 'connected',
      index: 1,
    });
    state = applyGamepadHotplugEvent(state, {
      type: 'disconnected',
      index: 0,
    });
    expect(isGamepadConnected(state)).toBe(true);
    expect(state.padIndex).toBe(1);
  });

  it('syncGamepadHotplugFromPads picks an already-connected pad and clears when empty', () => {
    let state = createGamepadHotplugState();
    state = syncGamepadHotplugFromPads(state, [
      null,
      { index: 1, connected: true },
    ]);
    expect(state).toEqual({ connected: true, padIndex: 1 });
    expect(findConnectedPadIndex([{ index: 0 }, null])).toBe(0);

    state = syncGamepadHotplugFromPads(state, [null, null]);
    expect(isGamepadConnected(state)).toBe(false);
  });

  it('syncGamepadHotplugFromPads re-marks connected when the same pad is still present', () => {
    // padIndex set but connected=false (e.g. mid-sync) → revive without switching.
    const revived = syncGamepadHotplugFromPads(
      { connected: false, padIndex: 2 },
      [{ index: 2, connected: true }],
    );
    expect(revived).toEqual({ connected: true, padIndex: 2 });

    // Same pad still present and already connected → identity.
    const same = syncGamepadHotplugFromPads(revived, [
      { index: 2, connected: true },
      { index: 0, connected: true },
    ]);
    expect(same).toBe(revived);
  });

  it('merge prefers gamepad aim while the right stick is live', () => {
    const keyboard = {
      left: true,
      right: false,
      jump: false,
      duck: false,
      boost: false,
      bulletTime: false,
      fire: false,
      aimX: 10,
      aimY: 20,
      selectWeaponDigit: null,
      prevWeapon: false,
      nextWeapon: false,
    };
    const pad = sampleGamepadIntent(
      sample({ aimStickX: 1, aimStickY: 0 }),
      origin({ x: 0, y: 0, w: 0, h: 0 }),
      { fallbackAimX: 10, fallbackAimY: 20 },
    );
    const merged = mergePlayerIntents(keyboard, pad, {
      preferSecondaryAim: true,
    });
    expect(merged.aimX).toBe(GAMEPAD_AIM_RANGE_PX);
    expect(merged.left).toBe(true);
  });

  it('gamepad sample → applyPlayerIntent drives a full control set (AC: session via controller)', () => {
    // Acceptance: every gameplay action needed for a run is reachable from pad.
    const session = new SimSession();
    const body = session.player.body;
    const intent = sampleGamepadIntent(
      sample({
        moveX: 1,
        moveY: 1,
        aimStickX: 1,
        aimStickY: 0,
        jump: true,
        boost: true,
        bulletTime: true,
        fire: true,
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
      body.x + body.w / 2 + GAMEPAD_AIM_RANGE_PX,
    );
    // nextWeapon from MachineGun → AkimboMac10
    expect(getActiveWeaponDef(session.inventory).name).toBe('AkimboMac10');
  });

  it('after unplug, only keyboard intent remains (AC: clean keyboard fallback)', () => {
    let hotplug = createGamepadHotplugState();
    hotplug = applyGamepadHotplugEvent(hotplug, {
      type: 'connected',
      index: 0,
    });

    const keyboard = sampleGamepadIntent(sample({ moveX: 0 }), origin(), {
      fallbackAimX: 100,
      fallbackAimY: 200,
    });
    // Simulate keyboard-only left via a synthetic primary intent.
    const kbOnly = {
      ...keyboard,
      left: true,
      aimX: 100,
      aimY: 200,
    };

    const padIntent = sampleGamepadIntent(
      sample({ moveX: 1, fire: true, aimStickX: 1 }),
      origin(),
      { fallbackAimX: 100, fallbackAimY: 200 },
    );

    // While connected, merge includes pad.
    expect(isGamepadConnected(hotplug)).toBe(true);
    const withPad = mergePlayerIntents(kbOnly, padIntent, {
      preferSecondaryAim: gamepadStickActive(1, 0),
    });
    expect(withPad.right).toBe(true);
    expect(withPad.fire).toBe(true);
    expect(withPad.aimX).toBeGreaterThan(100);

    // Unplug → do not merge pad; keyboard alone.
    hotplug = applyGamepadHotplugEvent(hotplug, {
      type: 'disconnected',
      index: 0,
    });
    expect(isGamepadConnected(hotplug)).toBe(false);
    const afterUnplug = isGamepadConnected(hotplug)
      ? mergePlayerIntents(kbOnly, padIntent, { preferSecondaryAim: true })
      : kbOnly;
    expect(afterUnplug.right).toBe(false);
    expect(afterUnplug.left).toBe(true);
    expect(afterUnplug.fire).toBe(false);
    expect(afterUnplug.aimX).toBe(100);
  });
});
