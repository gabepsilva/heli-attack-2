/**
 * Special-behavior projectiles (#16) — Flash `flameFrame` / `fireMinesFrame` /
 * `railFrame` / `seekerFrame`.
 *
 * Ballistic bullets stay on the default hit-and-recycle path in helicopter.ts;
 * this module owns continuous DoT, lobbed mines, hitscan rail, and homing.
 */

import { HELI, SPECIAL_PROJECTILE, WORLD } from '../config/constants';
import {
  isOutsideCullBounds,
  velocityFromRotation,
  type Bullet,
  type CullBounds,
} from './bullet';
import { bulletHitsHeli } from './heliHit';
import type { Helicopter, HeliHitEvent } from './helicopter';
import { isSolidTile, type TileMap } from '../world/tileMap';

/** Projectile motion / hit model (Flash bullet `action` frame). */
export type BulletBehavior = 'ballistic' | 'flame' | 'mine' | 'rail' | 'seeker';

/** Arsenal indices with dedicated special behaviors (#16 deliverable). */
export const SPECIAL_WEAPON_INDICES = [7, 8, 9, 11] as const;

export function behaviorForWeapon(weaponIndex: number): BulletBehavior {
  switch (weaponIndex) {
    case 7:
      return 'seeker';
    case 8:
      return 'flame';
    case 9:
      return 'mine';
    case 11:
      return 'rail';
    default:
      return 'ballistic';
  }
}

/** World-space solid probe — Flash `map[floor(y/tile)][floor(x/tile)][0] != 0`. */
export function isSolidAtWorld(map: TileMap, x: number, y: number): boolean {
  const col = Math.floor(x / map.tileSize);
  const row = Math.floor(y / map.tileSize);
  return isSolidTile(map, col, row);
}

/**
 * Shortest signed angle delta in degrees (Flash seeker `dif` wrap at ±179).
 */
export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  let dif = toDeg - fromDeg;
  if (dif > 179) {
    dif -= 360;
  } else if (dif < -179) {
    dif += 360;
  }
  return dif;
}

/** Aim degrees from `(x,y)` toward `(tx,ty)` — matches `velocityFromRotation`. */
export function aimDegToward(
  x: number,
  y: number,
  tx: number,
  ty: number,
): number {
  return (Math.atan2(ty - y, tx - x) * 180) / Math.PI;
}

/** Nearest active heli by Euclidean distance, or null if none. */
export function findNearestHeli(
  x: number,
  y: number,
  helis: readonly Helicopter[],
): Helicopter | null {
  let closest: Helicopter | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < helis.length; i += 1) {
    const heli = helis[i]!;
    if (!heli.active) {
      continue;
    }
    const dx = heli.x - x;
    const dy = heli.y - y;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      closest = heli;
    }
  }
  return closest;
}

function applyDamage(
  heli: Helicopter,
  damage: number,
  onHit?: (event: HeliHitEvent) => void,
): void {
  if (!heli.active || damage <= 0) {
    return;
  }
  // Mirrors damageHelicopter — kept local to avoid a circular import with
  // helicopter.ts (which dispatches here via stepSpecialBullet).
  heli.health -= damage;
  heli.hitFlashRemaining = HELI.hitFlashFrames;
  const killed = heli.health <= 0;
  if (killed) {
    heli.active = false;
  }
  if (onHit) {
    onHit({ heli, damage, killed });
  }
}

function heliHitTarget(heli: Helicopter) {
  return {
    x: heli.x,
    y: heli.y,
    spriteW: HELI.spriteW,
    spriteH: HELI.spriteH,
  };
}

/**
 * Flash `railFrame` hitscan: for each heli, march along the aim vector in
 * `speed`-sized steps until off-bounds or a pixel hit, then apply full damage.
 * Returns true when the beam should recycle (linger expired).
 */
export function stepRailBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  bullet.age += timeStep;

  // Hitscan once on the first discrete step (Flash `anim == 1`).
  // Sub-step along the aim vector at 1px so speed-20 beams cannot skip thin
  // mask pixels (Flash marched by full `xspeed`, which can tunnel).
  if (!bullet.railFired) {
    bullet.railFired = true;
    const len = Math.hypot(bullet.vx, bullet.vy) || 1;
    const dx = bullet.vx / len;
    const dy = bullet.vy / len;
    for (let h = 0; h < helis.length; h += 1) {
      const heli = helis[h]!;
      if (!heli.active) {
        continue;
      }
      let tx = bullet.x;
      let ty = bullet.y;
      while (!isOutsideCullBounds(tx, ty, bounds)) {
        tx += dx;
        ty += dy;
        if (bulletHitsHeli(tx, ty, heliHitTarget(heli))) {
          applyDamage(heli, bullet.damage, onHit);
          break;
        }
      }
    }
  }

  return bullet.age >= SPECIAL_PROJECTILE.railLingerFrames;
}

/**
 * Flash `flameFrame`: move, DoT while overlapping (no recycle on hit), expire
 * when lifetime ends. Damage falls off with age like gfx frame progress.
 */
