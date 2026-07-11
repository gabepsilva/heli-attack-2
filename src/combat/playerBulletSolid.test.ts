/**
 * Player bullet × solid tiles — unit tests for issue #96 acceptance criteria.
 *
 * AC: MachineGun (and other standard player bullets) cannot cross solid ground
 * AC: Bullets recycle / despawn on first solid-tile contact
 * AC: Off-screen cull behavior remains unchanged
 * AC: Enemy bullets keep existing solid-tile recycle behavior
 * AC: Heavy / special projectiles keep intentional solid rules (mines bounce/plant)
 *
 * Spec / Flash `bulletFrame`:
 *   if (hit || map[y][x][0] != 0 || OOB) → remove
 */

import { describe, expect, it } from 'vitest';
import { BULLET, ENEMY_BULLET, WEAPONS, WORLD } from '../config/constants';
import { createAabbBody } from '../world/aabbBody';
import {
  createTestArena,
  TEST_ARENA_HEIGHT_PX,
  TEST_ARENA_WIDTH_PX,
} from '../world/testArena';
import { createTileMap, TILE_EMPTY, TILE_SOLID } from '../world/tileMap';
import {
  BulletPool,
  activateBullet,
  arenaCullBounds,
  createInactiveBullet,
  isOutsideCullBounds,
} from './bullet';
import {
  EnemyBulletPool,
  enemyBulletArenaCullBounds,
  enemyBulletHitsSolid,
  stepEnemyBulletsVsPlayer,
} from './enemyBullet';
import { createHelicopter, stepBulletsVsHelis } from './helicopter';
import { createPlayerHealth } from './playerHealth';
import {
  isSolidAtWorld,
  stepMineBullet,
  stepSpecialBullet,
} from './specialProjectile';

/** Tiny room: solid border, empty interior (tile 50). */
function solidFloorMap() {
  const cells = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ];
  return createTileMap(cells, WORLD.tile);
}

