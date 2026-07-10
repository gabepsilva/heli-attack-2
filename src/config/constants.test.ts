import { afterEach, describe, expect, it } from 'vitest';
import {
  BULLET,
  BULLET_TIME,
  ENEMY_BULLET,
  GUN,
  HEALTH_PICKUP,
  HELI,
  HELI_LOOK_TINT,
  HELI_SPAWN,
  HURT_FLASH,
  PLAYER,
  PLAYER_COMBAT,
  PLAYER_DEFAULTS,
  POWERUP,
  POWERUP_DROP,
  POWERUP_EFFECTS,
  POWERUP_FRAMES,
  SCORE,
  HIGH_SCORES,
  SIM_DT,
  SIM_DT_MS,
  SIM_HZ,
  WEAPONS,
  WORLD,
  WORLD_DEFAULTS,
  GAME_FLOW,
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
    // Issue #94 — Flash heroAction walk values (walkCap ±5, not bumped to 6).
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
    expect(HELI).toEqual({
      hp: 300,
      bulletSpeed: 7,
      aimSpreadDeg: 10,
      spriteW: 212,
      spriteH: 106,
      onScreenFramesMin: 150,
      onScreenFramesRand: 100,
      lookCount: 2,
      hoverAccelXDiv: 200,
      hoverAccelYDiv: 100,
      hoverDriftPeriod: 75,
      hoverVertPeriod: 40,
      strafeAccelXDiv: 80,
      strafeAccelYDiv: 120,
      strafeDriftPeriod: 40,
      strafeVertPeriod: 55,
      exitAccelXDiv: 100,
      exitAccelYDiv: 20,
      exitGotoRange: 10,
      exitLeftMax: 4,
      exitRightMax: 8,
      exitMarginMul: 2,
      explosionDurationFrames: 20,
      hitFlashFrames: 1,
      fireIntervalFrames: 16,
      fireIntervalMin: 10,
      gunTurnDivisor: 10,
      gunTurnDivisorMin: 1,
      muzzleOffset: 40,
    });
    expect(HELI_LOOK_TINT).toEqual([0xf4a261, 0x4cc9f0]);
    expect(HELI_LOOK_TINT).toHaveLength(HELI.lookCount);
    expect(HELI_SPAWN).toEqual({
      initialConcurrent: 1,
      maxConcurrent: 1,
      firstLevelScore: 10000,
    });
    expect(SCORE).toEqual({ displayScale: 100 });
    expect(HIGH_SCORES).toEqual({
      storageKey: 'heli-attack-2.highScores',
      maxEntries: 10,
    });
    expect(GAME_FLOW).toEqual({
      gameOverDelayFrames: 200,
      pauseKeyCode: 80,
    });
    expect(POWERUP_FRAMES).toBe(500);
    expect(POWERUP).toEqual({
      TriDamage: 1,
      Invulnerability: 2,
      PredatorMode: 3,
      TimeRift: 4,
      Jetpack: 5,
    });
    expect(POWERUP_EFFECTS).toEqual({
      triDamageMultiplier: 3,
      jetpackThrust: 2,
      jetpackMaxUpSpeed: -32,
    });
    expect(HEALTH_PICKUP).toEqual({ amount: 20, cap: 100, firstThreshold: 15 });
    expect(POWERUP_DROP).toEqual({
      killsPerCrate: 3,
      nonHealthFrameCount: 13,
      crateW: 33,
      crateH: 32,
      chuteFallSpeed: 2,
      fallGravity: 1,
      groundLookaheadPx: 150,
      softLandSpeed: 4,
      bounceScale: -0.25,
      chuteScaleRate: 10,
    });
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
    expect(WEAPONS).toHaveLength(14);
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

  it('seeds ENEMY_BULLET and PLAYER_COMBAT from issue #18 / Flash values', () => {
    expect(ENEMY_BULLET).toEqual({
      damage: 10,
      speed: 7,
      poolCapacity: 64,
      maxLifetimeFrames: 300,
      cullMargin: 50,
      radius: 3,
    });
    expect(PLAYER_COMBAT).toEqual({
      maxHealth: 100,
      iFrameFrames: 10,
    });
    expect(ENEMY_BULLET.speed).toBe(HELI.bulletSpeed);
    expect(PLAYER_COMBAT.maxHealth).toBe(PLAYER_DEFAULTS.health);
  });

  it('defines a hard 33 ms player-hurt flash (not a fade)', () => {
    expect(HURT_FLASH).toEqual({
      durationMs: 33,
      red: 150,
      green: 0,
      blue: 0,
    });
    expect(HURT_FLASH.durationMs).toBe(Math.round(1000 / SIM_HZ));
  });
});
