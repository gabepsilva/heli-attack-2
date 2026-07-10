/**
 * Rolling frame-time / FPS sampler + pool occupancy snapshot (issue #37).
 *
 * Pure module — GameScene feeds Phaser deltas each render frame; the perf HUD
 * and peak-load report read {@link PerfMonitor.snapshot}.
 */

import {
  meetsDesktopFrameBudget,
  meetsMobileFrameBudget,
  PERF,
} from '../config/perf';

/** Live pool / FX occupancy the HUD shows next to FPS. */
export type PerfPoolSnapshot = {
  bulletsActive: number;
  bulletsCapacity: number;
  enemyBulletsActive: number;
  enemyBulletsCapacity: number;
  helisActive: number;
  helisMax: number;
  particlesQueued: number;
  particlesCapacity: number;
  particleBudgetCap: number;
};

/** Aggregated stats for the HUD / report / tests. */
export type PerfStats = {
  sampleCount: number;
  fps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  p95FrameMs: number;
  meetsDesktop: boolean;
  meetsMobile: boolean;
  pools: PerfPoolSnapshot;
};

const EMPTY_POOLS: PerfPoolSnapshot = {
  bulletsActive: 0,
  bulletsCapacity: PERF.playerBulletPoolCapacity,
  enemyBulletsActive: 0,
  enemyBulletsCapacity: PERF.enemyBulletPoolCapacity,
  helisActive: 0,
  helisMax: PERF.heliMaxConcurrent,
  particlesQueued: 0,
  particlesCapacity: PERF.particleEventQueueCapacity,
  particleBudgetCap: PERF.particleBudgetCap,
};

/**
 * Ring-buffer frame sampler. Capacity is {@link PERF.sampleWindowFrames}
 * (60) so the HUD FPS matches one second at the desktop target.
 */
export class PerfMonitor {
  private readonly deltas: Float64Array;
  private write = 0;
  private filled = 0;
  private pools: PerfPoolSnapshot = { ...EMPTY_POOLS };

  constructor(windowFrames: number = PERF.sampleWindowFrames) {
    if (!Number.isInteger(windowFrames) || windowFrames < 1) {
      throw new Error(
        `PerfMonitor windowFrames must be a positive integer, got ${windowFrames}`,
      );
    }
    this.deltas = new Float64Array(windowFrames);
  }

  get windowSize(): number {
    return this.deltas.length;
  }

  get sampleCount(): number {
    return this.filled;
  }

  /**
   * Record one render-frame delta (Phaser `update` delta in ms) and the
   * latest pool occupancy. Non-finite / non-positive deltas are ignored so a
   * hitch spike from tab-suspend cannot poison the ring forever.
   */
  sample(deltaMs: number, pools?: PerfPoolSnapshot): void {
    if (pools) {
      this.pools = { ...pools };
    }
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return;
    }
    this.deltas[this.write] = deltaMs;
    this.write = (this.write + 1) % this.deltas.length;
    if (this.filled < this.deltas.length) {
      this.filled += 1;
    }
  }

  /** Latest pool snapshot (defaults until the first sample with pools). */
  getPools(): PerfPoolSnapshot {
    return { ...this.pools };
  }

  /** Aggregate FPS / frame-time stats over the rolling window. */
  snapshot(): PerfStats {
    if (this.filled === 0) {
      return {
        sampleCount: 0,
        fps: 0,
        avgFrameMs: 0,
        maxFrameMs: 0,
        p95FrameMs: 0,
        meetsDesktop: false,
        meetsMobile: false,
        pools: this.getPools(),
      };
    }

    const values: number[] = [];
    // Oldest → newest when the ring is full; else 0..filled-1 in order.
    if (this.filled < this.deltas.length) {
      for (let i = 0; i < this.filled; i += 1) {
        values.push(this.deltas[i]!);
      }
    } else {
      for (let i = 0; i < this.deltas.length; i += 1) {
        const idx = (this.write + i) % this.deltas.length;
        values.push(this.deltas[idx]!);
      }
    }

    let sum = 0;
    let max = 0;
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i]!;
      sum += v;
      if (v > max) {
        max = v;
      }
    }
    const avg = sum / values.length;
    const sorted = values.slice().sort((a, b) => a - b);
    const p95Index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.95),
    );
    const p95 = sorted[p95Index]!;
    const fps = avg > 0 ? 1000 / avg : 0;

    return {
      sampleCount: this.filled,
      fps,
      avgFrameMs: avg,
      maxFrameMs: max,
      p95FrameMs: p95,
      meetsDesktop: meetsDesktopFrameBudget(avg),
      meetsMobile: meetsMobileFrameBudget(avg),
      pools: this.getPools(),
    };
  }

  reset(): void {
    this.write = 0;
    this.filled = 0;
    this.deltas.fill(0);
    this.pools = { ...EMPTY_POOLS };
  }
}

/** One-line status for the HUD / debug logs (also unit-tested). */
export function formatPerfStatus(stats: PerfStats): string {
  const desk = stats.meetsDesktop ? 'OK' : 'MISS';
  const mob = stats.meetsMobile ? 'OK' : 'MISS';
  const p = stats.pools;
  return (
    `fps ${stats.fps.toFixed(1)}  ` +
    `avg ${stats.avgFrameMs.toFixed(2)}ms  ` +
    `p95 ${stats.p95FrameMs.toFixed(2)}ms  ` +
    `max ${stats.maxFrameMs.toFixed(2)}ms  ` +
    `60fps=${desk} 30fps=${mob}  ` +
    `bullets ${p.bulletsActive}/${p.bulletsCapacity}  ` +
    `ebullets ${p.enemyBulletsActive}/${p.enemyBulletsCapacity}  ` +
    `helis ${p.helisActive}/${p.helisMax}  ` +
    `fx ${p.particlesQueued}/${p.particlesCapacity}  ` +
    `pbudget ${p.particleBudgetCap}`
  );
}

/** Empty pool snapshot for tests. */
export function emptyPerfPools(
  partial: Partial<PerfPoolSnapshot> = {},
): PerfPoolSnapshot {
  return { ...EMPTY_POOLS, ...partial };
}
