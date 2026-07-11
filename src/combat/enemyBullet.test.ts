/**
 * Enemy bullets + heli fire — issue #18 acceptance criteria.
 *
 * AC: Player takes damage from heli bullets
 * AC: I-frames prevent instant death; spread matches spec
 */

import { describe, expect, it } from 'vitest';
import { ENEMY_BULLET, HELI, PLAYER_COMBAT } from '../config/constants';
import { createAabbBody } from '../world/aabbBody';
import { createTestArena } from '../world/testArena';
import {
  EnemyBulletPool,
  enemyBulletArenaCullBounds,
  pointHitsPlayerAabb,
  stepEnemyBulletsVsPlayer,
} from './enemyBullet';
import {
  createHelicopter,
  createSpawnRng,
  heliFireSpreadDeg,
  stepHeliCombat,
  stepHeliGunAim,
  tryHeliFire,
  type SpawnRng,
} from './helicopter';
import {
  createPlayerHealth,
  isPlayerDead,
  stepPlayerIFrames,
  syncPlayerLastHealth,
} from './playerHealth';

describe('enemy fire & player health (issue #18)', () => {
  it('locks HELI fire / ENEMY_BULLET / PLAYER_COMBAT to exact spec values', () => {
    expect(HELI.bulletSpeed).toBe(7);
    expect(HELI.aimSpreadDeg).toBe(10);
    expect(HELI.fireIntervalFrames).toBe(16);
    expect(HELI.gunTurnDivisor).toBe(10);
    expect(ENEMY_BULLET.speed).toBe(HELI.bulletSpeed);
    expect(ENEMY_BULLET.speed).toBe(7);
    expect(ENEMY_BULLET.damage).toBe(10);
    expect(PLAYER_COMBAT.maxHealth).toBe(100);
    expect(PLAYER_COMBAT.iFrameFrames).toBe(10);
    expect(PLAYER_COMBAT.iFrameFrames).toBeLessThan(HELI.fireIntervalFrames);
  });

  it('aim spread matches Flash gun._rotation-5+random(10) (±5°)', () => {
    const base = 45;
    const seen = new Set<number>();
    for (let jitter = 0; jitter < HELI.aimSpreadDeg; jitter += 1) {
      // randomInt = floor(next * 10) → force each integer 0..9.
      const rng: SpawnRng = {
        next: () => (jitter + 0.5) / HELI.aimSpreadDeg,
      };
      const spread = heliFireSpreadDeg(base, rng);
      expect(spread).toBe(base - HELI.aimSpreadDeg / 2 + jitter);
      seen.add(spread);
    }
    expect(seen.size).toBe(10);
    expect(Math.min(...seen)).toBe(base - 5);
    expect(Math.max(...seen)).toBe(base + 4);
  });

  it('heli fires at speed 7 on the Flash cadence (interval 16, shot on %==1)', () => {
    const heli = createHelicopter(400, 100, HELI.hp);
    heli.gunRotationDeg = 90;
    const pool = new EnemyBulletPool(8);
    const rng = createSpawnRng(1);
    const shots: number[] = [];

    for (let tick = 0; tick < 40; tick += 1) {
      const shot = stepHeliCombat(heli, 1, 400, 400, pool, rng, true);
      if (shot) {
        shots.push(tick);
        expect(shot.speed).toBe(7);
        expect(shot.damage).toBe(10);
      }
    }
    // shootCounter 1,17,33 → ticks 0,16,32
    expect(shots).toEqual([0, 16, 32]);
    expect(pool.activeCount).toBe(3);
  });

  it('player takes 10 damage from a heli bullet that intersects the AABB', () => {
    const body = createAabbBody(100, 200, 10, 42);
    const health = createPlayerHealth();
    const pool = new EnemyBulletPool(2);
    const bounds = enemyBulletArenaCullBounds(800, 600);
    pool.acquire(105, 199, 90, {
      speed: ENEMY_BULLET.speed,
      damage: ENEMY_BULLET.damage,
    });

    stepEnemyBulletsVsPlayer(pool, body, health, bounds, 1);

    expect(health.health).toBe(90);
    expect(health.iFramesRemaining).toBe(PLAYER_COMBAT.iFrameFrames);
    expect(pool.activeCount).toBe(0);
  });

  it('i-frames prevent instant death from a stacked same-frame volley', () => {
    const body = createAabbBody(100, 200, 10, 42);
    const health = createPlayerHealth();
    const pool = new EnemyBulletPool(16);
    const bounds = enemyBulletArenaCullBounds(800, 600);

    for (let i = 0; i < 10; i += 1) {
      const b = pool.acquire(105, 220, 0, {
        speed: 0,
        damage: ENEMY_BULLET.damage,
      });
      expect(b).not.toBeNull();
      b!.vx = 0;
      b!.vy = 0;
    }

    stepEnemyBulletsVsPlayer(pool, body, health, bounds, 1);

    expect(health.health).toBe(90);
    expect(isPlayerDead(health)).toBe(false);
    expect(pool.activeCount).toBe(0);
  });

  it('standing under sustained heli fire drains health to a death state', () => {
    const body = createAabbBody(400, 500, 10, 42);
    const health = createPlayerHealth();
    const heli = createHelicopter(400, 100, HELI.hp);
    heli.gunRotationDeg = 90;
    const pool = new EnemyBulletPool(32);
    const bounds = enemyBulletArenaCullBounds(800, 600);
    // randomInt(10) → 5 → spread offset 0 (gunRot - 5 + 5).
    const zeroSpreadRng: SpawnRng = { next: () => 0.5 };

    let ticks = 0;
    let hits = 0;
    while (health.alive && ticks < 500) {
      stepPlayerIFrames(health, 1);
      stepHeliGunAim(heli, body.x + body.w / 2, body.y + body.h / 2, 1);
      heli.gunRotationDeg = 90;
      const shot = tryHeliFire(heli, true, zeroSpreadRng);
      if (shot) {
        pool.acquire(body.x + body.w / 2, body.y - ENEMY_BULLET.speed, 90, {
          speed: ENEMY_BULLET.speed,
          damage: ENEMY_BULLET.damage,
        });
      }
      const before = health.health;
      stepEnemyBulletsVsPlayer(pool, body, health, bounds, 1);
      if (health.health < before) {
        hits += 1;
      }
      syncPlayerLastHealth(health);
      ticks += 1;
    }

    expect(health.alive).toBe(false);
    expect(health.health).toBe(0);
    expect(isPlayerDead(health)).toBe(true);
    expect(hits).toBe(10);
    expect(ticks).toBeLessThan(500);
  });

  it('pointHitsPlayerAabb matches the narrow 10×42 collision box', () => {
    const body = createAabbBody(100, 200, 10, 42);
    expect(pointHitsPlayerAabb(100, 200, body)).toBe(true);
    expect(pointHitsPlayerAabb(109.9, 241.9, body)).toBe(true);
    expect(pointHitsPlayerAabb(110, 200, body)).toBe(false);
    expect(pointHitsPlayerAabb(105, 242, body)).toBe(false);
    expect(pointHitsPlayerAabb(99.9, 220, body)).toBe(false);
  });

  it('enemy bullets recycle on solid tiles', () => {
    const map = createTestArena();
    const body = createAabbBody(50, 50, 10, 42);
    const health = createPlayerHealth();
    const pool = new EnemyBulletPool(2);
    const bounds = enemyBulletArenaCullBounds(800, 600);
    pool.acquire(100, 100, 90, {
      speed: ENEMY_BULLET.speed,
      damage: ENEMY_BULLET.damage,
    });

    for (let i = 0; i < 80; i += 1) {
      stepEnemyBulletsVsPlayer(pool, body, health, bounds, 1, map);
    }
    expect(pool.activeCount).toBe(0);
    expect(health.health).toBe(100);
  });
});
