/**
 * The gun in the player's hands, per arsenal slot.
 *
 * Two facts vary per weapon and neither can be read off the bitmap:
 *
 *   grip    where the gun turns as the player aims. It lives on the sprite as
 *           its catalog `pivot`, because that is exactly what a pivot is.
 *   muzzle  where bullets leave the barrel, in gun-local pixels measured from
 *           the grip. A 21px mine and a 57px railgun do not fire from the same
 *           place, so a single shared offset puts rounds inside the model.
 *
 * Both are derived from the original art rather than eyeballed — regenerate
 * with `python3 scripts/art/extract-swf-guns.py`.
 *
 * ShoulderCannon (slot 13) has `frame: null`: predator mode is cloaked, so the
 * player holds nothing. It still has a muzzle — an invisible gun still fires.
 */

import type { SpriteId } from '../art/catalog';
import { WEAPON_COUNT } from '../config/weapons';

/** A point in gun-local space, relative to the grip, with +X along the barrel. */
export type GunLocalPoint = Readonly<{ x: number; y: number }>;

export type HeldGun = Readonly<{
  /** Atlas frame, or `null` when the weapon is carried invisibly. */
  frame: SpriteId | null;
  /** Barrel tip, relative to the grip, before rotation. */
  muzzle: GunLocalPoint;
}>;

/**
 * Index-aligned with {@link WEAPONS}. Muzzle Y is negative because the barrel
 * sits above the hand.
 */
export const HELD_GUNS = [
  { frame: 'weapon_machinegun', muzzle: { x: 22.7, y: -7.4 } },
  { frame: 'weapon_mac10', muzzle: { x: 27.8, y: -8.4 } },
  { frame: 'weapon_shotgun', muzzle: { x: 29.3, y: -7.1 } },
  { frame: 'weapon_shotgunrockets', muzzle: { x: 33.5, y: -8.8 } },
  { frame: 'weapon_grenadelauncher', muzzle: { x: 28.9, y: -7.3 } },
  { frame: 'weapon_rpg', muzzle: { x: 31.9, y: -7.3 } },
  { frame: 'weapon_rocketlauncher', muzzle: { x: 24.0, y: -9.7 } },
  { frame: 'weapon_seekerlauncher', muzzle: { x: 24.2, y: -9.7 } },
  { frame: 'weapon_flamethrower', muzzle: { x: 28.9, y: -7.3 } },
  { frame: 'weapon_firemines', muzzle: { x: 19.5, y: -5.5 } },
  { frame: 'weapon_abomb', muzzle: { x: 36.5, y: -12.7 } },
  { frame: 'weapon_rail', muzzle: { x: 32.0, y: -7.9 } },
  { frame: 'weapon_grapplecannon', muzzle: { x: 33.0, y: -10.9 } },
  { frame: null, muzzle: { x: 16.0, y: 0 } }, // ShoulderCannon — predator cloak
] as const satisfies readonly HeldGun[];

/** One gun per arsenal slot — a mismatch is a compile error, not a surprise. */
export type HeldGunTable = typeof HELD_GUNS & {
  length: typeof WEAPON_COUNT;
};
const _COVERS_ARSENAL: HeldGunTable = HELD_GUNS;
void _COVERS_ARSENAL;

/** The gun for an arsenal slot; out-of-range falls back to the starting gun. */
export function heldGunFor(weaponIndex: number): HeldGun {
  return HELD_GUNS[weaponIndex] ?? HELD_GUNS[0];
}

/** The starting MachineGun — the pose used before a weapon is chosen. */
export const DEFAULT_HELD_GUN: HeldGun = HELD_GUNS[0];
