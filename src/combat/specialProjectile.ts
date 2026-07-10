/**
 * Special-behavior projectiles (#16/#17) — Flash `flameFrame` / `fireMinesFrame`
 * / `railFrame` / `seekerFrame` / `aBombFrame` / `grappleFrame`.
 *
 * Ballistic bullets stay on the default hit-and-recycle path in helicopter.ts;
 * this module owns continuous DoT, lobbed mines, hitscan rail, homing, A-Bomb
 * blast, and Grapple pull.
 */

import {
  HELI,
  HEAVY_PROJECTILE,
  SPECIAL_PROJECTILE,
  WORLD,
} from '../config/constants';
import {
  isOutsideCullBounds,
  velocityFromRotation,
  type Bullet,
  type CullBounds,
} from './bullet';
import { bulletHitsHeli } from './heliHit';
import type { Helicopter, HeliHitEvent } from './helicopter';
import type { AabbBody } from '../world/aabbBody';
import { isSolidTile, type TileMap } from '../world/tileMap';

/** Projectile motion / hit model (Flash bullet `action` frame). */
export type BulletBehavior =
  'ballistic' | 'flame' | 'mine' | 'rail' | 'seeker' | 'abomb' | 'grapple';

/** Arsenal indices with dedicated special behaviors (#16 deliverable). */
export const SPECIAL_WEAPON_INDICES = [7, 8, 9, 11] as const;

/** Arsenal indices for heavy / signature weapons (#17 deliverable). */
export const HEAVY_WEAPON_INDICES = [10, 12, 13] as const;

