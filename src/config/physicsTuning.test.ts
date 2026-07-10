import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PLAYER,
  PLAYER_DEFAULTS,
  WORLD,
  WORLD_DEFAULTS,
  resetPhysicsConstants,
} from './constants';
import {
  TUNABLE_KEYS,
  applyTunablesFromSearch,
  getAllTunables,
  getTunable,
  getTunableDefault,
  isTunableKey,
  parseDebugOverlayVisible,
  resetTunables,
  setTunable,
} from './physicsTuning';
import { applyHorizontalWalk } from '../player/walkPhysics';
import { applyJumpInput, createJumpState } from '../player/jumpPhysics';
import { Player } from '../player/player';
import { createTestArena } from '../world/testArena';

describe('physicsTuning (issue #8)', () => {
  beforeEach(() => {
    resetPhysicsConstants();
  });

  afterEach(() => {
    resetPhysicsConstants();
  });

  it('exposes the gravity/jump/speed tunables with exact spec defaults', () => {
    expect(TUNABLE_KEYS).toEqual([
      'gravity',
      'terminal',
      'walkAccel',
      'walkCap',
      'hardCap',
      'friction',
      'jumpVel',
      'jumpHoldFrames',
      'boostVel',
      'boostChargeFrames',
    ]);
    expect(getTunableDefault('gravity')).toBe(WORLD_DEFAULTS.gravity);
    expect(getTunableDefault('jumpVel')).toBe(PLAYER_DEFAULTS.jumpVel);
    expect(getTunableDefault('walkCap')).toBe(PLAYER_DEFAULTS.walkCap);
    expect(getTunableDefault('boostVel')).toBe(PLAYER_DEFAULTS.boostVel);
    expect(getAllTunables()).toEqual({
      gravity: 1,
      terminal: 50,
      walkAccel: 1,
      walkCap: 5,
      hardCap: 6,
      friction: 1,
      jumpVel: -8,
      jumpHoldFrames: 6,
      boostVel: -32,
      boostChargeFrames: 150,
    });
  });

  it('editing a constant changes walk behavior with no reload (AC)', () => {
    expect(applyHorizontalWalk(0, { left: false, right: true })).toBe(1);

    setTunable('walkAccel', 3);
    setTunable('walkCap', 9);
    expect(WORLD.gravity).toBe(1); // unrelated keys untouched
    expect(PLAYER.walkAccel).toBe(3);
    expect(PLAYER.walkCap).toBe(9);

    // Same call site, new constants — no module reload.
    expect(applyHorizontalWalk(0, { left: false, right: true })).toBe(3);
    let vx = 0;
    for (let i = 0; i < 5; i += 1) {
      vx = applyHorizontalWalk(vx, { left: false, right: true });
    }
    expect(vx).toBe(9);
  });

  it('editing gravity changes player fall on the next sim tick (AC)', () => {
    const map = createTestArena();
    const player = new Player(100, 50);
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    setTunable('gravity', 5);
    expect(WORLD.gravity).toBe(5);

    player.step(map, 1);
    expect(player.body.vy).toBe(5);

    setTunable('gravity', 1);
    player.step(map, 1);
    expect(player.body.vy).toBe(6); // 5 + 1
  });

  it('editing jumpVel changes the hold clamp immediately (AC)', () => {
    const state = createJumpState();
    setTunable('jumpVel', -20);
    expect(PLAYER.jumpVel).toBe(-20);

    const vy = applyJumpInput(0, state, { jump: true, duck: false });
    expect(vy).toBe(-20);
  });

  it('resetTunables restores exact spec seeds', () => {
    setTunable('gravity', 9);
    setTunable('jumpVel', -99);
    setTunable('walkCap', 99);
    resetTunables();
    expect(WORLD).toEqual({ ...WORLD_DEFAULTS });
    expect(PLAYER.jumpVel).toBe(PLAYER_DEFAULTS.jumpVel);
    expect(PLAYER.walkCap).toBe(PLAYER_DEFAULTS.walkCap);
    expect(getTunable('gravity')).toBe(1);
  });

  it('applies query-param overrides without a reload', () => {
    const applied = applyTunablesFromSearch(
      '?gravity=2&jumpVel=-12&walkCap=8&bogus=1&jumpVel=nope',
    );
    // Unknown keys ignored; invalid numbers skipped; get() uses first value.
    expect(applied).toEqual(['gravity', 'walkCap', 'jumpVel']);
    expect(WORLD.gravity).toBe(2);
    expect(PLAYER.jumpVel).toBe(-12);
    expect(PLAYER.walkCap).toBe(8);
  });

  it('rejects non-finite tunable values', () => {
    expect(() => setTunable('gravity', Number.NaN)).toThrow(/finite/);
    expect(WORLD.gravity).toBe(1);
  });

  it('truncates frame-count tunables toward zero', () => {
    setTunable('jumpHoldFrames', 6.9);
    expect(PLAYER.jumpHoldFrames).toBe(6);
    setTunable('boostChargeFrames', 150.2);
    expect(PLAYER.boostChargeFrames).toBe(150);
  });

  it('parseDebugOverlayVisible defaults on; debug=0/false/off hides', () => {
    expect(parseDebugOverlayVisible('')).toBe(true);
    expect(parseDebugOverlayVisible('?foo=1')).toBe(true);
    expect(parseDebugOverlayVisible('?debug=1')).toBe(true);
    expect(parseDebugOverlayVisible('?debug=0')).toBe(false);
    expect(parseDebugOverlayVisible('?debug=false')).toBe(false);
    expect(parseDebugOverlayVisible('?debug=OFF')).toBe(false);
    expect(parseDebugOverlayVisible('?debug=no')).toBe(false);
  });

  it('isTunableKey guards unknown strings', () => {
    expect(isTunableKey('gravity')).toBe(true);
    expect(isTunableKey('tile')).toBe(false);
  });
});
