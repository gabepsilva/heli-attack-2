/**
 * Full arsenal table — unit tests for issue #14 acceptance / exact spec values.
 */

import { describe, expect, it } from 'vitest';
import {
  MACHINE_GUN,
  PREDATOR_WEAPON_INDEX,
  WEAPONS,
  WEAPON_COUNT,
  WEAPON_PICKUP_AMMO,
  getWeaponDef,
  type WeaponDef,
} from './weapons';

/** Exact portable-config rows from HELIATTACK2-SPEC.md. */
const SPEC_WEAPONS = [
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
] as const;

describe('config/weapons (issue #14 arsenal table)', () => {
  it('exports exactly 14 weapons matching the spec table row-for-row', () => {
    expect(WEAPON_COUNT).toBe(14);
    expect(WEAPONS).toHaveLength(14);
    expect(PREDATOR_WEAPON_INDEX).toBe(13);

    for (let i = 0; i < SPEC_WEAPONS.length; i += 1) {
      const expected = SPEC_WEAPONS[i]!;
      const actual: WeaponDef = WEAPONS[i]!;
      expect(actual.name).toBe(expected.name);
      expect(actual.reload).toBe(expected.reload);
      expect(actual.speed).toBe(expected.speed);
      expect(actual.damage).toBe(expected.damage);
      if ('hold' in expected) {
        expect(actual.hold).toBe(true);
      } else {
        expect(actual.hold).toBeUndefined();
      }
    }
  });

  it('locks MachineGun as index 0 with reload 5 / speed 8 / damage 10', () => {
    expect(MACHINE_GUN).toBe(WEAPONS[0]);
    expect(MACHINE_GUN).toEqual({
      name: 'MachineGun',
      reload: 5,
      speed: 8,
      damage: 10,
    });
  });

  it('marks only FlameThrower as hold-to-fire', () => {
    const holdWeapons = WEAPONS.filter(
      (w): w is (typeof WEAPONS)[number] & { hold: true } =>
        (w as WeaponDef).hold === true,
    );
    expect(holdWeapons).toHaveLength(1);
    expect(holdWeapons[0]!.name).toBe('FlameThrower');
    expect((WEAPONS[8] as WeaponDef).hold).toBe(true);
  });

  it('seeds Flash pickup ammo for weapons 1–12 (not MG or predator)', () => {
    expect(WEAPON_PICKUP_AMMO).toEqual({
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
    });
    expect(WEAPON_PICKUP_AMMO[0]).toBeUndefined();
    expect(WEAPON_PICKUP_AMMO[13]).toBeUndefined();
  });

  it('getWeaponDef returns the arsenal entry and rejects out-of-range', () => {
    expect(getWeaponDef(5).name).toBe('RPG');
    expect(getWeaponDef(5).speed).toBe(4);
    expect(() => getWeaponDef(-1)).toThrow(/out of range/);
    expect(() => getWeaponDef(14)).toThrow(/out of range/);
  });
});
