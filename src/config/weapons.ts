/**
 * Full HA2 arsenal table (14 weapons) — issue #14.
 *
 * Values match `reference/spec/HELIATTACK2-SPEC.md` portable config and the
 * decompiled Flash `guns[]` array. Speeds / reloads are per sim frame @ 30 Hz.
 *
 * Pickup ammo amounts come from Flash powerup collection (`bullets = N`).
 * Slot 13 (ShoulderCannon) is the predator-mode gun in Flash — infinite ammo
 * at setup, skipped by normal weapon cycling.
 */

/** One arsenal entry — Flash `guns[i]`. */
export type WeaponDef = Readonly<{
  name: string;
  /** Frames between shots (lower = faster). Flash `reloadtime`. */
  reload: number;
  /** Projectile speed in px/sim-frame. */
  speed: number;
  /** Damage per hit. */
  damage: number;
  /** Hold-to-fire continuous weapon (FlameThrower). */
  hold?: boolean;
}>;

/**
 * Full 14-weapon table, index-aligned with Flash `guns[0..13]`.
 */
export const WEAPONS = [
  { name: 'MachineGun', reload: 5, speed: 8, damage: 10 },
  { name: 'AkimboMac10', reload: 4, speed: 8, damage: 9 },
  { name: 'Shotgun', reload: 25, speed: 8, damage: 15 },
  { name: 'ShotgunRockets', reload: 40, speed: 7, damage: 40 },
  { name: 'GrenadeLauncher', reload: 30, speed: 15, damage: 75 },
  { name: 'RPG', reload: 40, speed: 4, damage: 75 },
  { name: 'RocketLauncher', reload: 50, speed: 7, damage: 100 },
  { name: 'SeekerLauncher', reload: 55, speed: 7, damage: 100 },
  { name: 'FlameThrower', reload: 1, speed: 8, damage: 2, hold: true },
  { name: 'FireMines', reload: 100, speed: 3, damage: 5 },
  { name: 'ABombLauncher', reload: 150, speed: 3, damage: 300 },
  { name: 'RailGun', reload: 75, speed: 20, damage: 150 },
  { name: 'GrappleCannon', reload: 250, speed: 20, damage: 300 },
  { name: 'ShoulderCannon', reload: 100, speed: 20, damage: 300 },
] as const satisfies readonly WeaponDef[];

/** Arsenal length — always 14. */
export const WEAPON_COUNT = WEAPONS.length;

/**
 * Predator / ShoulderCannon slot index. Flash `guns.length - 1`: forced during
 * PredatorMode, skipped by normal next/prev cycling.
 */
export const PREDATOR_WEAPON_INDEX = WEAPON_COUNT - 1;

/**
 * Ammo granted when collecting a weapon powerup (Flash pickup amounts).
 * Index 0 (MachineGun) is infinite and never picked up; index 13 is a
 * powerup-state roll, not ammo.
 */
export const WEAPON_PICKUP_AMMO: Readonly<Record<number, number>> = {
  1: 50,
  2: 14,
  3: 8,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 150,
  9: 3,
  10: 2,
  11: 3,
  12: 2,
};

/** Spec entry for the starting MachineGun (arsenal index 0). */
export const MACHINE_GUN: WeaponDef = WEAPONS[0];

/** Look up an arsenal entry by index; throws on out-of-range. */
export function getWeaponDef(index: number): WeaponDef {
  if (index < 0 || index >= WEAPON_COUNT) {
    throw new Error(
      `Weapon index ${index} out of range (0..${WEAPON_COUNT - 1})`,
    );
  }
  return WEAPONS[index] as WeaponDef;
}
