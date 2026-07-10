import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { DUCK_SIZE, STAND_SIZE, applyDuckHitbox } from './duckPhysics';

describe('duckPhysics (spec §Duck)', () => {
  it('locks duckScale and derived sizes to exact spec values', () => {
    expect(PLAYER.duckScale).toBe(2 / 3);
    expect(STAND_SIZE).toEqual({ w: 10, h: 42 });
    expect(DUCK_SIZE.w).toBeCloseTo(10 * (2 / 3), 10);
    expect(DUCK_SIZE.h).toBeCloseTo(42 * (2 / 3), 10);
    // Spec: ~6.7 × 28
    expect(DUCK_SIZE.w).toBeCloseTo(6.6667, 3);
    expect(DUCK_SIZE.h).toBeCloseTo(28, 5);
  });

  it('shrinks the hitbox to 2/3 W&H and keeps feet planted', () => {
    const body = { x: 100, y: 200, w: 10, h: 42 };
    const feet = body.y + body.h;
    const centerX = body.x + body.w / 2;

    const ducked = applyDuckHitbox(body, true, false);

    expect(ducked).toBe(true);
    expect(body.w).toBeCloseTo(DUCK_SIZE.w, 10);
    expect(body.h).toBeCloseTo(DUCK_SIZE.h, 10);
    expect(body.y + body.h).toBeCloseTo(feet, 10);
    expect(body.x + body.w / 2).toBeCloseTo(centerX, 10);
  });

  it('keeps feet planted when standing up from duck on the ground', () => {
    const body = { x: 100, y: 200, w: DUCK_SIZE.w, h: DUCK_SIZE.h };
    const feetBefore = body.y + body.h;

    const ducked = applyDuckHitbox(body, false, true);

    expect(ducked).toBe(false);
    expect(body.w).toBe(STAND_SIZE.w);
    expect(body.h).toBe(STAND_SIZE.h);
    expect(body.y + body.h).toBeCloseTo(feetBefore, 10);
  });

  it('restores standing size in air without the grounded quirk nudge', () => {
    const body = { x: 100, y: 200, w: DUCK_SIZE.w, h: DUCK_SIZE.h };
    const feetBefore = body.y + body.h;

    applyDuckHitbox(body, false, true);

    expect(body.w).toBe(STAND_SIZE.w);
    expect(body.h).toBe(STAND_SIZE.h);
    expect(body.y + body.h).toBeCloseTo(feetBefore, 10);
  });
});
