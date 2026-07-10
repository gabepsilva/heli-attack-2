import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAYER,
  PLAYER_DEFAULTS,
  resetPhysicsConstants,
} from '../config/constants';
import { setTunable } from '../config/physicsTuning';
import { applyHorizontalWalk } from './walkPhysics';

describe('applyHorizontalWalk (spec §Player physics)', () => {
  afterEach(() => {
    resetPhysicsConstants();
  });

  it('locks accel / input cap / hard cap / friction to exact spec values', () => {
    expect(PLAYER.walkAccel).toBe(1);
    expect(PLAYER.walkCap).toBe(5);
    expect(PLAYER.hardCap).toBe(6);
    expect(PLAYER.friction).toBe(1);
  });

  /**
   * Issue #94 — supersedes any “bump walkCap 5 → 6” proposal. Defaults stay
   * Flash-exact; live PLAYER.* remain tunable (#8) without changing seeds.
   */
  describe('issue #94 — Flash walk cap (no bump)', () => {
    it('keeps PLAYER_DEFAULTS at Flash walkCap ±5 / hardCap ±6 (not bumped)', () => {
      expect(PLAYER_DEFAULTS.walkAccel).toBe(1);
      expect(PLAYER_DEFAULTS.friction).toBe(1);
      expect(PLAYER_DEFAULTS.walkCap).toBe(5);
      expect(PLAYER_DEFAULTS.walkCap).not.toBe(6);
      expect(PLAYER_DEFAULTS.hardCap).toBe(6);
      // Input ceiling and knockback ceiling stay distinct (Flash heroAction).
      expect(PLAYER_DEFAULTS.walkCap).toBeLessThan(PLAYER_DEFAULTS.hardCap);
      expect(PLAYER).toMatchObject({
        walkAccel: PLAYER_DEFAULTS.walkAccel,
        walkCap: PLAYER_DEFAULTS.walkCap,
        hardCap: PLAYER_DEFAULTS.hardCap,
        friction: PLAYER_DEFAULTS.friction,
      });
    });

    it('never reaches ±6 from walk input alone (walkCap stays below hardCap)', () => {
      let right = 0;
      let left = 0;
      for (let i = 0; i < 20; i += 1) {
        right = applyHorizontalWalk(right, { left: false, right: true });
        left = applyHorizontalWalk(left, { left: true, right: false });
      }
      expect(right).toBe(5);
      expect(left).toBe(-5);
      expect(right).toBeLessThan(PLAYER.hardCap);
      expect(left).toBeGreaterThan(-PLAYER.hardCap);
    });

    it('keeps Flash defaults after live walkCap tuning is reset', () => {
      setTunable('walkCap', 6);
      expect(PLAYER.walkCap).toBe(6);
      expect(PLAYER_DEFAULTS.walkCap).toBe(5);

      resetPhysicsConstants();
      expect(PLAYER.walkCap).toBe(5);
      expect(PLAYER.hardCap).toBe(6);
    });
  });

  it('ramps +1/frame while holding right and stops at the ±5 input cap', () => {
    let vx = 0;
    const frames: number[] = [];

    for (let i = 0; i < 10; i += 1) {
      vx = applyHorizontalWalk(vx, { left: false, right: true });
      frames.push(vx);
    }

    expect(frames).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 5, 5]);
    expect(vx).toBe(PLAYER.walkCap);
  });

  it('ramps −1/frame while holding left and stops at −5', () => {
    let vx = 0;
    const frames: number[] = [];

    for (let i = 0; i < 10; i += 1) {
      vx = applyHorizontalWalk(vx, { left: true, right: false });
      frames.push(vx);
    }

    expect(frames).toEqual([-1, -2, -3, -4, -5, -5, -5, -5, -5, -5]);
    expect(vx).toBe(-PLAYER.walkCap);
  });

  it('decays −1/frame toward 0 when no key is held (friction)', () => {
    let vx: number = PLAYER.walkCap; // 5
    const frames: number[] = [];

    for (let i = 0; i < 8; i += 1) {
      vx = applyHorizontalWalk(vx, { left: false, right: false });
      frames.push(vx);
    }

    expect(frames).toEqual([4, 3, 2, 1, 0, 0, 0, 0]);
    expect(vx).toBe(0);
  });

  it('decays +1/frame toward 0 from negative speed on release', () => {
    let vx: number = -PLAYER.walkCap;
    const frames: number[] = [];

    for (let i = 0; i < 6; i += 1) {
      vx = applyHorizontalWalk(vx, { left: false, right: false });
      frames.push(vx);
    }

    expect(frames).toEqual([-4, -3, -2, -1, 0, 0]);
  });

  it('decays knockback above the hard cap by 1/frame toward ±6 (not an instant clamp)', () => {
    // Original: if (xspeed>6) xspeed--; — holding neither also applies friction
    // first, so 10 → friction 9 → hard-cap 8 in one frame with no input.
    expect(applyHorizontalWalk(10, { left: false, right: false })).toBe(8);
    expect(applyHorizontalWalk(10, { left: false, right: true })).toBe(9);
    expect(applyHorizontalWalk(7, { left: false, right: true })).toBe(6);
    expect(applyHorizontalWalk(6, { left: false, right: true })).toBe(6);

    expect(applyHorizontalWalk(-10, { left: false, right: false })).toBe(-8);
    expect(applyHorizontalWalk(-10, { left: true, right: false })).toBe(-9);
    expect(applyHorizontalWalk(-7, { left: true, right: false })).toBe(-6);
    expect(applyHorizontalWalk(-6, { left: true, right: false })).toBe(-6);
  });

  it('applies friction when both left and right are held', () => {
    expect(applyHorizontalWalk(3, { left: true, right: true })).toBe(2);
    expect(applyHorizontalWalk(-3, { left: true, right: true })).toBe(-2);
    // At 0: left accel −1, right accel +1, friction no-op → still 0
    expect(applyHorizontalWalk(0, { left: true, right: true })).toBe(0);
  });

  it('blocks accel while ducking but still applies friction', () => {
    expect(
      applyHorizontalWalk(0, { left: false, right: true, duck: true }),
    ).toBe(0);
    expect(
      applyHorizontalWalk(4, { left: false, right: true, duck: true }),
    ).toBe(3);
    expect(
      applyHorizontalWalk(-4, { left: true, right: false, duck: true }),
    ).toBe(-3);
  });

  it('does not force duck-friction while jumping (original duck && !jump)', () => {
    // Holding right + duck + jump: no accel (duck), no friction (jump) → unchanged
    expect(
      applyHorizontalWalk(4, {
        left: false,
        right: true,
        duck: true,
        jump: true,
      }),
    ).toBe(4);
  });
});
