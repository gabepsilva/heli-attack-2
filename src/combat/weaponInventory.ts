/**
 * Data-driven weapon inventory — Flash `this.guns` + `cgun` switching (#14).
 *
 * Each arsenal index owns its own ammo + reload counter. Switching only
 * changes `activeIndex` (instant — no reload reset). Next/prev skip empty
 * slots and the predator gun (Flash `cgun >= guns.length-1 → 0`).
 */

import {
  PREDATOR_WEAPON_INDEX,
  WEAPON_COUNT,
  WEAPON_PICKUP_AMMO,
  getWeaponDef,
  type WeaponDef,
} from '../config/weapons';
import { canSwitchWeapons } from './powerupEffects';
import { createMachineGunState, hasAmmo, type WeaponState } from './weapon';

/** Player arsenal — Flash `this.guns` + `this.cgun`. */
export type WeaponInventory = {
  /** One slot per arsenal index (length {@link WEAPON_COUNT}). */
  slots: WeaponState[];
  /** Active slot index (Flash `cgun`). */
  activeIndex: number;
};

export type CreateWeaponInventoryOptions = {
  /**
   * When true, grant Flash pickup ammo to weapons 1–12 so switching is
   * playable before the drop system (#21) lands.
   */
  testGrant?: boolean;
};

/** Fresh empty slot for arsenal index `type` (0 bullets, reload ready). */
export function createWeaponSlot(type: number): WeaponState {
  return {
    type,
    reloadTime: Number.POSITIVE_INFINITY,
    bullets: 0,
    shots: 0,
  };
}

/**
 * Flash `heroSetup` gun array:
 * - slot 0 MachineGun: ∞ ammo
 * - slots 1..12: 0 ammo (or test-granted pickup amounts)
 * - slot 13 ShoulderCannon / predator: ∞ ammo, skipped by cycling
 */
export function createWeaponInventory(
  options: CreateWeaponInventoryOptions = {},
): WeaponInventory {
  const slots: WeaponState[] = [];
  slots.push(createMachineGunState());
  for (let i = 1; i < PREDATOR_WEAPON_INDEX; i += 1) {
    const slot = createWeaponSlot(i);
    if (options.testGrant) {
      const ammo = WEAPON_PICKUP_AMMO[i];
      if (ammo !== undefined) {
        slot.bullets = ammo;
      }
    }
    slots.push(slot);
  }
  // Predator / ShoulderCannon — infinite ammo like Flash heroSetup.
  slots.push({
    type: PREDATOR_WEAPON_INDEX,
    reloadTime: Number.POSITIVE_INFINITY,
    bullets: Number.POSITIVE_INFINITY,
    shots: 0,
  });

  return { slots, activeIndex: 0 };
}

/** Active gun slot (Flash `this.guns[this.cgun]`). */
export function getActiveWeapon(inv: Readonly<WeaponInventory>): WeaponState {
  return inv.slots[inv.activeIndex]!;
}

/** Arsenal def for the active gun. */
export function getActiveWeaponDef(inv: Readonly<WeaponInventory>): WeaponDef {
  return getWeaponDef(getActiveWeapon(inv).type);
}

/** True when the slot has ammo (owned / selectable). */
export function isWeaponOwned(
  inv: Readonly<WeaponInventory>,
  index: number,
): boolean {
  const slot = inv.slots[index];
  return slot !== undefined && hasAmmo(slot);
}

/**
 * Instant select by arsenal index. Succeeds only when the slot has ammo.
 * Does not modify any slot's reloadTime / bullets / shots.
 * Blocked during PredatorMode (#22 — Flash `powerupon != 3`).
 */
export function selectWeapon(
  inv: WeaponInventory,
  index: number,
  powerupOn: number = 0,
): boolean {
  if (!canSwitchWeapons(powerupOn)) {
    return false;
  }
  if (index < 0 || index >= WEAPON_COUNT) {
    return false;
  }
  if (index === PREDATOR_WEAPON_INDEX) {
    // Normal play never selects the predator slot via number keys (#14).
    return false;
  }
  if (!isWeaponOwned(inv, index)) {
    return false;
  }
  inv.activeIndex = index;
  return true;
}

/**
 * Map a digit key (0–9) to an arsenal index for number-key switching.
 * `1` → MachineGun (0), `2` → Akimbo (1), … `9` → FireMines (8), `0` → ABomb (9).
 * Weapons 10–12 are reached via next/prev only.
 */
export function weaponIndexFromDigitKey(digit: number): number | null {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    return null;
  }
  if (digit === 0) {
    return 9;
  }
  return digit - 1;
}

/** Select via digit key 0–9. Instant; no-op when unowned / PredatorMode. */
export function selectWeaponByDigitKey(
  inv: WeaponInventory,
  digit: number,
  powerupOn: number = 0,
): boolean {
  const index = weaponIndexFromDigitKey(digit);
  if (index === null) {
    return false;
  }
  return selectWeapon(inv, index, powerupOn);
}

/**
 * Cycle to the next owned weapon (Flash switchKey forward).
 * Visits indices `0 .. PREDATOR_WEAPON_INDEX-1` only; skips empty slots.
 * Instant — preserves each slot's reload counter.
 * Blocked during PredatorMode (#22).
 */
export function nextWeapon(
  inv: WeaponInventory,
  powerupOn: number = 0,
): boolean {
  return cycleWeapon(inv, 1, powerupOn);
}

/** Cycle to the previous owned weapon (reverse of Flash switch). */
export function prevWeapon(
  inv: WeaponInventory,
  powerupOn: number = 0,
): boolean {
  return cycleWeapon(inv, -1, powerupOn);
}

function cycleWeapon(
  inv: WeaponInventory,
  direction: 1 | -1,
  powerupOn: number = 0,
): boolean {
  if (!canSwitchWeapons(powerupOn)) {
    return false;
  }
  // Flash: cgun++ then wrap at guns.length-1 → 0 (predator never selected).
  const selectable = PREDATOR_WEAPON_INDEX;
  const start = ((inv.activeIndex % selectable) + selectable) % selectable;
  let i = start;
  do {
    i = (i + direction + selectable) % selectable;
    if (hasAmmo(inv.slots[i]!)) {
      inv.activeIndex = i;
      return true;
    }
  } while (i !== start);
  return false;
}

/**
 * Add ammo to a slot (Flash pickup `guns[gun].bullets += bullets`).
 * Does not auto-switch to the granted weapon.
 */
export function grantWeaponAmmo(
  inv: WeaponInventory,
  index: number,
  amount: number,
): void {
  const slot = inv.slots[index];
  if (slot === undefined || index === 0 || index === PREDATOR_WEAPON_INDEX) {
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }
  slot.bullets += amount;
}

/**
 * Flash empty-gun fallback: when the active gun hits 0 ammo, reset its
 * reloadTime to ∞ and snap back to MachineGun.
 */
export function fallbackIfActiveEmpty(inv: WeaponInventory): void {
  const active = getActiveWeapon(inv);
  if (active.bullets > 0) {
    return;
  }
  active.reloadTime = Number.POSITIVE_INFINITY;
  inv.activeIndex = 0;
}

/** Sum of per-gun `shots` counters — run total for accuracy (#25). */
export function totalInventoryShots(inv: Readonly<WeaponInventory>): number {
  let total = 0;
  for (const slot of inv.slots) {
    total += slot.shots;
  }
  return total;
}
