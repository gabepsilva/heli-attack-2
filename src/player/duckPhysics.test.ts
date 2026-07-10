import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { createTileMap } from '../world/tileMap';
import { createTestArena } from '../world/testArena';
import {
  DUCK_SIZE,
  STAND_SIZE,
  applyDuckHitbox,
  hasStandingHeadroom,
} from './duckPhysics';

/** Open arena — standing always has headroom. */
const openMap = createTestArena();

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

    const ducked = applyDuckHitbox(body, true, false, openMap);

    expect(ducked).toBe(true);
    expect(body.w).toBeCloseTo(DUCK_SIZE.w, 10);
    expect(body.h).toBeCloseTo(DUCK_SIZE.h, 10);
    expect(body.y + body.h).toBeCloseTo(feet, 10);
    expect(body.x + body.w / 2).toBeCloseTo(centerX, 10);
  });

  it('keeps feet planted when standing up from duck on the ground', () => {
    const body = { x: 100, y: 200, w: DUCK_SIZE.w, h: DUCK_SIZE.h };
    const feetBefore = body.y + body.h;

    const ducked = applyDuckHitbox(body, false, true, openMap);

    expect(ducked).toBe(false);
    expect(body.w).toBe(STAND_SIZE.w);
    expect(body.h).toBe(STAND_SIZE.h);
    expect(body.y + body.h).toBeCloseTo(feetBefore, 10);
  });

  it('stays ducked when overhead tiles block the standing box', () => {
    // Low ceiling one tile above the ducked head (row 3 solid, body top at y=150).
    const rows = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, () => (y === 3 ? 1 : 0)),
    );
    const map = createTileMap(rows);
    const body = { x: 195, y: 150, w: DUCK_SIZE.w, h: DUCK_SIZE.h };
    expect(hasStandingHeadroom(map, body)).toBe(false);

    const ducked = applyDuckHitbox(body, false, true, map);

    expect(ducked).toBe(true);
    expect(body.w).toBeCloseTo(DUCK_SIZE.w, 10);
    expect(body.h).toBeCloseTo(DUCK_SIZE.h, 10);
  });

  it('reports headroom on open ground in the test arena', () => {
    const body = { x: 100, y: 557, w: DUCK_SIZE.w, h: DUCK_SIZE.h };
    expect(hasStandingHeadroom(openMap, body)).toBe(true);

    const ducked = applyDuckHitbox(body, false, true, openMap);

    expect(ducked).toBe(false);
    expect(body.h).toBe(STAND_SIZE.h);
  });
});
