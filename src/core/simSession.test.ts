import { describe, expect, it } from 'vitest';
import { SIM_DT, SIM_HZ, WORLD } from '../config/constants';
import { DEBUG_BOX_SPAWN, SimSession } from './simSession';

describe('SimSession', () => {
  it('reset restores a fresh run after timeStep / motion mutations (scene switch)', () => {
    const session = new SimSession();

    session.timeScale.setTimeStep(0.5);
    session.accumulator.advance(SIM_DT / 2);
    session.update(1000 / 30); // one sim tick at half speed
    expect(session.timeScale.timeStep).toBe(0.5);
    expect(session.debugBox.body.vy).toBeGreaterThan(0);
    expect(session.simTickCount).toBeGreaterThan(0);
    expect(session.accumulator.leftoverSeconds).toBeCloseTo(SIM_DT / 2);

    session.debugBox.placeAt(400, 50);
    session.debugBox.dragging = true;

    // Game → Boot → Game: create() must call reset() so state does not leak.
    session.reset();

    expect(session.timeScale.timeStep).toBe(1);
    expect(session.debugBox.body.x).toBe(DEBUG_BOX_SPAWN.x);
    expect(session.debugBox.body.y).toBe(DEBUG_BOX_SPAWN.y);
    expect(session.debugBox.body.vx).toBe(0);
    expect(session.debugBox.body.vy).toBe(0);
    expect(session.debugBox.dragging).toBe(false);
    expect(session.simTickCount).toBe(0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
    expect(session.displayedSimRate).toBe(0);
    expect(session.accumulator.leftoverSeconds).toBe(0);
  });

  it('ignores NaN deltas so the HUD rate timer cannot freeze', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);

    session.update(Number.NaN);
    for (let i = 0; i < 300; i += 1) {
      session.update(1000 / 30);
    }

    expect(Number.isNaN(session.secondTimerMs)).toBe(false);
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
  });

  it('converts Phaser delta ms → seconds and steps at ~30 Hz for 60 Hz frames', () => {
    const session = new SimSession();
    const frames = 60;
    const deltaMs = 1000 / 60;

    for (let i = 0; i < frames; i += 1) {
      session.update(deltaMs);
    }

    expect(session.simTickCount).toBe(SIM_HZ);
    const rate = session.simTickCount / (frames * (deltaMs / 1000));
    expect(rate).toBeGreaterThanOrEqual(SIM_HZ - 1);
    expect(rate).toBeLessThanOrEqual(SIM_HZ + 1);
  });

  it('updates displayedSimRate after ~1s of wall time', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
  });

  it('steps the debug box under gravity scaled by the live timeStep', () => {
    const session = new SimSession();
    session.timeScale.setTimeStep(0.5);
    session.update(1000 / 30); // exactly one SIM_DT in ms

    // Gravity applied once; displacement = vy * timeStep = 1 * 0.5.
    expect(session.debugBox.body.vy).toBe(WORLD.gravity);
    expect(session.debugBox.body.y).toBe(
      DEBUG_BOX_SPAWN.y + WORLD.gravity * 0.5,
    );
  });

  it('owns a 24×16 test arena of 50px tiles', () => {
    const session = new SimSession();
    expect(session.map.tileSize).toBe(50);
    expect(session.map.width).toBe(24);
    expect(session.map.height).toBe(16);
  });
});
