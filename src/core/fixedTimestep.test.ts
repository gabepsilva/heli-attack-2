import { describe, expect, it } from 'vitest';
import { SIM_DT, SIM_HZ } from '../config/constants';
import { FixedTimestepAccumulator } from './fixedTimestep';

/** Assert sim rate is ~30/s (acceptance: steady on 60Hz and 144Hz displays). */
function expectNearSimHz(ticks: number, wallSeconds: number): void {
  const rate = ticks / wallSeconds;
  expect(rate).toBeGreaterThanOrEqual(SIM_HZ - 1);
  expect(rate).toBeLessThanOrEqual(SIM_HZ + 1);
}

describe('FixedTimestepAccumulator', () => {
  it('produces ~30 sim ticks per real second at 60 Hz render', () => {
    const acc = new FixedTimestepAccumulator();
    const frames = 60;
    const renderDt = 1 / 60;
    let ticks = 0;

    for (let i = 0; i < frames; i += 1) {
      ticks += acc.advance(renderDt);
    }

    expectNearSimHz(ticks, frames * renderDt);
    expect(ticks).toBe(SIM_HZ);
  });

  it('produces ~30 sim ticks per real second at 144 Hz render', () => {
    const acc = new FixedTimestepAccumulator();
    // Use several seconds so float error in 1/144 does not dominate.
    const seconds = 5;
    const frames = 144 * seconds;
    const renderDt = 1 / 144;
    let ticks = 0;

    for (let i = 0; i < frames; i += 1) {
      ticks += acc.advance(renderDt);
    }

    expectNearSimHz(ticks, frames * renderDt);
  });

  it('banks partial frames until a full SIM_DT is available', () => {
    const acc = new FixedTimestepAccumulator();

    expect(acc.advance(SIM_DT / 2)).toBe(0);
    expect(acc.leftoverSeconds).toBeCloseTo(SIM_DT / 2);
    expect(acc.advance(SIM_DT / 2)).toBe(1);
    expect(acc.leftoverSeconds).toBeCloseTo(0);
  });

  it('can catch up multiple steps when a single delta spans several ticks', () => {
    const acc = new FixedTimestepAccumulator();
    expect(acc.advance(SIM_DT * 3)).toBe(3);
  });

  it('caps steps per frame to avoid spiral-of-death on long stalls', () => {
    const acc = new FixedTimestepAccumulator(SIM_DT, 5);
    expect(acc.advance(SIM_DT * 100)).toBe(5);
    expect(acc.leftoverSeconds).toBe(0);
  });

  it('ignores negative deltas', () => {
    const acc = new FixedTimestepAccumulator();
    expect(acc.advance(-0.1)).toBe(0);
  });

  it('ignores NaN / non-finite deltas without poisoning the accumulator', () => {
    const acc = new FixedTimestepAccumulator();
    expect(acc.advance(Number.NaN)).toBe(0);
    expect(acc.leftoverSeconds).toBe(0);
    expect(acc.advance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(acc.leftoverSeconds).toBe(0);
    // Still healthy afterward.
    expect(acc.advance(SIM_DT)).toBe(1);
  });

  it('reset clears banked leftover', () => {
    const acc = new FixedTimestepAccumulator();
    acc.advance(SIM_DT / 2);
    expect(acc.leftoverSeconds).toBeCloseTo(SIM_DT / 2);
    acc.reset();
    expect(acc.leftoverSeconds).toBe(0);
  });
});
