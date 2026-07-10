/**
 * Pooled projectiles — plain sim objects matching HA2 `addBullet` / `bulletFrame`.
 * Phaser only draws active slots; acquire/release never allocates after ctor.
 *
 * Flash:
 *   xspeed = speed * cos(rot°); yspeed = speed * sin(rot°)
 *   _x += xspeed * timeStep; _y += yspeed * timeStep
 *   remove when off-screen (±1 tile) / lifetime / (later: hit / solid)
 */

import { BULLET } from '../config/constants';
import type { BulletBehavior } from './specialProjectile';

export type { BulletBehavior };

export type Bullet = {
  /** Fixed slot index in the owning pool (set once at construction). */
  readonly index: number;
  active: boolean;
  x: number;
  y: number;
  /** Velocity X (px/sim-frame at timeStep=1) — Flash `xspeed`. */
  vx: number;
  /** Velocity Y (px/sim-frame at timeStep=1) — Flash `yspeed`. */
  vy: number;
  speed: number;
  damage: number;
  rotationDeg: number;
  /** Accumulated sim age (increments by `timeStep` each tick). */
  age: number;
  maxLifetime: number;
  /** Motion / hit model (#16/#17 specials; default ballistic). */
  behavior: BulletBehavior;
  /**
   * FireMines planted counter (Flash `active`). 0 = still lobbing;
   * ≥1 = planted and counting persistence frames.
   */
  mineActive: number;
  /** FireMines / flame discrete-step accumulator (Flash `stepc`). */
  stepAccum: number;
  /** RailGun: hitscan already applied this beam (Flash `anim == 1`). */
  railFired: boolean;
  /** GrappleCannon: hook has latched (Flash `grappleAttached`). */
  grappleAttached: boolean;
  /** GrappleCannon: frames spent latched (auto-release after max). */
  grappleAttachedAge: number;
};

/** Axis-aligned cull region in arena/world space. */
export type CullBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

/** Build inactive bullet fields (used once per pool slot at construction). */
export function createInactiveBullet(index: number): Bullet {
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
    maxLifetime: BULLET.maxLifetimeFrames,
    behavior: 'ballistic',
    mineActive: 0,
    stepAccum: 0,
    railFired: false,
    grappleAttached: false,
    grappleAttachedAge: 0,
  };
}

/**
 * Flash `addBullet` velocity from rotation degrees (0 = +X, 90 = +Y/down).
 */
export function velocityFromRotation(
  speed: number,
  rotationDeg: number,
): { vx: number; vy: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    vx: speed * Math.cos(rad),
    vy: speed * Math.sin(rad),
  };
}

/** Arena AABB expanded by {@link BULLET.cullMargin} (Flash ±1 tile). */
export function arenaCullBounds(
  arenaWidth: number,
  arenaHeight: number,
  margin: number = BULLET.cullMargin,
): CullBounds {
  return {
    minX: -margin,
    minY: -margin,
    maxX: arenaWidth + margin,
    maxY: arenaHeight + margin,
  };
}

export function isOutsideCullBounds(
  x: number,
  y: number,
  bounds: CullBounds,
): boolean {
  return (
    x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY
  );
}

/**
 * Write spawn fields onto an existing slot (no allocation).
 * Velocity matches Flash `speed * cos/sin(rot)`.
 */
export function activateBullet(
  bullet: Bullet,
  x: number,
  y: number,
  rotationDeg: number,
  speed: number = BULLET.defaultSpeed,
  damage: number = BULLET.defaultDamage,
  maxLifetime: number = BULLET.maxLifetimeFrames,
  behavior: BulletBehavior = 'ballistic',
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
  bullet.behavior = behavior;
  bullet.mineActive = 0;
  bullet.stepAccum = 0;
  bullet.railFired = false;
  bullet.grappleAttached = false;
  bullet.grappleAttachedAge = 0;
}

/**
 * One sim tick of motion for an active bullet. Returns true if it should
 * recycle (lifetime expired or outside cull bounds).
 */
export function stepBullet(
  bullet: Bullet,
  timeStep: number,
  bounds: CullBounds,
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
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Fixed-capacity object pool. After construction, {@link acquire} / {@link release}
 * / {@link stepAll} mutate slots in place — no `new`, no array growth.
 */
export class BulletPool {
  /** Preallocated slots (length === capacity). */
  readonly slots: readonly Bullet[];

  private readonly freeStack: Int32Array;
  private freeTop: number;
  private _activeCount = 0;
  private _acquireCount = 0;
  private _recycleCount = 0;

  constructor(capacity: number = BULLET.poolCapacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `BulletPool capacity must be a positive integer, got ${capacity}`,
      );
    }
    const slots: Bullet[] = [];
    const freeStack = new Int32Array(capacity);
    for (let i = 0; i < capacity; i += 1) {
      slots.push(createInactiveBullet(i));
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

  get freeCount(): number {
    return this.freeTop;
  }

  /** Total successful acquires since construction (HUD reuse counter). */
  get acquireCount(): number {
    return this._acquireCount;
  }

  /** Total releases / culls since construction. */
  get recycleCount(): number {
    return this._recycleCount;
  }

  /**
   * Activate a free slot at the muzzle. Returns the slot, or `null` if the
   * pool is exhausted (does **not** grow — acceptance: pool never grows).
   */
  acquire(
    x: number,
    y: number,
    rotationDeg: number,
    speed: number = BULLET.defaultSpeed,
    damage: number = BULLET.defaultDamage,
    maxLifetime: number = BULLET.maxLifetimeFrames,
    behavior: BulletBehavior = 'ballistic',
  ): Bullet | null {
    if (this.freeTop <= 0) {
      return null;
    }
    this.freeTop -= 1;
    const index = this.freeStack[this.freeTop]!;
    const bullet = this.slots[index]!;
    activateBullet(
      bullet,
      x,
      y,
      rotationDeg,
      speed,
      damage,
      maxLifetime,
      behavior,
    );
    this._activeCount += 1;
    this._acquireCount += 1;
    return bullet;
  }

  /** Return an active slot to the free list (idempotent if already inactive). */
  release(bullet: Bullet): void {
    if (!bullet.active) {
      return;
    }
    const index = bullet.index;
    if (this.slots[index] !== bullet) {
      return;
    }
    bullet.active = false;
    this.freeStack[this.freeTop] = index;
    this.freeTop += 1;
    this._activeCount -= 1;
    this._recycleCount += 1;
  }

  /**
   * Advance every active bullet; recycle those that expire or leave bounds.
   * Iterates the fixed `slots` array — no per-frame allocation.
   */
  stepAll(timeStep: number, bounds: CullBounds): void {
    for (let i = 0; i < this.slots.length; i += 1) {
      const bullet = this.slots[i]!;
      if (!bullet.active) {
        continue;
      }
      if (stepBullet(bullet, timeStep, bounds)) {
        this.release(bullet);
      }
    }
  }

  /** Deactivate every slot and refill the free stack (scene reset). */
  reset(): void {
    this.freeTop = 0;
    this._activeCount = 0;
    for (let i = 0; i < this.slots.length; i += 1) {
      const bullet = this.slots[i]!;
      bullet.active = false;
      this.freeStack[this.freeTop] = i;
      this.freeTop += 1;
    }
    // Keep acquire/recycle counters — HUD can show lifetime reuse across resets,
    // but scene restart should zero them for a clean demo.
    this._acquireCount = 0;
    this._recycleCount = 0;
  }
}
