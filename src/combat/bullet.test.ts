/**
 * Pooled projectiles — unit tests for issue #10 acceptance criteria.
 *
 * AC: Pool reuses instances (asserted, not growing)
 * Spec: MachineGun speed 8 / damage 10; Flash velocity = speed*cos/sin(rot)
 */

import { describe, expect, it } from 'vitest';
import { BULLET, WEAPONS, WORLD } from '../config/constants';
import { TEST_ARENA_HEIGHT_PX, TEST_ARENA_WIDTH_PX } from '../world/testArena';
import {
  BulletPool,
  activateBullet,
  arenaCullBounds,
  createInactiveBullet,
  isOutsideCullBounds,
  stepBullet,
  velocityFromRotation,
} from './bullet';

describe('bullet system (issue #10 — pooled projectiles)', () => {
  it('locks BULLET / MachineGun defaults to exact spec values', () => {
    expect(WEAPONS[0]).toEqual({
      name: 'MachineGun',
      reload: 5,
      speed: 8,
      damage: 10,
    });
    expect(BULLET.defaultSpeed).toBe(8);
    expect(BULLET.defaultDamage).toBe(10);
    expect(BULLET.defaultSpeed).toBe(WEAPONS[0].speed);
    expect(BULLET.defaultDamage).toBe(WEAPONS[0].damage);
    expect(BULLET.cullMargin).toBe(WORLD.tile);
    expect(BULLET.cullMargin).toBe(50);
    expect(BULLET.maxLifetimeFrames).toBe(300);
    expect(BULLET.poolCapacity).toBe(64);
  });

  it('matches Flash addBullet velocity: speed * cos/sin(rotation°)', () => {
    const right = velocityFromRotation(8, 0);
    expect(right.vx).toBeCloseTo(8, 10);
    expect(right.vy).toBeCloseTo(0, 10);

    const down = velocityFromRotation(8, 90);
    expect(down.vx).toBeCloseTo(0, 10);
    expect(down.vy).toBeCloseTo(8, 10);

    const left = velocityFromRotation(8, 180);
    expect(left.vx).toBeCloseTo(-8, 10);
    expect(left.vy).toBeCloseTo(0, 10);

    const up = velocityFromRotation(8, -90);
    expect(up.vx).toBeCloseTo(0, 10);
    expect(up.vy).toBeCloseTo(-8, 10);
  });

  it('steps motion as Flash bulletFrame: pos += vel * timeStep', () => {
    const b = createInactiveBullet(0);
    activateBullet(b, 100, 200, 0, 8, 10);
    expect(stepBullet(b, 1, arenaCullBounds(1200, 800))).toBe(false);
    expect(b.x).toBeCloseTo(108, 10);
    expect(b.y).toBeCloseTo(200, 10);
    expect(b.age).toBe(1);

    expect(stepBullet(b, 0.5, arenaCullBounds(1200, 800))).toBe(false);
    expect(b.x).toBeCloseTo(112, 10);
    expect(b.age).toBeCloseTo(1.5, 10);
  });

  it('culls outside arena ±1 tile (Flash off-screen remove)', () => {
    const bounds = arenaCullBounds(TEST_ARENA_WIDTH_PX, TEST_ARENA_HEIGHT_PX);
    expect(bounds).toEqual({
      minX: -50,
      minY: -50,
      maxX: TEST_ARENA_WIDTH_PX + 50,
      maxY: TEST_ARENA_HEIGHT_PX + 50,
    });

    expect(isOutsideCullBounds(0, 0, bounds)).toBe(false);
    expect(isOutsideCullBounds(-50, 0, bounds)).toBe(false);
    expect(isOutsideCullBounds(-51, 0, bounds)).toBe(true);
    expect(isOutsideCullBounds(TEST_ARENA_WIDTH_PX + 51, 0, bounds)).toBe(true);
  });

  it('expires when age reaches maxLifetime', () => {
    const b = createInactiveBullet(0);
    activateBullet(b, 100, 100, 0, 8, 10, 3);
    const bounds = arenaCullBounds(2000, 2000);
    expect(stepBullet(b, 1, bounds)).toBe(false);
    expect(stepBullet(b, 1, bounds)).toBe(false);
    expect(stepBullet(b, 1, bounds)).toBe(true);
    expect(b.age).toBe(3);
  });

  it('reuses the same instances — pool capacity never grows (AC)', () => {
    const pool = new BulletPool(8);
    const slotsRef = pool.slots;
    expect(pool.capacity).toBe(8);
    expect(pool.freeCount).toBe(8);
    expect(pool.activeCount).toBe(0);

    const firstWave: ReturnType<BulletPool['acquire']>[] = [];
    for (let i = 0; i < 8; i += 1) {
      firstWave.push(pool.acquire(0, 0, 0));
    }
    expect(firstWave.every((b) => b !== null)).toBe(true);
    expect(pool.activeCount).toBe(8);
    expect(pool.freeCount).toBe(0);
    expect(pool.acquire(0, 0, 0)).toBeNull(); // exhausted — does not grow
    expect(pool.capacity).toBe(8);
    expect(pool.slots).toBe(slotsRef);
    expect(pool.slots.length).toBe(8);

    // Identity: every returned bullet is one of the preallocated slots.
    for (const b of firstWave) {
      expect(slotsRef).toContain(b);
    }

    // Recycle all via lifetime expiry, then fire again — same object identities.
    const bounds = { minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9 };
    for (const b of firstWave) {
      b!.maxLifetime = 1;
      b!.age = 0;
    }
    pool.stepAll(1, bounds);
    expect(pool.activeCount).toBe(0);
    expect(pool.recycleCount).toBe(8);
    expect(pool.capacity).toBe(8);
    expect(pool.slots).toBe(slotsRef);

    const secondWave: NonNullable<ReturnType<BulletPool['acquire']>>[] = [];
    for (let i = 0; i < 8; i += 1) {
      const b = pool.acquire(10, 10, 90);
      expect(b).not.toBeNull();
      secondWave.push(b!);
    }
    expect(pool.acquireCount).toBe(16);
    expect(pool.capacity).toBe(8);
    expect(pool.slots.length).toBe(8);
    expect(pool.slots).toBe(slotsRef);

    // Every second-wave bullet is the same object as some first-wave slot.
    for (const b of secondWave) {
      expect(firstWave).toContain(b);
    }
  });

  it('fires hundreds of shots without growing the pool (reuse under load)', () => {
    const pool = new BulletPool(BULLET.poolCapacity);
    const capacity = pool.capacity;
    const slotsRef = pool.slots;
    const bounds = arenaCullBounds(400, 400);

    // Rapid fire: acquire every tick; bullets leave the small cull box quickly.
    for (let shot = 0; shot < 400; shot += 1) {
      pool.acquire(200, 200, 0, BULLET.defaultSpeed);
      pool.stepAll(1, bounds);
    }

    expect(pool.capacity).toBe(capacity);
    expect(pool.slots).toBe(slotsRef);
    expect(pool.slots.length).toBe(capacity);
    expect(pool.acquireCount).toBe(400);
    expect(pool.recycleCount).toBeGreaterThan(300);
    // Still bounded — never more active than capacity.
    expect(pool.activeCount).toBeLessThanOrEqual(capacity);
    expect(pool.activeCount + pool.freeCount).toBe(capacity);
  });

  it('reset deactivates all slots without reallocating the slot array', () => {
    const pool = new BulletPool(4);
    const slotsRef = pool.slots;
    pool.acquire(0, 0, 0);
    pool.acquire(1, 1, 90);
    expect(pool.activeCount).toBe(2);

    pool.reset();
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(4);
    expect(pool.acquireCount).toBe(0);
    expect(pool.recycleCount).toBe(0);
    expect(pool.slots).toBe(slotsRef);
    expect(pool.slots.every((b) => !b.active)).toBe(true);
  });
});
