/**
 * Issue #35 acceptance: particle FX queue is fixed-capacity and never grows
 * under heavy simultaneous load (drops oldest when full).
 */

import { describe, expect, it } from 'vitest';
import { PARTICLE_FX } from '../config/particles';
import { buildImpactFx, buildKillFx } from './particleEvents';
import { ParticleFxQueue } from './particleQueue';

describe('fx/particleQueue (#35)', () => {
  it('defaults to the configured event queue capacity', () => {
    const q = new ParticleFxQueue();
    expect(q.capacity).toBe(PARTICLE_FX.eventQueueCapacity);
    expect(q.capacity).toBe(128);
    expect(q.length).toBe(0);
  });

  it('never grows past capacity — drops oldest under heavy load', () => {
    const capacity = 8;
    const q = new ParticleFxQueue(capacity);
    for (let i = 0; i < capacity; i += 1) {
      q.pushAll(buildImpactFx(i, 0));
    }
    expect(q.length).toBe(capacity);
    expect(q.dropped).toBe(0);

    // Flood with kill FX (1 smoke event each) — must not grow the ring.
    for (let i = 0; i < 40; i += 1) {
      q.pushAll(buildKillFx(i, i));
    }
    expect(q.capacity).toBe(capacity);
    expect(q.length).toBe(capacity);
    expect(q.dropped).toBeGreaterThan(0);
    expect(q.pushed).toBe(capacity + 40 * 1);
  });

  it('drain returns events in order and clears the ring', () => {
    const q = new ParticleFxQueue(16);
    q.pushAll(buildImpactFx(1, 2));
    q.pushAll(buildKillFx(3, 4));
    const drained = q.drain();
    expect(drained).toHaveLength(1 + 1);
    expect(drained[0]).toEqual({
      kind: 'impact',
      x: 1,
      y: 2,
      count: PARTICLE_FX.impactBurst,
    });
    expect(drained[1]!.kind).toBe('smoke');
    expect(q.length).toBe(0);
    expect(q.drain()).toEqual([]);
  });

  it('rejects non-positive capacities', () => {
    expect(() => new ParticleFxQueue(0)).toThrow(/positive integer/);
    expect(() => new ParticleFxQueue(-1)).toThrow(/positive integer/);
  });
});