export function behaviorForWeapon(weaponIndex: number): BulletBehavior {
  switch (weaponIndex) {
    case 7:
      return 'seeker';
    case 8:
      return 'flame';
    case 9:
      return 'mine';
    case 10:
      return 'abomb';
    case 11:
    case 13:
      // RailGun + ShoulderCannon both use Flash `railFrame`.
      return 'rail';
    case 12:
      return 'grapple';
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
  bullet?: Bullet,
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
  let firstContact = true;
  if (bullet !== undefined) {
    firstContact = !bullet.hasHit;
    bullet.hasHit = true;
  }
  if (onHit) {
    onHit({ heli, damage, killed, firstContact });
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
          applyDamage(heli, bullet.damage, onHit, bullet);
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
      applyDamage(heli, tickDamage, onHit, bullet);
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
        applyDamage(heli, bullet.damage * timeStep, onHit, bullet);
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
      applyDamage(heli, bullet.damage, onHit, bullet);
      return true;
    }
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/** Euclidean distance between two points. */
export function distance2d(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  return Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Flash A-Bomb player knockback angle:
 * `360 - atan2(px-bx, py-by)*180/π + 90`.
 */
export function abombKnockbackAngleDeg(
  bombX: number,
  bombY: number,
  playerX: number,
  playerY: number,
): number {
  return (
    360 - (Math.atan2(playerX - bombX, playerY - bombY) * 180) / Math.PI + 90
  );
}

/**
 * Apply Flash `aBombFrame` knockback to the player when inside the blast
 * radius. Uses feet point `(x+w/2, y+h)` like the original.
 */
export function applyAbombKnockback(
  player: AabbBody,
  bombX: number,
  bombY: number,
): void {
  const px = player.x + player.w / 2;
  const py = player.y + player.h;
  const dist = distance2d(bombX, bombY, px, py);
  const radius = HEAVY_PROJECTILE.abombBlastRadius;
  if (dist >= radius) {
    return;
  }
  const mult = 1 - dist / radius;
  const ang = abombKnockbackAngleDeg(bombX, bombY, px, py);
  const rad = (ang * Math.PI) / 180;
  player.vx += Math.trunc(
    mult * HEAVY_PROJECTILE.abombKnockbackX * Math.cos(rad),
  );
  player.vy += mult * HEAVY_PROJECTILE.abombKnockbackY * Math.sin(rad);
  player.onGround = false;
}

/**
 * Damage every active heli whose center is within the A-Bomb blast radius.
 * Returns how many helis were hit (for tests / scoring callbacks).
 */
export function applyAbombBlastDamage(
  bombX: number,
  bombY: number,
  damage: number,
  helis: readonly Helicopter[],
  onHit?: (event: HeliHitEvent) => void,
  bullet?: Bullet,
): number {
  let hitCount = 0;
  const radius = HEAVY_PROJECTILE.abombBlastRadius;
  for (let h = 0; h < helis.length; h += 1) {
    const heli = helis[h]!;
    if (!heli.active) {
      continue;
    }
    if (distance2d(bombX, bombY, heli.x, heli.y) <= radius) {
      applyDamage(heli, damage, onHit, bullet);
      hitCount += 1;
    }
  }
  return hitCount;
}

/**
 * Flash `aBombFrame`: slow projectile; on heli hit or solid tile, detonate a
 * large blast (radius 300) that one-shots helis inside and knocks the player.
 */
export function stepAbombBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  map: TileMap | undefined,
  player: AabbBody | undefined,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  bullet.x += bullet.vx * timeStep;
  bullet.y += bullet.vy * timeStep;
  bullet.age += timeStep;

  let detonate = false;
  for (let h = 0; h < helis.length; h += 1) {
    const heli = helis[h]!;
    if (!heli.active) {
      continue;
    }
    if (bulletHitsHeli(bullet.x, bullet.y, heliHitTarget(heli))) {
      detonate = true;
      break;
    }
  }
  if (!detonate && map && isSolidAtWorld(map, bullet.x, bullet.y)) {
    detonate = true;
  }

  if (detonate) {
    applyAbombBlastDamage(
      bullet.x,
      bullet.y,
      bullet.damage,
      helis,
      onHit,
      bullet,
    );
    if (player) {
      applyAbombKnockback(player, bullet.x, bullet.y);
    }
    return true;
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Pull the player toward the grapple hook (port mobility for Flash rope).
 * Returns the velocity delta applied (for tests).
 */
export function applyGrapplePull(
  player: AabbBody,
  hookX: number,
  hookY: number,
  timeStep: number = 1,
): { dvx: number; dvy: number } {
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const dx = hookX - px;
  const dy = hookY - py;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return { dvx: 0, dvy: 0 };
  }
  const accel = HEAVY_PROJECTILE.grapplePullAccel * timeStep;
  const dvx = (dx / dist) * accel;
  const dvy = (dy / dist) * accel;
  player.vx += dvx;
  player.vy += dvy;
  player.onGround = false;
  return { dvx, dvy };
}

/**
 * Flash `grappleFrame` / `grappleAttached`: fly until heli or solid latch,
 * deal damage on heli hit, then reel the player toward the hook.
 */
export function stepGrappleBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  map: TileMap | undefined,
  player: AabbBody | undefined,
  onHit?: (event: HeliHitEvent) => void,
): boolean {
  if (bullet.grappleAttached) {
    bullet.grappleAttachedAge += timeStep;
    bullet.age += timeStep;
    if (player) {
      applyGrapplePull(player, bullet.x, bullet.y, timeStep);
    }
    return bullet.grappleAttachedAge >= HEAVY_PROJECTILE.grappleAttachedFrames;
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
      applyDamage(heli, bullet.damage, onHit, bullet);
      bullet.grappleAttached = true;
      bullet.vx = 0;
      bullet.vy = 0;
      if (player) {
        applyGrapplePull(player, bullet.x, bullet.y, timeStep);
      }
      return false;
    }
  }

  if (map && isSolidAtWorld(map, bullet.x, bullet.y)) {
    // Nudge back out of the solid cell so the hook sits on the surface.
    bullet.x -= bullet.vx * timeStep;
    bullet.y -= bullet.vy * timeStep;
    bullet.grappleAttached = true;
    bullet.vx = 0;
    bullet.vy = 0;
    if (player) {
      applyGrapplePull(player, bullet.x, bullet.y, timeStep);
    }
    return false;
  }

  if (bullet.age >= bullet.maxLifetime) {
    return true;
  }
  return isOutsideCullBounds(bullet.x, bullet.y, bounds);
}

/**
 * Dispatch one active special (or ballistic) projectile tick.
 * {@link map} is required for mines / A-Bomb solid / grapple latch;
 * {@link player} enables A-Bomb knockback and Grapple pull.
 */
export function stepSpecialBullet(
  bullet: Bullet,
  helis: readonly Helicopter[],
  timeStep: number,
  bounds: CullBounds,
  map: TileMap | undefined,
  onHit?: (event: HeliHitEvent) => void,
  player?: AabbBody,
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
    case 'abomb':
      return stepAbombBullet(
        bullet,
        helis,
        timeStep,
        bounds,
        map,
        player,
        onHit,
      );
    case 'grapple':
      return stepGrappleBullet(
        bullet,
        helis,
        timeStep,
        bounds,
        map,
        player,
        onHit,
      );
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
      applyDamage(heli, bullet.damage, onHit, bullet);
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
