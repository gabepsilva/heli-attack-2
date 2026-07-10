import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/constants';
import { applyMotion, TimeScale } from './timeScale';

describe('TimeScale / timeStep', () => {
  it('defaults to the WORLD.timeStep of 1', () => {
    const scale = new TimeScale();
    expect(scale.timeStep).toBe(1);
    expect(scale.timeStep).toBe(WORLD.timeStep);
  });

  it('scales entity motion — halving timeStep halves displacement', () => {
    const speed = 5; // px/frame, matching walk-cap style motion
    const full = applyMotion(0, speed, 1);
    const half = applyMotion(0, speed, 0.5);

    expect(full).toBe(5);
    expect(half).toBe(2.5);
    expect(half).toBe(full / 2);
  });

  it('lets callers set and reset the live timeStep factor', () => {
    const scale = new TimeScale();
    scale.setTimeStep(0.5);
    expect(scale.timeStep).toBe(0.5);

    // Verify motion uses the live factor (acceptance: verify by halving it).
    expect(applyMotion(10, 6, scale.timeStep)).toBe(13);

    scale.reset();
    expect(scale.timeStep).toBe(1);
    expect(applyMotion(10, 6, scale.timeStep)).toBe(16);
  });

  it('rejects invalid timeStep values', () => {
    const scale = new TimeScale();
    expect(() => scale.setTimeStep(-1)).toThrow();
    expect(() => scale.setTimeStep(Number.NaN)).toThrow();
  });
});
