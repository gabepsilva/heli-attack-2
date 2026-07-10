/**
 * Weapon inventory switching — unit tests for issue #14 / #92 acceptance criteria.
 *
 * AC (#14): Cycling changes the active weapon
 * AC (#14): Each tracks its own ammo/reload; switching is instant
 * AC (#92): Fresh runs begin with MachineGun only; no pre-granted ammo
 * AC (#92): Other weapons appear only after a pickup grants ammo
 * AC (#92): Switch / cycle skips empty slots
 * AC (#92): testGrant stays out of normal play
 */

import { describe, expect, it } from 'vitest';
import {
  PREDATOR_WEAPON_INDEX,
  WEAPONS,
  WEAPON_COUNT,
  WEAPON_PICKUP_AMMO,
} from '../config/weapons';
import { stepWeaponFire } from './weapon';
import {
  createWeaponInventory,
  fallbackIfActiveEmpty,
  getActiveWeapon,
  getActiveWeaponDef,
  grantWeaponAmmo,
  isWeaponOwned,
  nextWeapon,
  prevWeapon,
  selectWeapon,
  selectWeaponByDigitKey,
  totalInventoryShots,
  weaponIndexFromDigitKey,
} from './weaponInventory';

describe('weapon inventory switching (issue #14)', () => {
  it('creates 14 slots: MG ∞, 1–12 empty, predator ∞ at index 13', () => {
    const inv = createWeaponInventory();
    expect(inv.slots).toHaveLength(WEAPON_COUNT);
    expect(inv.activeIndex).toBe(0);
    expect(inv.slots[0]!.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(inv.slots[0]!.type).toBe(0);
    for (let i = 1; i < PREDATOR_WEAPON_INDEX; i += 1) {
      expect(inv.slots[i]!.type).toBe(i);
      expect(inv.slots[i]!.bullets).toBe(0);
      expect(inv.slots[i]!.reloadTime).toBe(Number.POSITIVE_INFINITY);
      expect(isWeaponOwned(inv, i)).toBe(false);
    }
    expect(inv.slots[PREDATOR_WEAPON_INDEX]!.bullets).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(getActiveWeaponDef(inv)).toBe(WEAPONS[0]);
  });

  it('test-grants Flash pickup ammo on weapons 1–12 (dev helper only)', () => {
    const inv = createWeaponInventory({ testGrant: true });
    for (const [index, ammo] of Object.entries(WEAPON_PICKUP_AMMO)) {
      const i = Number(index);
      expect(inv.slots[i]!.bullets).toBe(ammo);
      expect(isWeaponOwned(inv, i)).toBe(true);
    }
  });

  it('next/prev cycling changes the active weapon among owned slots', () => {
    const inv = createWeaponInventory({ testGrant: true });
    expect(inv.activeIndex).toBe(0);

    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(1);
    expect(getActiveWeaponDef(inv).name).toBe('AkimboMac10');

    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(2);
    expect(getActiveWeaponDef(inv).name).toBe('Shotgun');

    expect(prevWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(1);

    expect(prevWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(0);
    expect(getActiveWeaponDef(inv).name).toBe('MachineGun');
  });

  it('cycling skips empty slots and never selects the predator gun', () => {
    const inv = createWeaponInventory();
    grantWeaponAmmo(inv, 5, WEAPON_PICKUP_AMMO[5]!); // RPG only

    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(5);
    expect(getActiveWeaponDef(inv).name).toBe('RPG');

    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(0); // wraps past empty 6..12, skips 13

    // Walk forward through all owned — never lands on 13.
    inv.activeIndex = 0;
    for (let n = 0; n < 20; n += 1) {
      nextWeapon(inv);
      expect(inv.activeIndex).not.toBe(PREDATOR_WEAPON_INDEX);
      expect(inv.activeIndex).toBeLessThan(PREDATOR_WEAPON_INDEX);
    }
  });

  it('each weapon tracks its own ammo and reload; switching is instant', () => {
    const inv = createWeaponInventory({ testGrant: true });
    const mg = inv.slots[0]!;
    const akimbo = inv.slots[1]!;
    const akimboDef = WEAPONS[1];

    // Fire MachineGun once → reloadTime resets to 0, charge a few frames.
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(true);
    expect(mg.reloadTime).toBe(0);
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(false);
    expect(mg.reloadTime).toBe(1);
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(false);
    expect(mg.reloadTime).toBe(2);
    const mgReloadBeforeSwitch = mg.reloadTime;
    const mgShots = mg.shots;

    // Instant switch to Akimbo — MG reload counter must be untouched.
    expect(selectWeapon(inv, 1)).toBe(true);
    expect(inv.activeIndex).toBe(1);
    expect(mg.reloadTime).toBe(mgReloadBeforeSwitch);
    expect(mg.shots).toBe(mgShots);
    expect(akimbo.reloadTime).toBe(Number.POSITIVE_INFINITY);
    expect(akimbo.bullets).toBe(50);

    // Fire Akimbo (reload 4) a few times; deplete one bullet.
    expect(stepWeaponFire(akimbo, true, akimboDef)).toBe(true);
    expect(akimbo.shots).toBe(1);
    expect(akimbo.reloadTime).toBe(0);
    expect(akimbo.bullets).toBe(49);
    for (let i = 0; i < 3; i += 1) {
      expect(stepWeaponFire(akimbo, true, akimboDef)).toBe(false);
    }
    expect(akimbo.reloadTime).toBe(3);
    const akimboReload = akimbo.reloadTime;

    // Switch back to MG instantly — both counters preserved independently.
    expect(selectWeapon(inv, 0)).toBe(true);
    expect(inv.activeIndex).toBe(0);
    expect(mg.reloadTime).toBe(mgReloadBeforeSwitch);
    expect(akimbo.reloadTime).toBe(akimboReload);
    expect(akimbo.bullets).toBe(49);

    // Resume MG charge from where it left off (2 → 3 → 4 → 5 fire).
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(false);
    expect(mg.reloadTime).toBe(3);
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(false);
    expect(mg.reloadTime).toBe(4);
    expect(stepWeaponFire(mg, true, WEAPONS[0])).toBe(true);
    expect(mg.shots).toBe(2);
    expect(mg.reloadTime).toBe(0);
  });

  it('number keys select owned weapons by digit mapping (1→0 … 0→9)', () => {
    expect(weaponIndexFromDigitKey(1)).toBe(0);
    expect(weaponIndexFromDigitKey(2)).toBe(1);
    expect(weaponIndexFromDigitKey(9)).toBe(8);
    expect(weaponIndexFromDigitKey(0)).toBe(9);

    const inv = createWeaponInventory({ testGrant: true });
    expect(selectWeaponByDigitKey(inv, 3)).toBe(true);
    expect(inv.activeIndex).toBe(2);
    expect(getActiveWeaponDef(inv).name).toBe('Shotgun');

    expect(selectWeaponByDigitKey(inv, 0)).toBe(true);
    expect(inv.activeIndex).toBe(9);
    expect(getActiveWeaponDef(inv).name).toBe('FireMines');

    // Unowned / empty refuses without changing active.
    const empty = createWeaponInventory();
    empty.activeIndex = 0;
    expect(selectWeaponByDigitKey(empty, 3)).toBe(false);
    expect(empty.activeIndex).toBe(0);

    // Predator never selectable via number keys.
    expect(selectWeapon(inv, PREDATOR_WEAPON_INDEX)).toBe(false);
  });

  it('falls back to MachineGun when the active gun runs dry', () => {
    const inv = createWeaponInventory();
    grantWeaponAmmo(inv, 2, 1);
    expect(selectWeapon(inv, 2)).toBe(true);

    const shotgun = getActiveWeapon(inv);
    expect(stepWeaponFire(shotgun, true, WEAPONS[2])).toBe(true);
    expect(shotgun.bullets).toBe(0);

    fallbackIfActiveEmpty(inv);
    expect(inv.activeIndex).toBe(0);
    expect(shotgun.reloadTime).toBe(Number.POSITIVE_INFINITY);
    expect(getActiveWeaponDef(inv).name).toBe('MachineGun');
  });

  it('sums per-gun shots for run accuracy (#25)', () => {
    const inv = createWeaponInventory({ testGrant: true });
    expect(totalInventoryShots(inv)).toBe(0);
    expect(stepWeaponFire(getActiveWeapon(inv), true, WEAPONS[0])).toBe(true);
    expect(selectWeapon(inv, 1)).toBe(true);
    expect(stepWeaponFire(getActiveWeapon(inv), true, WEAPONS[1])).toBe(true);
    expect(totalInventoryShots(inv)).toBe(2);
  });
});

describe('start run with only MachineGun (issue #92)', () => {
  it('default inventory: only MachineGun is owned/selectable; slots 1–12 have 0 ammo', () => {
    const inv = createWeaponInventory();
    expect(inv.activeIndex).toBe(0);
    expect(getActiveWeaponDef(inv).name).toBe('MachineGun');
    expect(inv.slots[0]!.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(isWeaponOwned(inv, 0)).toBe(true);

    for (let i = 1; i < PREDATOR_WEAPON_INDEX; i += 1) {
      expect(inv.slots[i]!.bullets).toBe(0);
      expect(isWeaponOwned(inv, i)).toBe(false);
      expect(selectWeapon(inv, i)).toBe(false);
      expect(selectWeaponByDigitKey(inv, i === 9 ? 0 : i + 1)).toBe(false);
    }
    expect(inv.activeIndex).toBe(0);
  });

  it('pickup grant unlocks a slot with exact Flash ammo; cycle then visits it', () => {
    const inv = createWeaponInventory();
    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(0); // only MG — cycle stays put

    grantWeaponAmmo(inv, 2, WEAPON_PICKUP_AMMO[2]!);
    expect(inv.slots[2]!.bullets).toBe(14);
    expect(isWeaponOwned(inv, 2)).toBe(true);
    expect(selectWeapon(inv, 2)).toBe(true);
    expect(getActiveWeaponDef(inv).name).toBe('Shotgun');

    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(0);
    expect(nextWeapon(inv)).toBe(true);
    expect(inv.activeIndex).toBe(2);
  });

  it('testGrant is opt-in and differs from the default fresh-run inventory', () => {
    const normal = createWeaponInventory();
    const granted = createWeaponInventory({ testGrant: true });
    expect(normal.slots[1]!.bullets).toBe(0);
    expect(granted.slots[1]!.bullets).toBe(WEAPON_PICKUP_AMMO[1]);
    expect(granted.slots[1]!.bullets).toBe(50);
    expect(isWeaponOwned(normal, 1)).toBe(false);
    expect(isWeaponOwned(granted, 1)).toBe(true);
  });
});
