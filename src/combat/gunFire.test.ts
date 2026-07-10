/**
 * Ballistic weapon fire patterns — unit tests for issue #15 acceptance criteria.
 *
 * AC: Each weapon's reload/speed/damage matches the spec table
 * AC: Akimbo out-fires the MachineGun; shotgun fires a spread; RPG is visibly slow
 * Spec: Flash `uzi` / `shotgun` / `shotgunRocket` / single-shot launchers
 */

import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../config/constants';
import { WEAPONS, getWeaponDef } from '../config/weapons';
import {
  createMachineGunState,
  stepWeaponFire,
  type WeaponState,
} from './weapon';
import {
  AKIMBO_SPREAD_HALF_DEG,
  BALLISTIC_WEAPON_INDICES,
  SHOTGUN_ROCKET_SPREAD_DEG,
  SHOTGUN_SPREAD_DEG,
  planAkimboFire,
  planWeaponFire,
  projectileCountForWeapon,
  type RandomInt,
} from './gunFire';

/** Exact ballistic-set rows from HELIATTACK2-SPEC.md (indices 1–6). */
const BALLISTIC_SPEC = [
  { index: 1, name: 'AkimboMac10', reload: 4, speed: 8, damage: 9 },
  { index: 2, name: 'Shotgun', reload: 25, speed: 8, damage: 15 },
  { index: 3, name: 'ShotgunRockets', reload: 40, speed: 7, damage: 40 },
  { index: 4, name: 'GrenadeLauncher', reload: 30, speed: 15, damage: 75 },
  { index: 5, name: 'RPG', reload: 40, speed: 4, damage: 75 },
  { index: 6, name: 'RocketLauncher', reload: 50, speed: 7, damage: 100 },
] as const;

/** Deterministic Flash `random(n)` — always returns mid-range (n/2 floored). */
const midRandom: RandomInt = (n) => Math.floor(n / 2);

