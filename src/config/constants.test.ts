import { afterEach, describe, expect, it } from 'vitest';
import {
  BULLET,
  BULLET_TIME,
  GUN,
  HEALTH_PICKUP,
  HELI,
  PLAYER,
  PLAYER_DEFAULTS,
  POWERUP,
  POWERUP_FRAMES,
  SIM_DT,
  SIM_DT_MS,
  SIM_HZ,
  WEAPONS,
  WORLD,
  WORLD_DEFAULTS,
  resetPhysicsConstants,
} from './constants';

describe('config/constants (spec seed)', () => {
  afterEach(() => {
    resetPhysicsConstants();
  });

  it('locks the sim to the original ~30 fps frame rate', () => {
    expect(SIM_HZ).toBe(30);
    expect(SIM_DT).toBeCloseTo(1 / 30);
    expect(SIM_DT_MS).toBeCloseTo(1000 / 30);
  });

  it('seeds WORLD with exact spec values including default timeStep', () => {
    expect(WORLD_DEFAULTS).toEqual({
      tile: 50,
      gravity: 1,
      terminal: 50,
      timeStep: 1,
    });
    expect(WORLD).toEqual({ ...WORLD_DEFAULTS });
  });

  it('seeds PLAYER physics from the spec', () => {
    expect(PLAYER_DEFAULTS.health).toBe(100);
    expect(PLAYER_DEFAULTS.walkAccel).toBe(1);
    expect(PLAYER_DEFAULTS.walkCap).toBe(5);
    expect(PLAYER_DEFAULTS.hardCap).toBe(6);
    expect(PLAYER_DEFAULTS.friction).toBe(1);
    expect(PLAYER_DEFAULTS.jumpVel).toBe(-8);
    expect(PLAYER_DEFAULTS.jumpHoldFrames).toBe(6);
    expect(PLAYER_DEFAULTS.doubleJump).toBe(true);
    expect(PLAYER_DEFAULTS.boostVel).toBe(-32);
    expect(PLAYER_DEFAULTS.boostChargeFrames).toBe(150);
    expect(PLAYER_DEFAULTS.boxW).toBe(10);
    expect(PLAYER_DEFAULTS.boxH).toBe(42);
    expect(PLAYER_DEFAULTS.spriteW).toBe(48);
    expect(PLAYER_DEFAULTS.spriteH).toBe(48);
    expect(PLAYER_DEFAULTS.duckScale).toBeCloseTo(0.6667, 4);
    expect(PLAYER).toEqual({ ...PLAYER_DEFAULTS });
  });

  it('resetPhysicsConstants restores live WORLD/PLAYER after mutation', () => {
    WORLD.gravity = 99;
    PLAYER.jumpVel = -1;
    resetPhysicsConstants();
    expect(WORLD.gravity).toBe(WORLD_DEFAULTS.gravity);
    expect(PLAYER.jumpVel).toBe(PLAYER_DEFAULTS.jumpVel);
  });

  it('seeds HELI, powerups, health pickup, and bullet-time from the spec', () => {
    expect(HELI).toEqual({ hp: 300, bulletSpeed: 7, aimSpreadDeg: 10 });
    expect(POWERUP_FRAMES).toBe(500);
    expect(POWERUP).toEqual({
      TriDamage: 1,
      Invulnerability: 2,
      PredatorMode: 3,
      TimeRift: 4,
      Jetpack: 5,
    });
    expect(HEALTH_PICKUP).toEqual({ amount: 20, cap: 100, firstThreshold: 15 });
    expect(BULLET_TIME.maxFrames).toBe(250);
    expect(BULLET_TIME.refillPerKill).toBeCloseTo(83.333, 3);
    expect(BULLET_TIME.minScale).toBe(0.2);
    expect(BULLET_TIME.easePerFrame).toBe(0.1);
  });

  it('seeds GUN from Flash machineGun.png size/pivot + aim turn rate', () => {
    expect(GUN).toEqual({
      attachX: 5,
      attachY: 16,
      spriteW: 29,
      spriteH: 16,
      pivotX: 0.2,
      pivotY: 0.5,
      muzzleLocalX: (1 - 0.2) * 29,
      muzzleLocalY: 0,
      turnDivisor: 2,
    });
  });

  it('seeds MachineGun WEAPONS[0] and BULLET pool defaults from the spec', () => {
    expect(WEAPONS[0]).toEqual({
      name: 'MachineGun',
      reload: 5,
      speed: 8,
      damage: 10,
    });
    expect(BULLET.defaultSpeed).toBe(8);
    expect(BULLET.defaultDamage).toBe(10);
    expect(BULLET.cullMargin).toBe(50);
    expect(BULLET.maxLifetimeFrames).toBe(300);
    expect(BULLET.poolCapacity).toBe(64);
    expect(BULLET.radius).toBe(3);
  });
});
