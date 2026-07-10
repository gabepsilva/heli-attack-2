/**
 * Pixel-accurate heli hit tests — issue #12 acceptance criteria.
 */

import { describe, expect, it } from 'vitest';
import { HELI } from '../config/constants';
import {
  HELI_HIT_MASK_SIZE,
  bulletHitsHeli,
  resetHeliHitMaskCache,
} from './heliHit';

/** Known opaque pixel in the baked mask (from atlas heli frame). */
const HIT_LOCAL = { x: 22, y: 2 } as const;

/** Known transparent pixel inside the sprite AABB (hollow placeholder center). */
const MISS_LOCAL = { x: 100, y: 53 } as const;

function heliAt(cx: number, cy: number) {
  return {
    x: cx,
    y: cy,
    spriteW: HELI.spriteW,
    spriteH: HELI.spriteH,
  };
}

function worldFromLocal(
  cx: number,
  cy: number,
  localX: number,
  localY: number,
) {
  const left = cx - HELI.spriteW / 2;
  const top = cy - HELI.spriteH / 2;
  return { x: left + localX, y: top + localY };
}

describe('heliHit (issue #12 — pixel-accurate registration)', () => {
  it('locks mask size to the Flash heli sprite dimensions', () => {
    expect(HELI_HIT_MASK_SIZE).toEqual({ w: 212, h: 106 });
    expect(HELI.spriteW).toBe(212);
    expect(HELI.spriteH).toBe(106);
  });

  it('registers hits only on opaque mask pixels, not the full AABB', () => {
    resetHeliHitMaskCache();
    const cx = 500;
    const cy = 250;
    const hit = worldFromLocal(cx, cy, HIT_LOCAL.x, HIT_LOCAL.y);
    const miss = worldFromLocal(cx, cy, MISS_LOCAL.x, MISS_LOCAL.y);

    expect(bulletHitsHeli(hit.x, hit.y, heliAt(cx, cy))).toBe(true);
    expect(bulletHitsHeli(miss.x, miss.y, heliAt(cx, cy))).toBe(false);
  });

  it('misses outside the sprite bounds even when inside the nominal AABB corners', () => {
    const cx = 300;
    const cy = 200;
    const left = cx - HELI.spriteW / 2;
    const top = cy - HELI.spriteH / 2;
    // AABB top-left corner is often transparent on the placeholder frame.
    expect(bulletHitsHeli(left, top, heliAt(cx, cy))).toBe(false);
  });

  it('decodes the baked mask idempotently', () => {
    resetHeliHitMaskCache();
    const hit = worldFromLocal(0, 0, HIT_LOCAL.x, HIT_LOCAL.y);
    expect(bulletHitsHeli(hit.x, hit.y, heliAt(0, 0))).toBe(true);
    resetHeliHitMaskCache();
    expect(bulletHitsHeli(hit.x, hit.y, heliAt(0, 0))).toBe(true);
  });
});
