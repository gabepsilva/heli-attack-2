/**
 * Per-weapon projectile spawn patterns — Flash `guns[i].gun(...)` (#15).
 *
 * Ballistic set (indices 1–6) plus MachineGun (0):
 * - AkimboMac10: twin-stream (muzzle + one-frame lead offset), ±8° jitter
 * - Shotgun: five pellets at −10/−5/0/+5/+10°
 * - ShotgunRockets: three rockets at −10/0/+10°
 * - GrenadeLauncher / RPG / RocketLauncher: single projectile at aim
 *
 * Special / heavy guns (#16/#17) fall through to a single aimed shot until
 * their dedicated behaviors land.
 */

import { getWeaponDef, type WeaponDef } from '../config/weapons';
import { velocityFromRotation } from './bullet';

/** One projectile to acquire from the pool. */
export type ProjectileSpawn = Readonly<{
  x: number;
  y: number;
  rotationDeg: number;
  speed: number;
  damage: number;
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

/** Arsenal indices with distinct ballistic patterns (#15 deliverable). */
export const BALLISTIC_WEAPON_INDICES = [1, 2, 3, 4, 5, 6] as const;

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

  switch (weaponIndex) {
    case 1:
      return planAkimboFire(x, y, rotationDeg, speed, damage, randomInt);
    case 2:
      return SHOTGUN_SPREAD_DEG.map((offset) => ({
        x,
        y,
        rotationDeg: rotationDeg + offset,
        speed,
        damage,
      }));
    case 3:
      return SHOTGUN_ROCKET_SPREAD_DEG.map((offset) => ({
        x,
        y,
        rotationDeg: rotationDeg + offset,
        speed,
        damage,
      }));
    case 0:
    case 4:
    case 5:
    case 6:
    default:
      // Single aimed projectile (MG / grenade / RPG / rocket / later guns).
      return [{ x, y, rotationDeg, speed, damage }];
  }
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
  randomInt: RandomInt = flashRandomInt,
): ProjectileSpawn[] {
  const { vx, vy } = velocityFromRotation(speed, rotationDeg);
  const jitter = (): number =>
    rotationDeg -
    AKIMBO_SPREAD_HALF_DEG +
    randomInt(AKIMBO_SPREAD_HALF_DEG * 2);
  return [
    { x, y, rotationDeg: jitter(), speed, damage },
    { x: x + vx, y: y + vy, rotationDeg: jitter(), speed, damage },
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
