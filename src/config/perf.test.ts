/**
 * Issue #37 acceptance: frame budgets lock to 60fps desktop / ≥30fps mobile,
 * pool + atlas caps match the audited ceilings, and budget helpers use exact
 * `1000 / fps` ms thresholds.
 */

import { describe, expect, it } from 'vitest';
import { ATLAS_KEY, BG_IMAGE_KEY, TITLE_IMAGE_KEY } from './art';
import { BULLET, ENEMY_BULLET, HELI_SPAWN } from './constants';
import { particleBudgetCap, PARTICLE_FX } from './particles';
import {
  meetsDesktopFrameBudget,
  meetsMobileFrameBudget,
  meetsPeakSimTickBudget,
  parsePerfHudVisible,
  PERF,
  PERF_DESKTOP_FRAME_BUDGET_MS,
  PERF_DESKTOP_TARGET_FPS,
  PERF_EXPLOSION_VISUAL_POOL,
  PERF_FALLING_PILOT_VISUAL_POOL,
  PERF_HELI_SHARD_VISUAL_POOL,
  PERF_HELI_VISUAL_POOL,
  PERF_HELI_WRECK_VISUAL_POOL,
  PERF_MOBILE_FRAME_BUDGET_MS,
  PERF_MOBILE_TARGET_FPS,
  PERF_PEAK_LOAD_MEASURE_TICKS,
  PERF_PEAK_SIM_TICK_BUDGET_MS,
  PERF_SAMPLE_WINDOW_FRAMES,
} from './perf';

describe('config/perf (#37)', () => {
  it('locks desktop 60fps and mobile ≥30fps frame budgets to exact ms', () => {
    expect(PERF_DESKTOP_TARGET_FPS).toBe(60);
    expect(PERF_MOBILE_TARGET_FPS).toBe(30);
    expect(PERF_DESKTOP_FRAME_BUDGET_MS).toBe(1000 / 60);
    expect(PERF_MOBILE_FRAME_BUDGET_MS).toBe(1000 / 30);
    expect(PERF.desktopTargetFps).toBe(60);
    expect(PERF.mobileTargetFps).toBe(30);
    expect(PERF.desktopFrameBudgetMs).toBeCloseTo(16.666666666666668, 12);
    expect(PERF.mobileFrameBudgetMs).toBeCloseTo(33.333333333333336, 12);
    expect(PERF_PEAK_SIM_TICK_BUDGET_MS).toBe(8);
    expect(PERF.peakSimTickBudgetMs).toBe(8);
    expect(PERF_SAMPLE_WINDOW_FRAMES).toBe(60);
    expect(PERF_PEAK_LOAD_MEASURE_TICKS).toBe(300);
  });

  it('audits fixed pool / particle / enemy caps used under peak load', () => {
    expect(PERF.playerBulletPoolCapacity).toBe(BULLET.poolCapacity);
    expect(PERF.playerBulletPoolCapacity).toBe(64);
    expect(PERF.enemyBulletPoolCapacity).toBe(ENEMY_BULLET.poolCapacity);
    expect(PERF.enemyBulletPoolCapacity).toBe(64);
    expect(PERF.heliMaxConcurrent).toBe(HELI_SPAWN.maxConcurrent);
    expect(PERF.heliMaxConcurrent).toBe(1);
    expect(PERF_HELI_VISUAL_POOL).toBe(8);
    expect(PERF_EXPLOSION_VISUAL_POOL).toBe(8);
    expect(PERF_HELI_WRECK_VISUAL_POOL).toBe(4);
    expect(PERF_HELI_SHARD_VISUAL_POOL).toBe(24);
    expect(PERF_FALLING_PILOT_VISUAL_POOL).toBe(4);
    expect(PERF.heliVisualPool).toBeGreaterThanOrEqual(PERF.heliMaxConcurrent);
    expect(PERF.heliWreckVisualPool).toBe(PERF_HELI_WRECK_VISUAL_POOL);
    expect(PERF.heliShardVisualPool).toBe(PERF_HELI_SHARD_VISUAL_POOL);
    expect(PERF.fallingPilotVisualPool).toBe(PERF_FALLING_PILOT_VISUAL_POOL);
    expect(PERF.particleEventQueueCapacity).toBe(
      PARTICLE_FX.eventQueueCapacity,
    );
    expect(PERF.particleEventQueueCapacity).toBe(128);
    expect(PERF.particleBudgetCap).toBe(particleBudgetCap());
    expect(PERF.particleBudgetCap).toBe(432);
  });

  it('batches gameplay draw calls through a single atlas key', () => {
    expect(PERF.gameplayAtlasKey).toBe(ATLAS_KEY);
    expect(PERF.gameplayAtlasKey).toBe('game-atlas');
    expect(PERF.nonAtlasTextureKeys).toEqual([BG_IMAGE_KEY, TITLE_IMAGE_KEY]);
    expect(PERF.nonAtlasTextureKeys).toEqual(['game-bg', 'game-title']);
  });

  it('evaluates frame / tick budgets against the locked thresholds', () => {
    // Exactly on budget → pass.
    expect(meetsDesktopFrameBudget(PERF.desktopFrameBudgetMs)).toBe(true);
    expect(meetsMobileFrameBudget(PERF.mobileFrameBudgetMs)).toBe(true);
    expect(meetsPeakSimTickBudget(PERF.peakSimTickBudgetMs)).toBe(true);

    // Comfortable headroom → pass.
    expect(meetsDesktopFrameBudget(1000 / 60)).toBe(true);
    expect(meetsDesktopFrameBudget(12)).toBe(true);
    expect(meetsMobileFrameBudget(1000 / 30)).toBe(true);
    expect(meetsMobileFrameBudget(20)).toBe(true);
    expect(meetsPeakSimTickBudget(0)).toBe(true);
    expect(meetsPeakSimTickBudget(4)).toBe(true);

    // Over budget → fail (desktop miss still may pass mobile).
    expect(meetsDesktopFrameBudget(16.7)).toBe(false);
    expect(meetsDesktopFrameBudget(20)).toBe(false);
    expect(meetsMobileFrameBudget(33.4)).toBe(false);
    expect(meetsMobileFrameBudget(40)).toBe(false);
    expect(meetsPeakSimTickBudget(8.01)).toBe(false);
    expect(meetsPeakSimTickBudget(Number.NaN)).toBe(false);
    expect(meetsDesktopFrameBudget(0)).toBe(false);
    expect(meetsMobileFrameBudget(-1)).toBe(false);
  });

  it('parses ?perf= query for HUD visibility', () => {
    expect(parsePerfHudVisible('')).toBeNull();
    expect(parsePerfHudVisible('?foo=1')).toBeNull();
    expect(parsePerfHudVisible('?perf')).toBe(true);
    expect(parsePerfHudVisible('?perf=1')).toBe(true);
    expect(parsePerfHudVisible('?perf=true')).toBe(true);
    expect(parsePerfHudVisible('?perf=0')).toBe(false);
    expect(parsePerfHudVisible('?perf=false')).toBe(false);
    expect(PERF.storageKey).toBe('heli-attack-2.perfHudVisible');
    expect(PERF.defaultHudVisible).toBe(false);
  });
});
