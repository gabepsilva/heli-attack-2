/**
 * MachineGun reload-counter firing — unit tests for issue #11 acceptance criteria.
 *
 * AC: Measured fire rate matches spec at 30fps sim
 * AC: Holding fire streams bullets at the reload rate
 * Spec: MachineGun reload 5 / speed 8 / damage 10 / infinite ammo
 */

import { describe, expect, it } from 'vitest';
import { SIM_HZ, WEAPONS } from '../config/constants';
import {
  MACHINE_GUN,
  createMachineGunState,
  hasAmmo,
  isReloadReady,
  stepWeaponFire,
  stepWeaponReload,
  tryFireWeapon,
} from './weapon';

describe('MachineGun fire & reload (issue #11)', () => {
  it('locks MachineGun stats to exact spec values (reload 5, speed 8, damage 10)', () => {
    expect(WEAPONS[0]).toEqual({
      name: 'MachineGun',
      reload: 5,
      speed: 8,
      damage: 10,
    });
    expect(MACHINE_GUN).toBe(WEAPONS[0]);
    expect(MACHINE_GUN.reload).toBe(5);
    expect(MACHINE_GUN.speed).toBe(8);
    expect(MACHINE_GUN.damage).toBe(10);
  });

  it('starts ready with infinite ammo (Flash heroSetup gun 0)', () => {
    const gun = createMachineGunState();
    expect(gun.type).toBe(0);
    expect(gun.reloadTime).toBe(Number.POSITIVE_INFINITY);
    expect(gun.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(gun.shots).toBe(0);
    expect(hasAmmo(gun)).toBe(true);
    expect(isReloadReady(gun)).toBe(true);
  });

  it('fires immediately on first held frame, then resets reloadTime to 0', () => {
    const gun = createMachineGunState();
    expect(stepWeaponFire(gun, true)).toBe(true);
    expect(gun.shots).toBe(1);
    expect(gun.reloadTime).toBe(0);
    expect(gun.bullets).toBe(Number.POSITIVE_INFINITY);
  });

  it('does not fire while reloadTime is below gun.reload (5)', () => {
    const gun = createMachineGunState();
    expect(stepWeaponFire(gun, true)).toBe(true); // shot 1, reloadTime → 0

    // Frames while charging: reloadTime becomes 1,2,3,4 — not ready.
    for (let i = 0; i < 4; i += 1) {
      expect(stepWeaponFire(gun, true)).toBe(false);
      expect(gun.reloadTime).toBe(i + 1);
      expect(gun.shots).toBe(1);
    }

    // Fifth charge frame: reloadTime becomes 5 ≥ 5 → fire.
    expect(stepWeaponFire(gun, true)).toBe(true);
    expect(gun.shots).toBe(2);
    expect(gun.reloadTime).toBe(0);
  });

  it('holding fire streams at exact reload cadence (one shot every 5 frames)', () => {
    const gun = createMachineGunState();
    const fireFrames: number[] = [];

    // 30 sim frames @ 30 Hz = 1 second of held fire.
    for (let frame = 0; frame < SIM_HZ; frame += 1) {
      if (stepWeaponFire(gun, true)) {
        fireFrames.push(frame);
      }
    }

    // First shot on frame 0 (ready); then every 5 frames: 0,5,10,15,20,25.
    expect(fireFrames).toEqual([0, 5, 10, 15, 20, 25]);
    expect(gun.shots).toBe(6);
    // 6 shots / 1s @ 30 Hz with reload 5 → 30/5 = 6 shots/sec.
    expect(gun.shots).toBe(SIM_HZ / MACHINE_GUN.reload);
  });

  it('measured fire rate over 5 seconds matches 6 shots/sec at 30fps', () => {
    const gun = createMachineGunState();
    const seconds = 5;
    const frames = SIM_HZ * seconds;

    for (let i = 0; i < frames; i += 1) {
      stepWeaponFire(gun, true);
    }

    // Exact: floor(frames / reload) when starting ready = frames/reload.
    expect(gun.shots).toBe(frames / MACHINE_GUN.reload);
    expect(gun.shots).toBe(30); // 5s × 6 shots/s
    const shotsPerSecond = gun.shots / seconds;
    expect(shotsPerSecond).toBe(SIM_HZ / MACHINE_GUN.reload);
    expect(shotsPerSecond).toBe(6);
  });

  it('does not fire when the trigger is released (even if reload-ready)', () => {
    const gun = createMachineGunState();
    expect(isReloadReady(gun)).toBe(true);
    expect(stepWeaponFire(gun, false)).toBe(false);
    expect(gun.shots).toBe(0);
    // Reload still advances while not firing (Flash increments every move frame).
    expect(gun.reloadTime).toBe(Number.POSITIVE_INFINITY);
  });

  it('never depletes MachineGun ammo (Infinity − 1 stays Infinity)', () => {
    const gun = createMachineGunState();
    for (let i = 0; i < 100; i += 1) {
      stepWeaponFire(gun, true);
    }
    expect(gun.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(hasAmmo(gun)).toBe(true);
  });

  it('refuses to fire when ammo is empty (finite guns)', () => {
    const gun = createMachineGunState();
    gun.bullets = 0;
    expect(hasAmmo(gun)).toBe(false);
    expect(stepWeaponFire(gun, true)).toBe(false);
    expect(gun.shots).toBe(0);
  });

  it('tryFireWeapon alone does not advance reload (caller must step first)', () => {
    const gun = createMachineGunState();
    gun.reloadTime = 4;
    expect(tryFireWeapon(gun, true)).toBe(false);
    stepWeaponReload(gun);
    expect(gun.reloadTime).toBe(5);
    expect(tryFireWeapon(gun, true)).toBe(true);
    expect(gun.reloadTime).toBe(0);
  });
});
