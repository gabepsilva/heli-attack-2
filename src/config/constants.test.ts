import { describe, expect, it } from 'vitest';
import {
  BULLET_TIME,
  GUN,
  HEALTH_PICKUP,
  HELI,
  PLAYER,
  POWERUP,
  POWERUP_FRAMES,
  SIM_DT,
  SIM_DT_MS,
  SIM_HZ,
  WORLD,
} from './constants';

describe('config/constants (spec seed)', () => {
  it('locks the sim to the original ~30 fps frame rate', () => {
    expect(SIM_HZ).toBe(30);
    expect(SIM_DT).toBeCloseTo(1 / 30);
    expect(SIM_DT_MS).toBeCloseTo(1000 / 30);
  });

  it('seeds WORLD with exact spec values including default timeStep', () => {
    expect(WORLD).toEqual({
      tile: 50,
      gravity: 1,
      terminal: 50,
      timeStep: 1,
    });
  });

  it('seeds PLAYER physics from the spec', () => {
    expect(PLAYER.health).toBe(100);
    expect(PLAYER.walkAccel).toBe(1);
    expect(PLAYER.walkCap).toBe(5);
    expect(PLAYER.hardCap).toBe(6);
    expect(PLAYER.friction).toBe(1);
    expect(PLAYER.jumpVel).toBe(-8);
    expect(PLAYER.jumpHoldFrames).toBe(6);
    expect(PLAYER.doubleJump).toBe(true);
    expect(PLAYER.boostVel).toBe(-32);
    expect(PLAYER.boostChargeFrames).toBe(150);
    expect(PLAYER.boxW).toBe(10);
    expect(PLAYER.boxH).toBe(42);
    expect(PLAYER.spriteW).toBe(48);
    expect(PLAYER.spriteH).toBe(48);
    expect(PLAYER.duckScale).toBeCloseTo(0.6667, 4);
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
});
