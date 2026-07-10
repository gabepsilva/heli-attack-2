/**
 * Enemy projectiles — Flash `addEnemyBullet` / `enemyBulletFrame` (#18).
 * Separate pool from player bullets so hit tests never cross-contaminate.
 */

import { ENEMY_BULLET, WORLD } from '../config/constants';
import {
  arenaCullBounds,
  isOutsideCullBounds,
  velocityFromRotation,
  type CullBounds,
} from './bullet';
import {
  damagePlayer,
  isPlayerInvulnerable,
  type PlayerHealthState,
} from './playerHealth';
import type { AabbBody } from '../world/aabbBody';
import { getTile, TILE_EMPTY, type TileMap } from '../world/tileMap';

export type EnemyBullet = {
  readonly index: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  rotationDeg: number;
  age: number;
  maxLifetime: number;
};

export type EnemyBulletHitEvent = {
  damage: number;
  killed: boolean;
};

export function createInactiveEnemyBullet(index: number): EnemyBullet {
  return {
    index,
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    damage: 0,
    rotationDeg: 0,
    age: 0,
    maxLifetime: ENEMY_BULLET.maxLifetimeFrames,
  };
}

export function activateEnemyBullet(
  bullet: EnemyBullet,
  x: number,
  y: number,
  rotationDeg: number,
  speed: number = ENEMY_BULLET.speed,
  damage: number = ENEMY_BULLET.damage,
  maxLifetime: number = ENEMY_BULLET.maxLifetimeFrames,
): void {
  const { vx, vy } = velocityFromRotation(speed, rotationDeg);
  bullet.active = true;
  bullet.x = x;
  bullet.y = y;
  bullet.vx = vx;
  bullet.vy = vy;
  bullet.speed = speed;
  bullet.damage = damage;
  bullet.rotationDeg = rotationDeg;
  bullet.age = 0;
  bullet.maxLifetime = maxLifetime;
}

/** Point-in-AABB (Flash `player.gfx.hit.hitTest` stand-in using the collision box). */
export function pointHitsPlayerAabb(
  x: number,
  y: number,
  body: AabbBody,
): boolean {
  return (
    x >= body.x && x < body.x + body.w && y >= body.y && y < body.y + body.h
  );
}

/** Flash solid / OOB cull: `map[y][x][0] != 0`. */
export function enemyBulletHitsSolid(
  x: number,
  y: number,
  map: TileMap,
): boolean {
  const col = Math.floor(x / WORLD.tile);
  const row = Math.floor(y / WORLD.tile);
  const cell = getTile(map, col, row);
  return cell !== TILE_EMPTY;
}

/**
 * One motion tick. Returns true when the bullet should recycle (lifetime,
 * off-screen, solid tile, or player hit — caller applies damage separately).
 */
export function stepEnemyBulletMotion(
  bullet: EnemyBullet,
  timeStep: number,
  bounds: CullBounds,
  map?: TileMap,
): boolean {
  if (!bullet.active) {
    return false;
  }
  bullet.x += bullet.vx * timeStep;
  bullet.y += bullet.vy * timeStep;
  bullet.age += timeStep;
  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  if (isOutsideCullBounds(bullet.x, bullet.y, bounds)) {
    return true;
  }
  if (map && enemyBulletHitsSolid(bullet.x, bullet.y, map)) {
    return true;
  }
  return false;
}

export class EnemyBulletPool {
  readonly slots: readonly EnemyBullet[];
  private readonly freeStack: Int32Array;
  private freeTop: number;
  private _activeCount = 0;
  private _acquireCount = 0;
  private _recycleCount = 0;

  constructor(capacity: number = ENEMY_BULLET.poolCapacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `EnemyBulletPool capacity must be a positive integer, got ${capacity}`,
      );
    }
    const slots: EnemyBullet[] = [];
    const freeStack = new Int32Array(capacity);
    for (let i = 0; i < capacity; i += 1) {
      slots.push(createInactiveEnemyBullet(i));
      freeStack[i] = capacity - 1 - i;
    }
    this.slots = slots;
    this.freeStack = freeStack;
    this.freeTop = capacity;
  }

  get capacity(): number {
    return this.slots.length;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  get acquireCount(): number {
    return this._acquireCount;
  }

  get recycleCount(): number {
    return this._recycleCount;
  }

  reset(): void {
    for (let i = 0; i < this.slots.length; i += 1) {
      this.slots[i]!.active = false;
      this.freeStack[i] = this.slots.length - 1 - i;
    }
    this.freeTop = this.slots.length;
    this._activeCount = 0;
    this._acquireCount = 0;
    this._recycleCount = 0;
  }

  acquire(
    x: number,
    y: number,
    rotationDeg: number,
    speed: number = ENEMY_BULLET.speed,
    damage: number = ENEMY_BULLET.damage,
    maxLifetime: number = ENEMY_BULLET.maxLifetimeFrames,
  ): EnemyBullet | null {
    if (this.freeTop <= 0) {
      return null;
    }
    this.freeTop -= 1;
    const index = this.freeStack[this.freeTop]!;
    const bullet = this.slots[index]!;
    activateEnemyBullet(bullet, x, y, rotationDeg, speed, damage, maxLifetime);
    this._activeCount += 1;
    this._acquireCount += 1;
    return bullet;
  }

  release(bullet: EnemyBullet): void {
    if (!bullet.active) {
      return;
    }
    bullet.active = false;
    this.freeStack[this.freeTop] = bullet.index;
    this.freeTop += 1;
    this._activeCount -= 1;
    this._recycleCount += 1;
  }
}

export function enemyBulletArenaCullBounds(
  arenaWidth: number,
  arenaHeight: number,
  margin: number = ENEMY_BULLET.cullMargin,
): CullBounds {
  return arenaCullBounds(arenaWidth, arenaHeight, margin);
}

/**
 * Advance enemy bullets, apply player damage on AABB hit, recycle on hit /
 * solid / cull. I-frames gate damage so stacked same-frame hits only apply once.
 */
export function stepEnemyBulletsVsPlayer(
  pool: EnemyBulletPool,
  playerBody: AabbBody,
  health: PlayerHealthState,
  bounds: CullBounds,
  timeStep: number,
  map?: TileMap,
  onHit?: (event: EnemyBulletHitEvent) => void,
): void {
  for (let i = 0; i < pool.slots.length; i += 1) {
    const bullet = pool.slots[i]!;
    if (!bullet.active) {
      continue;
    }

    const shouldCullMotion = stepEnemyBulletMotion(
      bullet,
      timeStep,
      bounds,
      map,
    );
    if (shouldCullMotion) {
      pool.release(bullet);
      continue;
    }

    if (!pointHitsPlayerAabb(bullet.x, bullet.y, playerBody)) {
      continue;
    }

    // Always recycle on contact (Flash removes the bullet even under invuln
    // powerup — here i-frames still consume the projectile).
    pool.release(bullet);

    if (isPlayerInvulnerable(health)) {
      continue;
    }

    const result = damagePlayer(health, bullet.damage);
    if (result.applied > 0 && onHit) {
      onHit({ damage: result.applied, killed: result.killed });
    }
  }
}
