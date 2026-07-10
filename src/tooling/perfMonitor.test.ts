/**
 * Issue #37 acceptance: PerfMonitor reports sustained 60fps / ≥30fps against
 * the locked frame budgets, and formatPerfStatus exposes pool occupancy.
 */

import { describe, expect, it } from 'vitest';
import { PERF } from '../config/perf';
import { emptyPerfPools, formatPerfStatus, PerfMonitor } from './perfMonitor';

describe('tooling/perfMonitor (#37)', () => {
  it('defaults the sample window to 60 frames (1s @ desktop target)', () => {
    const mon = new PerfMonitor();
    expect(mon.windowSize).toBe(PERF.sampleWindowFrames);
    expect(mon.windowSize).toBe(60);
    expect(mon.sampleCount).toBe(0);
    const empty = mon.snapshot();
    expect(empty.fps).toBe(0);
    expect(empty.meetsDesktop).toBe(false);
    expect(empty.meetsMobile).toBe(false);
  });

  it('reports sustained 60fps when fed exact desktop frame deltas', () => {
    const mon = new PerfMonitor();
    const pools = emptyPerfPools({
      bulletsActive: 64,
      bulletsCapacity: 64,
      helisActive: 6,
      helisMax: 6,
    });
    const dt = PERF.desktopFrameBudgetMs; // 1000/60
    for (let i = 0; i < 60; i += 1) {
      mon.sample(dt, pools);
    }
    const stats = mon.snapshot();
    expect(stats.sampleCount).toBe(60);
    expect(stats.avgFrameMs).toBeCloseTo(dt, 10);
    expect(stats.fps).toBeCloseTo(PERF.desktopTargetFps, 10);
    expect(stats.meetsDesktop).toBe(true);
    expect(stats.meetsMobile).toBe(true);
    expect(stats.pools.bulletsActive).toBe(64);
    expect(stats.pools.helisActive).toBe(6);

    const line = formatPerfStatus(stats);
    expect(line).toContain('fps 60.0');
    expect(line).toContain('60fps=OK');
    expect(line).toContain('30fps=OK');
    expect(line).toContain('bullets 64/64');
    expect(line).toContain('helis 6/6');
  });

  it('passes mobile ≥30fps and fails desktop when fed 30fps deltas', () => {
    const mon = new PerfMonitor();
    const dt = PERF.mobileFrameBudgetMs; // 1000/30
    for (let i = 0; i < 30; i += 1) {
      mon.sample(dt);
    }
    const stats = mon.snapshot();
    expect(stats.fps).toBeCloseTo(PERF.mobileTargetFps, 10);
    expect(stats.meetsDesktop).toBe(false);
    expect(stats.meetsMobile).toBe(true);
    expect(formatPerfStatus(stats)).toContain('60fps=MISS');
    expect(formatPerfStatus(stats)).toContain('30fps=OK');
  });

  it('fails both budgets when average frame time exceeds mobile budget', () => {
    const mon = new PerfMonitor(8);
    for (let i = 0; i < 8; i += 1) {
      mon.sample(40); // 25fps
    }
    const stats = mon.snapshot();
    expect(stats.fps).toBeCloseTo(25, 10);
    expect(stats.meetsDesktop).toBe(false);
    expect(stats.meetsMobile).toBe(false);
    expect(stats.maxFrameMs).toBe(40);
    expect(stats.p95FrameMs).toBe(40);
  });

  it('ignores non-positive deltas and keeps a fixed ring (no growth / GC churn)', () => {
    const mon = new PerfMonitor(4);
    mon.sample(Number.NaN);
    mon.sample(-1);
    mon.sample(0);
    expect(mon.sampleCount).toBe(0);

    mon.sample(10);
    mon.sample(20);
    mon.sample(30);
    mon.sample(40);
    mon.sample(50); // overwrites oldest (10)
    expect(mon.sampleCount).toBe(4);
    expect(mon.windowSize).toBe(4);
    const stats = mon.snapshot();
    expect(stats.avgFrameMs).toBeCloseTo((20 + 30 + 40 + 50) / 4, 10);
    expect(stats.maxFrameMs).toBe(50);

    mon.reset();
    expect(mon.sampleCount).toBe(0);
    expect(mon.snapshot().fps).toBe(0);
  });
});
