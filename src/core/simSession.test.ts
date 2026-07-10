import { describe, expect, it } from 'vitest';
import { SIM_DT, SIM_HZ } from '../config/constants';
import { DEMO_SPEED, SimSession } from './simSession';

describe('SimSession', () => {
  it('reset restores a fresh run after timeStep / motion mutations (scene switch)', () => {
    const session = new SimSession();

    // Simulate play: change timeStep, bank leftover, advance demo motion.
    session.timeScale.setTimeStep(0.5);
    session.accumulator.advance(SIM_DT / 2);
    session.update(1000 / 30); // one sim tick at half speed
    expect(session.timeScale.timeStep).toBe(0.5);
    expect(session.demoX).toBeGreaterThan(0);
    expect(session.simTickCount).toBeGreaterThan(0);
    expect(session.accumulator.leftoverSeconds).toBeGreaterThanOrEqual(0);

    // Game → Boot → Game: create() must call reset() so state does not leak.
    session.reset();

    expect(session.timeScale.timeStep).toBe(1);
    expect(session.demoX).toBe(0);
    expect(session.simTickCount).toBe(0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
    expect(session.displayedSimRate).toBe(0);
    expect(session.accumulator.leftoverSeconds).toBe(0);
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
    // 30 frames at 33.333ms ≈ 1s wall, ~30 sim ticks.
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
  });

  it('scales demo motion by the live timeStep', () => {
    const session = new SimSession();
    session.timeScale.setTimeStep(0.5);
    session.update(1000 / 30); // exactly one SIM_DT in ms
    expect(session.demoX).toBe(DEMO_SPEED * 0.5);
  });
});