/** Sequence RNG for asserting independent akimbo jitters. */
function sequenceRandom(values: number[]): RandomInt {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

function freshGun(type: number, bullets = 100): WeaponState {
  return {
    type,
    reloadTime: Number.POSITIVE_INFINITY,
    bullets,
    shots: 0,
  };
}

describe('projectile weapons / ballistic set (issue #15)', () => {
  it('locks each ballistic weapon to exact spec reload/speed/damage', () => {
    expect(BALLISTIC_WEAPON_INDICES).toEqual([1, 2, 3, 4, 5, 6]);

    for (const row of BALLISTIC_SPEC) {
      const def = getWeaponDef(row.index);
      expect(def.name).toBe(row.name);
      expect(def.reload).toBe(row.reload);
      expect(def.speed).toBe(row.speed);
      expect(def.damage).toBe(row.damage);
      expect(WEAPONS[row.index]).toMatchObject({
        reload: row.reload,
        speed: row.speed,
        damage: row.damage,
      });
    }
  });

  it('Akimbo out-fires MachineGun at held fire (reload 4 vs 5)', () => {
    const mg = createMachineGunState();
    const akimbo = freshGun(1);
    const mgDef = WEAPONS[0];
    const akimboDef = WEAPONS[1];

    expect(akimboDef.reload).toBe(4);
    expect(mgDef.reload).toBe(5);
    expect(akimboDef.reload).toBeLessThan(mgDef.reload);

    for (let frame = 0; frame < SIM_HZ; frame += 1) {
      stepWeaponFire(mg, true, mgDef);
      stepWeaponFire(akimbo, true, akimboDef);
    }

    // 30 frames starting ready: MG → 30/5 = 6; Akimbo → 30/4 = 7.5 → 8 shots
    // (frames 0,4,8,12,16,20,24,28).
    expect(mg.shots).toBe(SIM_HZ / mgDef.reload);
    expect(mg.shots).toBe(6);
    expect(akimbo.shots).toBe(8);
    expect(akimbo.shots).toBeGreaterThan(mg.shots);
  });

  it('Akimbo twin-stream: two bullets, second offset by one frame of travel', () => {
    const def = WEAPONS[1];
    const rot = 0;
    // random(16) → 8 → aim offset 0 (rot-8+8).
    const spawns = planAkimboFire(
      100,
      200,
      rot,
      def.speed,
      def.damage,
      midRandom,
    );

    expect(spawns).toHaveLength(2);
    expect(projectileCountForWeapon(1)).toBe(2);

    expect(spawns[0]).toEqual({
      x: 100,
      y: 200,
      rotationDeg: rot,
      speed: 8,
      damage: 9,
      behavior: 'ballistic',
    });
    // Lead bullet: +speed along aim (cos0=1, sin0=0) → (108, 200).
    expect(spawns[1]).toEqual({
      x: 100 + def.speed,
      y: 200,
      rotationDeg: rot,
      speed: 8,
      damage: 9,
      behavior: 'ballistic',
    });
  });

  it('Akimbo applies independent Flash ±8° jitter per stream', () => {
    // random sequence: 0 → rot-8; 15 → rot+7
    const spawns = planAkimboFire(0, 0, 90, 8, 9, sequenceRandom([0, 15]));
    expect(spawns[0]!.rotationDeg).toBe(90 - AKIMBO_SPREAD_HALF_DEG);
    expect(spawns[1]!.rotationDeg).toBe(90 - AKIMBO_SPREAD_HALF_DEG + 15);
  });

  it('Shotgun fires a five-pellet spread at exact Flash offsets', () => {
    expect(SHOTGUN_SPREAD_DEG).toEqual([-10, -5, 0, 5, 10]);
    expect(projectileCountForWeapon(2)).toBe(5);

    const def = WEAPONS[2];
    const aim = 45;
    const spawns = planWeaponFire(2, 10, 20, aim, def);

    expect(spawns).toHaveLength(5);
    expect(spawns.map((s) => s.rotationDeg)).toEqual([35, 40, 45, 50, 55]);
    for (const s of spawns) {
      expect(s.x).toBe(10);
      expect(s.y).toBe(20);
      expect(s.speed).toBe(8);
      expect(s.damage).toBe(15);
    }
  });

  it('ShotgunRockets fires a three-rocket spread at −10/0/+10°', () => {
    expect(SHOTGUN_ROCKET_SPREAD_DEG).toEqual([-10, 0, 10]);
    expect(projectileCountForWeapon(3)).toBe(3);

    const def = WEAPONS[3];
    const spawns = planWeaponFire(3, 0, 0, 0, def);
    expect(spawns.map((s) => s.rotationDeg)).toEqual([-10, 0, 10]);
    for (const s of spawns) {
      expect(s.speed).toBe(7);
      expect(s.damage).toBe(40);
    }
  });

  it('GrenadeLauncher is fast (speed 15); RPG is visibly slow (speed 4)', () => {
    const grenade = WEAPONS[4];
    const rpg = WEAPONS[5];
    const rocket = WEAPONS[6];

    expect(grenade.speed).toBe(15);
    expect(rpg.speed).toBe(4);
    expect(rocket.speed).toBe(7);
    expect(rpg.speed).toBeLessThan(grenade.speed);
    expect(rpg.speed).toBeLessThan(rocket.speed);
    expect(rpg.speed).toBeLessThan(WEAPONS[0].speed);
    expect(rpg.speed).toBeLessThan(WEAPONS[1].speed);

    const gSpawn = planWeaponFire(4, 0, 0, 0, grenade);
    const rSpawn = planWeaponFire(5, 0, 0, 0, rpg);
    expect(gSpawn).toHaveLength(1);
    expect(rSpawn).toHaveLength(1);
    expect(gSpawn[0]!.speed).toBe(15);
    expect(gSpawn[0]!.damage).toBe(75);
    expect(rSpawn[0]!.speed).toBe(4);
    expect(rSpawn[0]!.damage).toBe(75);
  });

  it('RocketLauncher fires a single high-damage projectile (speed 7 / damage 100)', () => {
    const def = WEAPONS[6];
    const spawns = planWeaponFire(6, 50, 60, 30, def);
    expect(spawns).toEqual([
      {
        x: 50,
        y: 60,
        rotationDeg: 30,
        speed: 7,
        damage: 100,
        behavior: 'ballistic',
        smokeTrailInterval: 2,
      },
    ]);
    expect(projectileCountForWeapon(6)).toBe(1);
  });

  it('planWeaponFire dispatches every ballistic index with matching projectile counts', () => {
    for (const index of BALLISTIC_WEAPON_INDICES) {
      const def = getWeaponDef(index);
      const spawns = planWeaponFire(index, 1, 2, 0, def, midRandom);
      expect(spawns).toHaveLength(projectileCountForWeapon(index));
      for (const s of spawns) {
        expect(s.speed).toBe(def.speed);
        expect(s.damage).toBe(def.damage);
      }
    }
  });
});
