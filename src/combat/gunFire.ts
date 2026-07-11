/**
 * Per-weapon projectile spawn patterns — Flash `guns[i].gun(...)` (#15/#16).
 *
 * Ballistic set (indices 1–6) plus MachineGun (0):
 * - AkimboMac10: twin-stream (muzzle + one-frame lead offset), ±8° jitter
 * - Shotgun: five pellets at −10/−5/0/+5/+10°
 * - ShotgunRockets: three rockets at −10/0/+10°
 * - GrenadeLauncher / RPG / RocketLauncher: single projectile at aim
 *
 * Special-behavior set (#16):
 * - SeekerLauncher (7): single homing rocket
 * - FlameThrower (8): hold-to-fire stream with ±10° jitter
 * - FireMines (9): lobbed persistent mine
 * - RailGun (11): hitscan-fast beam
 *
 * Heavy / signature set (#17):
 * - ABombLauncher (10): slow nuke with huge blast
 * - GrappleCannon (12): damage + pull mobility
 * - ShoulderCannon (13): predator rail (Flash `railFrame`)
 */

import { SPECIAL_PROJECTILE } from '../config/constants';
import { getWeaponDef, type WeaponDef } from '../config/weapons';
import { smokeTrailIntervalForWeapon } from '../fx/particleEvents';
import { velocityFromRotation } from './bullet';
import { behaviorForWeapon, type BulletBehavior } from './specialProjectile';

/** One projectile to acquire from the pool. */
export type ProjectileSpawn = Readonly<{
  x: number;
  y: number;
  rotationDeg: number;
  speed: number;
  damage: number;
  behavior: BulletBehavior;
  maxLifetime?: number;
  /** Smoke trail cadence in sim frames (0 / omit = none). Issue #35. */
  smokeTrailInterval?: number;
  /** Arsenal slot for atlas frame selection. */
  weaponIndex: number;
}>;

/** Flash `random(n)` — integer in `[0, n)`. */
export type RandomInt = (maxExclusive: number) => number;

/** Default RNG matching Flash `random(n)`. */
export function flashRandomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/** Shotgun pellet aim offsets in degrees (Flash `shotgun`). */
export const SHOTGUN_SPREAD_DEG = [-10, -5, 0, 5, 10] as const;

/** ShotgunRockets aim offsets in degrees (Flash `shotgunRocket`). */
export const SHOTGUN_ROCKET_SPREAD_DEG = [-10, 0, 10] as const;

/** Akimbo Mac-10 aim jitter half-width (Flash `rot-8+random(16)`). */
export const AKIMBO_SPREAD_HALF_DEG = 8;

/** FlameThrower aim jitter half-width (Flash `rot-10+random(20)`). */
export const FLAME_SPREAD_HALF_DEG = SPECIAL_PROJECTILE.flameSpreadHalfDeg;

/** Arsenal indices with distinct ballistic patterns (#15 deliverable). */
export const BALLISTIC_WEAPON_INDICES = [1, 2, 3, 4, 5, 6] as const;

/** Arsenal indices with special behaviors (#16 deliverable). */
export { SPECIAL_WEAPON_INDICES } from './specialProjectile';

/** Arsenal indices with heavy / signature behaviors (#17 deliverable). */
export { HEAVY_WEAPON_INDICES } from './specialProjectile';

/**
 * Build the projectile list for one successful fire of arsenal `weaponIndex`.
 * Does not mutate ammo/reload — caller already committed the shot via
 * {@link stepWeaponFire}.
 *
 * MachineGun (0) stays a single exact-aim shot (#11). Flash's ±2° MG jitter
 * is deferred; Akimbo carries the twin-stream + wider jitter feel.
 */