describe('player bullets vs solid tiles (issue #96)', () => {
  it('locks MachineGun / BULLET defaults used by the solid-cull path', () => {
    expect(WEAPONS[0]).toEqual({
      name: 'MachineGun',
      reload: 5,
      speed: 8,
      damage: 10,
    });
    expect(BULLET.defaultSpeed).toBe(8);
    expect(BULLET.defaultDamage).toBe(10);
    expect(BULLET.cullMargin).toBe(WORLD.tile);
    expect(BULLET.cullMargin).toBe(50);
    expect(WORLD.tile).toBe(50);
  });

  it('isSolidAtWorld matches Flash map[floor(y/tile)][floor(x/tile)][0] != 0', () => {
    const map = solidFloorMap();
    // Interior air at tile (2,2) → world (100..149, 100..149)
    expect(isSolidAtWorld(map, 100, 100)).toBe(false);
    expect(isSolidAtWorld(map, 149, 149)).toBe(false);
    // Floor row 4 → world y 200..249
    expect(isSolidAtWorld(map, 100, 200)).toBe(true);
    expect(isSolidAtWorld(map, 125, 225)).toBe(true);
    // Left wall col 0
    expect(isSolidAtWorld(map, 0, 100)).toBe(true);
    expect(isSolidAtWorld(map, 49, 100)).toBe(true);
    expect(isSolidAtWorld(map, 50, 100)).toBe(false);
  });

  it('MachineGun ballistic shot recycles on first solid-tile contact (AC)', () => {
    const map = solidFloorMap();
    const pool = new BulletPool(4);
    const bounds = arenaCullBounds(
      map.width * WORLD.tile,
      map.height * WORLD.tile,
    );
    // Fire straight down from empty cell (2,1) toward floor row 4.
    // World: col 2 → x=100..149 center 125; row 1 → y=50..99.
    const shot = pool.acquire(125, 75, 90, {
      speed: WEAPONS[0].speed,
      damage: WEAPONS[0].damage,
    });
    expect(shot).not.toBeNull();
    expect(shot!.behavior).toBe('ballistic');
    expect(shot!.speed).toBe(8);

    let recycledAt: number | null = null;
    for (let tick = 0; tick < 40; tick += 1) {
      stepBulletsVsHelis(pool, [], bounds, 1, undefined, map);
      if (pool.activeCount === 0) {
        recycledAt = tick;
        break;
      }
      // Must never occupy a solid cell while still active.
      expect(isSolidAtWorld(map, shot!.x, shot!.y)).toBe(false);
    }

    expect(recycledAt).not.toBeNull();
    expect(pool.activeCount).toBe(0);
    expect(pool.recycleCount).toBe(1);
    // Floor starts at y=200; speed 8 → first solid contact within ~16 ticks from y=75.
    expect(recycledAt!).toBeLessThanOrEqual(20);
  });

  it('standard ballistic bullets cannot cross solid ground tiles (AC)', () => {
    const map = solidFloorMap();
    const bounds = arenaCullBounds(300, 300);
    const bullet = createInactiveBullet(0);
    activateBullet(bullet, 125, 175, 90, {
      speed: BULLET.defaultSpeed,
      damage: BULLET.defaultDamage,
    });

    // One step into the floor band (y=175+8=183 still air; keep stepping).
    let hitSolid = false;
    for (let i = 0; i < 10; i += 1) {
      const cull = stepSpecialBullet(bullet, [], 1, bounds, map);
      if (cull) {
        hitSolid = isSolidAtWorld(map, bullet.x, bullet.y);
        expect(cull).toBe(true);
        break;
      }
    }
    expect(hitSolid).toBe(true);
    // Position after the recycling step is inside the solid cell (Flash removes
    // after the move that entered the tile).
    expect(Math.floor(bullet.y / WORLD.tile)).toBe(4);
  });

  it('off-screen cull behavior remains unchanged without a map (AC)', () => {
    const bounds = arenaCullBounds(TEST_ARENA_WIDTH_PX, TEST_ARENA_HEIGHT_PX);
    expect(bounds).toEqual({
      minX: -50,
      minY: -50,
      maxX: TEST_ARENA_WIDTH_PX + 50,
      maxY: TEST_ARENA_HEIGHT_PX + 50,
    });

    const pool = new BulletPool(2);
    // One step past the right cull edge (maxX = arenaW + 50).
    const justInside = TEST_ARENA_WIDTH_PX + 50 - BULLET.defaultSpeed + 1;
    pool.acquire(justInside, 100, 0, { speed: BULLET.defaultSpeed });
    expect(pool.activeCount).toBe(1);
    expect(isOutsideCullBounds(justInside, 100, bounds)).toBe(false);

    stepBulletsVsHelis(pool, [], bounds, 1); // no map
    expect(pool.activeCount).toBe(0);
    expect(pool.recycleCount).toBe(1);

    // Same OOB probe still holds with an empty (non-solid) map present.
    const empty = createTileMap(
      [
        [TILE_EMPTY, TILE_EMPTY],
        [TILE_EMPTY, TILE_EMPTY],
      ],
      WORLD.tile,
    );
    pool.acquire(justInside, 100, 0, { speed: BULLET.defaultSpeed });
    stepBulletsVsHelis(pool, [], bounds, 1, undefined, empty);
    expect(pool.activeCount).toBe(0);
  });

  it('enemy bullets keep solid-tile recycle via enemyBulletHitsSolid (AC)', () => {
    const map = createTestArena();
    expect(enemyBulletHitsSolid(100, 100, map)).toBe(false);
    // Test-arena floor band includes solid at (2,12) → world (100, 600).
    expect(enemyBulletHitsSolid(100, 600, map)).toBe(true);
    expect(TILE_SOLID).toBe(1);

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

  it('FireMines still bounce / plant on solids instead of instant recycle (AC)', () => {
    const map = solidFloorMap();
    const bounds = arenaCullBounds(300, 300);
    const bullet = createInactiveBullet(0);
    activateBullet(bullet, 125, 100, 90, {
      speed: WEAPONS[9].speed,
      damage: WEAPONS[9].damage,
      maxLifetime: 300,
      behavior: 'mine',
    });
    bullet.vy = 4;

    // Drive until planted on the floor — must remain active (not recycled).
    for (let i = 0; i < 80; i += 1) {
      const cull = stepMineBullet(bullet, [], 1, bounds, map);
      expect(cull).toBe(false);
      if (bullet.mineActive >= 1) {
        break;
      }
    }
    expect(bullet.mineActive).toBeGreaterThanOrEqual(1);
    expect(bullet.active).toBe(true);
    // Planted just above the solid floor cell.
    expect(bullet.y).toBe(4 * WORLD.tile - 1);
  });

  it('heli hit still recycles ballistic shots when a map is present', () => {
    const map = solidFloorMap();
    const pool = new BulletPool(2);
    const bounds = arenaCullBounds(1200, 800);
    const heli = createHelicopter(400, 180, 300);
    const left = heli.x - 212 / 2;
    const top = heli.y - 106 / 2;
    // Known opaque local pixel from heliHit tests: (22, 2).
    const hitX = left + 22;
    const hitY = top + 2;
    pool.acquire(hitX - BULLET.defaultSpeed, hitY, 0, {
      speed: BULLET.defaultSpeed,
      damage: 10,
    });

    stepBulletsVsHelis(pool, [heli], bounds, 1, undefined, map);
    expect(pool.activeCount).toBe(0);
    expect(heli.health).toBe(290);
  });
});
