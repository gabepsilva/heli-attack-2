/**
 * Helicopter enemy — unit tests for issue #12 acceptance criteria.
 *
 * AC: Absorbs exactly 30 MachineGun hits (300/10) then dies
 * AC: Hit registration is pixel-accurate (see heliHit.test.ts)
 */

import { describe, expect, it } from 'vitest';
import { BULLET, HELI, WEAPONS } from '../config/constants';
import { BulletPool, arenaCullBounds } from './bullet';
import {
  createHelicopter,
  createHeliExplosion,
  createSpawnRng,
  damageHelicopter,
  spawnHelicopter,
  stepBulletsVsHelis,
  stepHeliExplosion,
  stepHelicopter,
  type Helicopter,
} from './helicopter';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';

const HIT_LOCAL = { x: 22, y: 2 } as const;

function hitWorld(heli: Helicopter) {
  const left = heli.x - HELI.spriteW / 2;
  const top = heli.y - HELI.spriteH / 2;
  return { x: left + HIT_LOCAL.x, y: top + HIT_LOCAL.y };
}

function fireHit(
  pool: BulletPool,
  heli: Helicopter,
  damage = BULLET.defaultDamage,
) {
  const p = hitWorld(heli);
  // Flash tests after motion — spawn one step before the opaque pixel along +X.
  const slot = pool.acquire(
    p.x - BULLET.defaultSpeed,
    p.y,
    0,
    BULLET.defaultSpeed,
    damage,
  );
  expect(slot).not.toBeNull();
}

describe('helicopter (issue #12 — enemy entity)', () => {
  it('spawns with spec HP 300 from screen edges', () => {
    expect(HELI.hp).toBe(300);
    expect(WEAPONS[0].damage).toBe(10);
    expect(HELI.hp / WEAPONS[0].damage).toBe(30);

    const rng = createSpawnRng(99);
    const heli = spawnHelicopter(
      HELI.hp,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      rng,
    );
    expect(heli.health).toBe(300);
    expect(heli.active).toBe(true);
    const offLeft = heli.x < 0 || heli.x > LEVEL1_WIDTH_PX;
    const offTop = heli.y < 0;
    expect(offLeft || offTop).toBe(true);
  });

  it('absorbs exactly 30 MachineGun hits then dies', () => {
    const heli = createHelicopter(600, 200, HELI.hp);
    const pool = new BulletPool(4);
    const bounds = arenaCullBounds(LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX);
    let kills = 0;

    for (let i = 0; i < 29; i += 1) {
      fireHit(pool, heli);
      stepBulletsVsHelis(pool, [heli], bounds, 1, () => {
        kills += 1;
      });
      expect(heli.active).toBe(true);
      expect(heli.health).toBe(300 - (i + 1) * 10);
      expect(kills).toBe(0);
    }

    fireHit(pool, heli);
    stepBulletsVsHelis(pool, [heli], bounds, 1, () => {
      kills += 1;
    });
    expect(heli.health).toBe(0);
    expect(heli.active).toBe(false);
    expect(kills).toBe(1);
  });

  it('recycles the bullet on a pixel hit', () => {
    const heli = createHelicopter(400, 180, HELI.hp);
    const pool = new BulletPool(1);
    const bounds = arenaCullBounds(LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX);

    fireHit(pool, heli);
    stepBulletsVsHelis(pool, [heli], bounds, 1);
    expect(heli.health).toBe(290);
    expect(pool.activeCount).toBe(0);
  });

  it('spawns a timed placeholder explosion on kill', () => {
    const boom = createHeliExplosion(120, 80);
    expect(boom.maxAge).toBe(HELI.explosionDurationFrames);
    expect(stepHeliExplosion(boom, 1)).toBe(false);
    expect(boom.active).toBe(true);
    expect(stepHeliExplosion(boom, HELI.explosionDurationFrames)).toBe(true);
    expect(boom.active).toBe(false);
  });

  it('damageHelicopter returns kill flag only on the fatal hit', () => {
    const heli = createHelicopter(0, 0, 20);
    expect(damageHelicopter(heli, 10)).toBe(false);
    expect(heli.health).toBe(10);
    expect(damageHelicopter(heli, 10)).toBe(true);
    expect(heli.active).toBe(false);
  });

  it('steps hover drift without leaving the arena horizontally', () => {
    const heli = createHelicopter(LEVEL1_WIDTH_PX / 2, 120, HELI.hp);
    for (let i = 0; i < 120; i += 1) {
      stepHelicopter(
        heli,
        1,
        LEVEL1_WIDTH_PX / 2,
        400,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
      );
    }
    expect(heli.x).toBeGreaterThanOrEqual(HELI.spriteW / 2);
    expect(heli.x).toBeLessThanOrEqual(LEVEL1_WIDTH_PX - HELI.spriteW / 2);
  });
});
