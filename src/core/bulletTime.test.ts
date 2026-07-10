import { describe, expect, it } from 'vitest';
import { BULLET_TIME, WORLD } from '../config/constants';
import { applyMotion } from './timeScale';
import {
  bulletTimeMeterRatio,
  createBulletTimeState,
  isBulletTimeActive,
  refillBulletTimeOnKill,
  stepBulletTime,
  type BulletTimeDrivers,
} from './bulletTime';

const idle: BulletTimeDrivers = {
  keyHeld: false,
  timeRiftActive: false,
  gameOver: false,
};

const hold: BulletTimeDrivers = { ...idle, keyHeld: true };

describe('bullet-time (#42)', () => {
  it('locks BULLET_TIME to exact spec values', () => {
    expect(BULLET_TIME.maxFrames).toBe(250);
    expect(BULLET_TIME.refillPerKill).toBe(250 / 3);
    expect(BULLET_TIME.minScale).toBe(0.2);
    expect(BULLET_TIME.easePerFrame).toBe(0.1);
    expect(WORLD.timeStep).toBe(1);
  });

  it('starts with a full meter of maxFrames', () => {
    const state = createBulletTimeState();
    expect(state.meter).toBe(250);
    expect(bulletTimeMeterRatio(state)).toBe(1);
  });

  it('eases the sim to 0.2× while held and back to 1× on release (no snap)', () => {
    const state = createBulletTimeState();
    let timeStep = WORLD.timeStep;

    // 1 → 0.9 → … → 0.2 takes exactly 8 frames of −0.1.
    const down: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      timeStep = stepBulletTime(state, timeStep, hold);
      down.push(timeStep);
    }
    expect(down).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]);
    expect(timeStep).toBe(BULLET_TIME.minScale);

    // Further holds clamp at the floor — never snap below 0.2.
    timeStep = stepBulletTime(state, timeStep, hold);
    expect(timeStep).toBe(0.2);

    // Release eases back up at +0.1/frame — never an instant toggle to 1.
    const up: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      timeStep = stepBulletTime(state, timeStep, idle);
      up.push(timeStep);
    }
    expect(up).toEqual([0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(timeStep).toBe(WORLD.timeStep);

    // One more idle frame stays at 1 (no overshoot).
    expect(stepBulletTime(state, timeStep, idle)).toBe(1);
  });

  it('drains 1/frame while held, ends slow-mo at 0, and refills ⅓ max per kill', () => {
    const state = createBulletTimeState();
    let timeStep = 1;

    timeStep = stepBulletTime(state, timeStep, hold);
    expect(state.meter).toBe(249);
    expect(timeStep).toBe(0.9);

    // Drain the rest of the meter while already at the floor.
    state.meter = 3;
    timeStep = 0.2;
    timeStep = stepBulletTime(state, timeStep, hold);
    expect(state.meter).toBe(2);
    timeStep = stepBulletTime(state, timeStep, hold);
    expect(state.meter).toBe(1);
    timeStep = stepBulletTime(state, timeStep, hold);
    expect(state.meter).toBe(0);
    expect(timeStep).toBe(0.2);
    expect(isBulletTimeActive(state, hold)).toBe(false);

    // Meter empty + still holding → ease back up (slow-mo ended).
    timeStep = stepBulletTime(state, timeStep, hold);
    expect(state.meter).toBe(0);
    expect(timeStep).toBe(0.3);

    // Kill refill: + max/3, capped at max.
    refillBulletTimeOnKill(state);
    expect(state.meter).toBeCloseTo(250 / 3, 10);
    expect(state.meter).toBe(BULLET_TIME.refillPerKill);

    refillBulletTimeOnKill(state);
    expect(state.meter).toBeCloseTo((2 * 250) / 3, 10);

    refillBulletTimeOnKill(state);
    expect(state.meter).toBe(250);

    // Cap: another kill does not exceed max.
    refillBulletTimeOnKill(state);
    expect(state.meter).toBe(250);
  });

  it('slows the player with the world (same eased timeStep — unlike TimeRift)', () => {
    const state = createBulletTimeState();
    let timeStep = 1;
    for (let i = 0; i < 8; i += 1) {
      timeStep = stepBulletTime(state, timeStep, hold);
    }
    expect(timeStep).toBe(0.2);

    // Player motion uses the same factor as the world (no override to 1).
    const speed = 5; // walk-cap style px/frame
    expect(applyMotion(0, speed, timeStep)).toBe(1);
    expect(applyMotion(0, speed, WORLD.timeStep)).toBe(5);
  });

  it('TimeRift forces the same slow-mo without draining the meter', () => {
    const state = createBulletTimeState();
    const before = state.meter;
    let timeStep = 1;
    const rift: BulletTimeDrivers = {
      keyHeld: false,
      timeRiftActive: true,
      gameOver: false,
    };

    expect(isBulletTimeActive(state, rift)).toBe(true);

    const down: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      timeStep = stepBulletTime(state, timeStep, rift);
      down.push(timeStep);
    }
    expect(down).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]);
    expect(state.meter).toBe(before);

    // Key held under TimeRift still must not drain (Flash powerupOn != 4 gate).
    timeStep = stepBulletTime(state, timeStep, {
      keyHeld: true,
      timeRiftActive: true,
      gameOver: false,
    });
    expect(state.meter).toBe(before);
    expect(timeStep).toBe(0.2);
  });

  it('death slow-mo eases toward 0.2 without requiring the key or meter', () => {
    const state = createBulletTimeState();
    state.meter = 0;
    let timeStep = 1;
    const dead: BulletTimeDrivers = {
      keyHeld: false,
      timeRiftActive: false,
      gameOver: true,
    };

    expect(isBulletTimeActive(state, dead)).toBe(true);
    timeStep = stepBulletTime(state, timeStep, dead);
    expect(timeStep).toBe(0.9);
    expect(state.meter).toBe(0);
  });
});
