/**
 * Reload-counter firing model — plain logic matching HA2 Flash `heroAction`.
 * Phaser only feeds held-fire intent; spawning bullets stays in SimSession.
 *
 * Flash (decompiled):
 *   if (move) guns[cgun].reloadtime++;
 *   if (mouseD && move && bullets > 0
 *       && reloadtime >= guns[type].reloadtime) {
 *     shots++; reloadtime = 0; bullets--;
 *     guns[type].gun(...);  // spawn projectile
 *   }
 *
 * MachineGun starts with reloadtime = +∞ (ready) and bullets = +∞.
 * Reload increments by 1 per discrete sim frame (not scaled by timeStep).
 */

import { MACHINE_GUN, type WeaponDef } from '../config/weapons';

export type { WeaponDef };

/** Per-player gun slot — Flash `this.guns[cgun]`. */
export type WeaponState = {
  /** Index into the arsenal table (`WEAPONS` / Flash `guns`). */
  type: number;
  /**
   * Frames since last shot (Flash `reloadtime`). Starts at +∞ so the first
   * held-fire press is immediate; resets to 0 on each successful shot.
   */
  reloadTime: number;
  /** Remaining ammo; MachineGun uses +∞ (never depletes). */
  bullets: number;
  /** Lifetime shot counter (Flash `shots`). */
  shots: number;
};

export { MACHINE_GUN };

/** Fresh MachineGun slot matching Flash `heroSetup` gun 0. */
export function createMachineGunState(): WeaponState {
  return {
    type: 0,
    reloadTime: Number.POSITIVE_INFINITY,
    bullets: Number.POSITIVE_INFINITY,
    shots: 0,
  };
}

/** True when ammo remains (Infinity counts as available). */
export function hasAmmo(weapon: Readonly<WeaponState>): boolean {
  return weapon.bullets > 0;
}

/** True when the reload counter has reached the gun's reload frames. */
export function isReloadReady(
  weapon: Readonly<WeaponState>,
  def: WeaponDef = MACHINE_GUN,
): boolean {
  return weapon.reloadTime >= def.reload;
}

/**
 * One discrete sim frame of reload charge (Flash `reloadtime++` when `move`).
 * Call once per fixed sim tick before attempting to fire.
 */
export function stepWeaponReload(weapon: WeaponState): void {
  weapon.reloadTime += 1;
}

/**
 * Attempt a shot under held fire. Returns true when a projectile should spawn.
 * On success: increments `shots`, resets `reloadTime` to 0, decrements ammo
 * (Infinity − 1 stays Infinity).
 */
export function tryFireWeapon(
  weapon: WeaponState,
  fireHeld: boolean,
  def: WeaponDef = MACHINE_GUN,
): boolean {
  if (!fireHeld) {
    return false;
  }
  if (!hasAmmo(weapon)) {
    return false;
  }
  if (!isReloadReady(weapon, def)) {
    return false;
  }

  weapon.shots += 1;
  weapon.reloadTime = 0;
  weapon.bullets -= 1;
  return true;
}

/**
 * Advance reload then optionally fire — one Flash `heroAction` move-frame.
 * Returns whether a shot was taken this frame.
 */
export function stepWeaponFire(
  weapon: WeaponState,
  fireHeld: boolean,
  def: WeaponDef = MACHINE_GUN,
): boolean {
  stepWeaponReload(weapon);
  return tryFireWeapon(weapon, fireHeld, def);
}
