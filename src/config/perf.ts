/**
 * Performance budgets & pool audit constants (issue #37).
 *
 * Desktop target is sustained 60fps; mid-range mobile is ≥30fps under peak
 * load. Frame budgets are exact `1000 / fps` ms. Pool / atlas caps below are
 * the audited ceilings the perf HUD and peak-load harness assert against.
 */

import { ATLAS_KEY, BG_IMAGE_KEY } from './art';
import { BULLET, ENEMY_BULLET, HELI_SPAWN } from './constants';
import { particleBudgetCap, PARTICLE_FX } from './particles';

/** Sustained render targets (acceptance: 60 desktop / ≥30 mid-range phone). */
export const PERF_DESKTOP_TARGET_FPS = 60;
export const PERF_MOBILE_TARGET_FPS = 30;

/** Exact frame budgets in milliseconds (`1000 / targetFps`). */
export const PERF_DESKTOP_FRAME_BUDGET_MS = 1000 / PERF_DESKTOP_TARGET_FPS;
export const PERF_MOBILE_FRAME_BUDGET_MS = 1000 / PERF_MOBILE_TARGET_FPS;

/**
 * Peak-load sim-tick wall-time budget (ms). Leaves headroom inside the mobile
 * frame for WebGL draw + particles + HUD so ≥30fps holds on mid-range phones.
 */
export const PERF_PEAK_SIM_TICK_BUDGET_MS = 8;

/** Rolling window for HUD FPS / frame-time stats (render frames). */
export const PERF_SAMPLE_WINDOW_FRAMES = 60;

/** Sim ticks measured by the peak-load harness (~10s @30Hz). */
export const PERF_PEAK_LOAD_MEASURE_TICKS = 300;

/**
 * Visual sprite pools in GameScene — sized for {@link HELI_SPAWN.maxConcurrent}
 * plus spare explosion slots so kill FX never allocate under load.
 */
export const PERF_HELI_VISUAL_POOL = 8;
export const PERF_EXPLOSION_VISUAL_POOL = 8;

/**
 * Central perf tunables — locked by unit tests so the HUD / report / harness
 * share one source of truth.
 */
export const PERF = {
  desktopTargetFps: PERF_DESKTOP_TARGET_FPS,
  mobileTargetFps: PERF_MOBILE_TARGET_FPS,
  desktopFrameBudgetMs: PERF_DESKTOP_FRAME_BUDGET_MS,
  mobileFrameBudgetMs: PERF_MOBILE_FRAME_BUDGET_MS,
  peakSimTickBudgetMs: PERF_PEAK_SIM_TICK_BUDGET_MS,
  sampleWindowFrames: PERF_SAMPLE_WINDOW_FRAMES,
  peakLoadMeasureTicks: PERF_PEAK_LOAD_MEASURE_TICKS,

  /** Fixed projectile pools (#10 / #18) — never grow after construction. */
  playerBulletPoolCapacity: BULLET.poolCapacity,
  enemyBulletPoolCapacity: ENEMY_BULLET.poolCapacity,

  /** Soft enemy cap from the spawn treadmill (#19). */
  heliMaxConcurrent: HELI_SPAWN.maxConcurrent,
  heliVisualPool: PERF_HELI_VISUAL_POOL,
  explosionVisualPool: PERF_EXPLOSION_VISUAL_POOL,

  /** Particle FX fixed budgets (#35). */
  particleEventQueueCapacity: PARTICLE_FX.eventQueueCapacity,
  particleBudgetCap: particleBudgetCap(),

  /**
   * Single gameplay atlas — all sprites share this texture key so Phaser
   * batches draw calls (acceptance: atlas draw-call batching).
   */
  gameplayAtlasKey: ATLAS_KEY,
  /** Only the full-bleed backdrop is allowed outside the atlas. */
  nonAtlasTextureKeys: [BG_IMAGE_KEY] as const,

  /** localStorage / query visibility for the perf HUD. */
  storageKey: 'heli-attack-2.perfHudVisible',
  /** Default: show the HUD so frame targets are visible during demos. */
  defaultHudVisible: true,
} as const;

/** True when average frame time fits the desktop 60fps budget. */
export function meetsDesktopFrameBudget(avgFrameMs: number): boolean {
  return (
    Number.isFinite(avgFrameMs) &&
    avgFrameMs > 0 &&
    // Tiny epsilon: summing N copies of `1000/60` in a Float64 ring can drift
    // a few ULPs above the exact budget without meaning a real miss.
    avgFrameMs <= PERF.desktopFrameBudgetMs + 1e-9
  );
}

/** True when average frame time fits the mid-range mobile ≥30fps budget. */
export function meetsMobileFrameBudget(avgFrameMs: number): boolean {
  return (
    Number.isFinite(avgFrameMs) &&
    avgFrameMs > 0 &&
    avgFrameMs <= PERF.mobileFrameBudgetMs + 1e-9
  );
}

/** True when a measured peak-load sim tick average fits the tick budget. */
export function meetsPeakSimTickBudget(avgTickMs: number): boolean {
  return (
    Number.isFinite(avgTickMs) &&
    avgTickMs >= 0 &&
    avgTickMs <= PERF.peakSimTickBudgetMs + 1e-9
  );
}

/**
 * Parse `?perf=0|1|false|true` (and bare `perf`) for initial HUD visibility.
 * Returns `null` when the query does not mention perf.
 */
export function parsePerfHudVisible(
  search: string | URLSearchParams,
): boolean | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  if (!params.has('perf')) {
    return null;
  }
  const raw = params.get('perf');
  if (raw === null || raw === '' || raw === '1' || raw === 'true') {
    return true;
  }
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return null;
}
