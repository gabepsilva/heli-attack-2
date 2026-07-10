import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { applyHorizontalWalk } from './walkPhysics';

describe('applyHorizontalWalk (spec §Player physics)', () => {
  it('locks accel / input cap / hard cap / friction to exact spec values', () => {
    expect(PLAYER.walkAccel).toBe(1);
    expect(PLAYER.walkCap).toBe(5);
    expect(PLAYER.hardCap).toBe(6);
    expect(PLAYER.friction).toBe(1);
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