export function stepFlameBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  bullet.x += bullet.vx * timeStep;
  bullet.y += bullet.vy * timeStep;
  bullet.age += timeStep;

  const progress = Math.min(1, bullet.age / bullet.maxLifetime);
  const tickDamage = bullet.damage * (1 - progress) * timeStep;

  for (let h = 0; h < helis.length; h += 1) {
    const heli = helis[h]!;
    if (!heli.active) {
      continue;
    }
    if (bulletHitsHeli(bullet.x, bullet.y, heliHitTarget(heli))) {
      applyDamage(heli, tickDamage, onHit);
      // Continuous stream — do not recycle on hit.
      break;
    }
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Flash `fireMinesFrame`: lob with gravity, bounce off walls, plant on floor,
 * then persistent DoT until `mineActive` exceeds the planted lifetime.
 */
export function stepMineBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  map: TileMap,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  // Discrete move accumulator (Flash `stepc` / `move`).
  bullet.stepAccum += timeStep;
  let moved = false;
  if (bullet.stepAccum > 1) {
    if (bullet.mineActive === 0) {
      bullet.vy += SPECIAL_PROJECTILE.mineGravity;
    }
    bullet.stepAccum -= 1;
    moved = true;
  }

  if (bullet.mineActive === 0) {
    // Horizontal move + wall bounce.
    bullet.x += bullet.vx * timeStep;
    if (isSolidAtWorld(map, bullet.x, bullet.y)) {
      bullet.x -= bullet.vx * timeStep;
      bullet.vx *= SPECIAL_PROJECTILE.mineBounceScale;
    }
    // Vertical move + plant on floor.
    bullet.y += bullet.vy * timeStep;
    if (isSolidAtWorld(map, bullet.x, bullet.y)) {
      const row = Math.floor(bullet.y / map.tileSize);
      bullet.y = row * map.tileSize - 1;
      bullet.vx = 0;
      bullet.vy = 0;
      bullet.mineActive = 1;
    }
  } else if (moved) {
    bullet.mineActive += 1;
  }

  bullet.age += timeStep;
  bullet.rotationDeg = 0;

  if (bullet.mineActive > 0) {
    for (let h = 0; h < helis.length; h += 1) {
      const heli = helis[h]!;
      if (!heli.active) {
        continue;
      }
      if (bulletHitsHeli(bullet.x, bullet.y, heliHitTarget(heli))) {
        applyDamage(heli, bullet.damage * timeStep, onHit);
        break;
      }
    }
    if (bullet.mineActive > SPECIAL_PROJECTILE.mineActiveFrames) {
      return true;
    }
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Flash `seekerFrame`: steer toward the nearest heli by `dif/15`, then
 * hit-and-recycle like a normal rocket.
 */
export function stepSeekerBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  const target = findNearestHeli(bullet.x, bullet.y, helis);
  if (target !== null) {
    const desired = aimDegToward(bullet.x, bullet.y, target.x, target.y);
    const current = ((bullet.rotationDeg % 360) + 360) % 360;
    const desiredNorm = ((desired % 360) + 360) % 360;
    const dif = shortestAngleDeltaDeg(current, desiredNorm);
    bullet.rotationDeg +=
      (dif / SPECIAL_PROJECTILE.seekerTurnDivisor) * timeStep;
    const { vx, vy } = velocityFromRotation(bullet.speed, bullet.rotationDeg);
    bullet.vx = vx;
    bullet.vy = vy;
  }

  bullet.x += bullet.vx * timeStep;
  bullet.y += bullet.vy * timeStep;
  bullet.age += timeStep;

  for (let h = 0; h < helis.length; h += 1) {
    const heli = helis[h]!;
    if (!heli.active) {
      continue;
    }
    if (bulletHitsHeli(bullet.x, bullet.y, heliHitTarget(heli))) {
      applyDamage(heli, bullet.damage, onHit);
      return true;
    }
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Dispatch one active special (or ballistic) projectile tick.
 * {@link map} is required for mines; ignored by other behaviors.
 */
export function stepSpecialBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  map: TileMap | undefined,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  switch (bullet.behavior) {
    case 'flame':
      return stepFlameBullet(bullet, helis, timeStep, bounds, onHit);
    case 'mine':
      if (!map) {
        // Without a map, mines cannot plant — fall back to ballistic motion.
        break;
      }
      return stepMineBullet(bullet, helis, timeStep, bounds, map, onHit);
    case 'rail':
      return stepRailBullet(bullet, helis, timeStep, bounds, onHit);
    case 'seeker':
      return stepSeekerBullet(bullet, helis, timeStep, bounds, onHit);
    case 'ballistic':
    default:
      break;
  }

  // Ballistic fallback (same as prior stepBulletWithHit motion+hit).
  bullet.x += bullet.vx * timeStep;
  bullet.y += bullet.vy * timeStep;
  bullet.age += timeStep;

  for (let h = 0; h < helis.length; h += 1) {
    const heli = helis[h]!;
    if (!heli.active) {
      continue;
    }
    if (bulletHitsHeli(bullet.x, bullet.y, heliHitTarget(heli))) {
      applyDamage(heli, bullet.damage, onHit);
      return true;
    }
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/** Tile size used by Flash mine/grenade probes — always {@link WORLD.tile}. */
export const SPECIAL_TILE = WORLD.tile;