export function planWeaponFire(
  weaponIndex: number,
  x: number,
  y: number,
  rotationDeg: number,
  def: WeaponDef = getWeaponDef(weaponIndex),
  randomInt: RandomInt = flashRandomInt,
): ProjectileSpawn[] {
  const { speed, damage } = def;
  const behavior = behaviorForWeapon(weaponIndex);
  const smokeTrailInterval = smokeTrailIntervalForWeapon(weaponIndex);

  switch (weaponIndex) {
    case 1:
      return planAkimboFire(
        x,
        y,
        rotationDeg,
        speed,
        damage,
        weaponIndex,
        randomInt,
      );
    case 2:
      return SHOTGUN_SPREAD_DEG.map((offset) => ({
        x,
        y,
        rotationDeg: rotationDeg + offset,
        speed,
        damage,
        behavior: 'ballistic' as const,
        weaponIndex,
      }));
    case 3:
      return SHOTGUN_ROCKET_SPREAD_DEG.map((offset) => ({
        x,
        y,
        rotationDeg: rotationDeg + offset,
        speed,
        damage,
        behavior: 'ballistic' as const,
        smokeTrailInterval,
        weaponIndex,
      }));
    case 8:
      return planFlameFire(
        x,
        y,
        rotationDeg,
        speed,
        damage,
        weaponIndex,
        randomInt,
      );
    case 7:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
      return [
        {
          x,
          y,
          rotationDeg,
          speed,
          damage,
          behavior,
          maxLifetime:
            weaponIndex === 11 || weaponIndex === 13
              ? SPECIAL_PROJECTILE.railLingerFrames
              : undefined,
          smokeTrailInterval,
          weaponIndex,
        },
      ];
    case 0:
    case 4:
    case 5:
    case 6:
    default:
      // Single aimed projectile (MG / grenade / RPG / rocket / later guns).
      return [
        {
          x,
          y,
          rotationDeg,
          speed,
          damage,
          behavior,
          smokeTrailInterval,
          weaponIndex,
        },
      ];
  }
}

/**
 * Flash `flameThrower`: one particle with `rot-10+random(20)` jitter and a
 * short lifetime so hold-to-fire (reload 1) streams continuous DoT.
 */
export function planFlameFire(
  x: number,
  y: number,
  rotationDeg: number,
  speed: number,
  damage: number,
  weaponIndex: number,
  randomInt: RandomInt = flashRandomInt,
): ProjectileSpawn[] {
  const rot =
    rotationDeg - FLAME_SPREAD_HALF_DEG + randomInt(FLAME_SPREAD_HALF_DEG * 2);
  return [
    {
      x,
      y,
      rotationDeg: rot,
      speed,
      damage,
      behavior: 'flame',
      maxLifetime: SPECIAL_PROJECTILE.flameLifetimeFrames,
      weaponIndex,
    },
  ];
}

/**
 * Flash `uzi`: two bullets — one at the muzzle, one offset by one frame of
 * travel along the aim vector (`xs/ys = speed * cos/sin(rot)`). Each gets
 * independent `rot-8+random(16)` jitter.
 */
export function planAkimboFire(
  x: number,
  y: number,
  rotationDeg: number,
  speed: number,
  damage: number,
  weaponIndex: number,
  randomInt: RandomInt = flashRandomInt,
): ProjectileSpawn[] {
  const { vx, vy } = velocityFromRotation(speed, rotationDeg);
  const jitter = (): number =>
    rotationDeg -
    AKIMBO_SPREAD_HALF_DEG +
    randomInt(AKIMBO_SPREAD_HALF_DEG * 2);
  return [
    {
      x,
      y,
      rotationDeg: jitter(),
      speed,
      damage,
      behavior: 'ballistic',
      weaponIndex,
    },
    {
      x: x + vx,
      y: y + vy,
      rotationDeg: jitter(),
      speed,
      damage,
      behavior: 'ballistic',
      weaponIndex,
    },
  ];
}

/** How many projectiles one fire of this weapon attempts to spawn. */
export function projectileCountForWeapon(weaponIndex: number): number {
  switch (weaponIndex) {
    case 1:
      return 2;
    case 2:
      return SHOTGUN_SPREAD_DEG.length;
    case 3:
      return SHOTGUN_ROCKET_SPREAD_DEG.length;
    default:
      return 1;
  }
}
