/**
 * Peak-load performance audit (issue #37).
 *
 * Fills fixed pools to capacity, runs a measured burst of sim ticks, and
 * asserts: pools never grow (GC-safe), atlas batching key is singular, and
 * average sim-tick wall time fits {@link PERF.peakSimTickBudgetMs} so the
 * mobile ≥30fps / desktop 60fps frame budgets have headroom for render.
 */

import { performance } from 'node:perf_hooks';
import { ATLAS_KEY } from '../config/art';
import { BULLET, ENEMY_BULLET, HELI, HELI_SPAWN } from '../config/constants';
import { meetsPeakSimTickBudget, PERF } from '../config/perf';
import { particleBudgetCap } from '../config/particles';
import { SimSession } from '../core/simSession';
import { spawnHelicopter } from '../combat/helicopter';
import { buildKillFx } from '../fx/particleEvents';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';

/** Measured peak-load result — written into docs/PERF_REPORT.md. */
export type PeakLoadAuditResult = {
  measureTicks: number;
  totalMs: number;
  avgTickMs: number;
  maxTickMs: number;
  ticksPerSecond: number;
  meetsSimTickBudget: boolean;
  /** Implied render FPS headroom if one sim tick runs per mobile frame. */
  mobileFrameHeadroomMs: number;
  /** Implied render FPS headroom if 0.5 sim ticks run per desktop frame. */
  desktopFrameHeadroomMs: number;
  pools: {
    playerBulletCapacity: number;
    enemyBulletCapacity: number;
    playerBulletsActive: number;
    enemyBulletsActive: number;
    heliCount: number;
    heliMaxConcurrent: number;
    particleQueueCapacity: number;
    particleBudgetCap: number;
    capacitiesGrew: boolean;
  };
  atlas: {
    gameplayAtlasKey: string;
    expectedKey: string;
    batchesViaSingleAtlas: boolean;
  };
};

export type PeakLoadAuditOptions = {
  /** Override measure tick count (defaults to {@link PERF.peakLoadMeasureTicks}). */
  measureTicks?: number;
  /** Injected clock for tests (defaults to `performance.now`). */
  now?: () => number;
};

/**
 * Drive the session into a peak-load state: full bullet pools, max concurrent
 * helis, saturated particle FX queue. Mutates `session` in place.
 */
export function saturatePeakLoad(session: SimSession): void {
  refillBulletPools(session);

  // Cap helis at max concurrent (spawn treadmill soft cap).
  session.heliSpawn.kills =
    HELI_SPAWN.killsPerExtraHeli *
    (HELI_SPAWN.maxConcurrent - HELI_SPAWN.initialConcurrent);
  while (session.helicopters.length < HELI_SPAWN.maxConcurrent) {
    session.helicopters.push(
      spawnHelicopter(
        HELI.hp,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        session.spawnRng,
      ),
    );
  }

  // Saturate the fixed particle FX ring (drops oldest — never grows).
  const killFx = buildKillFx(150, 100);
  for (let i = 0; i < PERF.particleEventQueueCapacity + 16; i += 1) {
    session.particleFx.pushAll(killFx);
  }
}

/** Top up player/enemy bullet pools to capacity (no growth). */
export function refillBulletPools(session: SimSession): void {
  while (session.bullets.activeCount < session.bullets.capacity) {
    const got = session.bullets.acquire(
      100,
      100,
      0,
      BULLET.defaultSpeed,
      BULLET.defaultDamage,
    );
    if (!got) {
      break;
    }
  }

  while (session.enemyBullets.activeCount < session.enemyBullets.capacity) {
    const got = session.enemyBullets.acquire(
      200,
      80,
      90,
      ENEMY_BULLET.speed,
      ENEMY_BULLET.damage,
    );
    if (!got) {
      break;
    }
  }
}

/**
 * Run a peak-load audit: saturate pools, measure sim ticks, return a report
 * object suitable for logging and docs/PERF_REPORT.md.
 */
export function runPeakLoadAudit(
  options: PeakLoadAuditOptions = {},
): PeakLoadAuditResult {
  const measureTicks = options.measureTicks ?? PERF.peakLoadMeasureTicks;
  const now = options.now ?? (() => performance.now());

  const session = new SimSession();
  const playerCapBefore = session.bullets.capacity;
  const enemyCapBefore = session.enemyBullets.capacity;
  const particleCapBefore = session.particleFx.capacity;

  saturatePeakLoad(session);

  const playerCapAfterFill = session.bullets.capacity;
  const enemyCapAfterFill = session.enemyBullets.capacity;
  const particleCapAfterFill = session.particleFx.capacity;

  let maxTickMs = 0;
  const t0 = now();
  for (let i = 0; i < measureTicks; i += 1) {
    // Keep pools saturated every tick so the measurement stays at peak load
    // (bullets otherwise cull off-screen within a few frames).
    refillBulletPools(session);
    const a = now();
    // One sim tick via the public update path (≈33.3ms wall → 1 tick @30Hz).
    session.update(1000 / 30);
    session.drainParticleFx();
    session.drainAudioEvents();
    session.drainCameraFeelEvents();
    const b = now();
    const tickMs = b - a;
    if (tickMs > maxTickMs) {
      maxTickMs = tickMs;
    }
  }
  const t1 = now();
  const totalMs = t1 - t0;
  const avgTickMs = measureTicks > 0 ? totalMs / measureTicks : 0;

  // Snapshot occupancy at peak (refill after the last tick's culls).
  refillBulletPools(session);

  const playerCapAfter = session.bullets.capacity;
  const enemyCapAfter = session.enemyBullets.capacity;
  const particleCapAfter = session.particleFx.capacity;

  const capacitiesGrew =
    playerCapAfter !== playerCapBefore ||
    enemyCapAfter !== enemyCapBefore ||
    particleCapAfter !== particleCapBefore ||
    playerCapAfterFill !== playerCapBefore ||
    enemyCapAfterFill !== enemyCapBefore ||
    particleCapAfterFill !== particleCapBefore;

  const atlasKey = PERF.gameplayAtlasKey;
  const batchesViaSingleAtlas =
    atlasKey === ATLAS_KEY && atlasKey === 'game-atlas';

  return {
    measureTicks,
    totalMs,
    avgTickMs,
    maxTickMs,
    ticksPerSecond: avgTickMs > 0 ? 1000 / avgTickMs : 0,
    meetsSimTickBudget: meetsPeakSimTickBudget(avgTickMs),
    mobileFrameHeadroomMs: PERF.mobileFrameBudgetMs - avgTickMs,
    desktopFrameHeadroomMs: PERF.desktopFrameBudgetMs - avgTickMs * 0.5,
    pools: {
      playerBulletCapacity: playerCapAfter,
      enemyBulletCapacity: enemyCapAfter,
      playerBulletsActive: session.bullets.activeCount,
      enemyBulletsActive: session.enemyBullets.activeCount,
      heliCount: session.helicopters.filter((h) => h.active).length,
      heliMaxConcurrent: HELI_SPAWN.maxConcurrent,
      particleQueueCapacity: particleCapAfter,
      particleBudgetCap: particleBudgetCap(),
      capacitiesGrew,
    },
    atlas: {
      gameplayAtlasKey: atlasKey,
      expectedKey: ATLAS_KEY,
      batchesViaSingleAtlas,
    },
  };
}

/** Format the audit as a markdown section for the performance report. */
export function formatPeakLoadReportMarkdown(
  result: PeakLoadAuditResult,
): string {
  const pass = result.meetsSimTickBudget ? 'PASS' : 'FAIL';
  return [
    '## Peak-load measurement (automated)',
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Measure ticks | ${result.measureTicks} |`,
    `| Total wall time | ${result.totalMs.toFixed(3)} ms |`,
    `| Avg sim tick | ${result.avgTickMs.toFixed(4)} ms |`,
    `| Max sim tick | ${result.maxTickMs.toFixed(4)} ms |`,
    `| Tick budget | ≤ ${PERF.peakSimTickBudgetMs} ms |`,
    `| Sim tick budget | **${pass}** |`,
    `| Mobile frame budget | ${PERF.mobileFrameBudgetMs.toFixed(3)} ms (≥${PERF.mobileTargetFps}fps) |`,
    `| Mobile headroom (1 tick/frame) | ${result.mobileFrameHeadroomMs.toFixed(3)} ms |`,
    `| Desktop frame budget | ${PERF.desktopFrameBudgetMs.toFixed(3)} ms (${PERF.desktopTargetFps}fps) |`,
    `| Desktop headroom (0.5 tick/frame) | ${result.desktopFrameHeadroomMs.toFixed(3)} ms |`,
    `| Player bullet pool | ${result.pools.playerBulletsActive}/${result.pools.playerBulletCapacity} (grew: ${result.pools.capacitiesGrew}) |`,
    `| Enemy bullet pool | ${result.pools.enemyBulletsActive}/${result.pools.enemyBulletCapacity} |`,
    `| Helis active / max | ${result.pools.heliCount}/${result.pools.heliMaxConcurrent} |`,
    `| Particle queue cap | ${result.pools.particleQueueCapacity} |`,
    `| Particle emitter budget | ${result.pools.particleBudgetCap} |`,
    `| Gameplay atlas | \`${result.atlas.gameplayAtlasKey}\` (batched: ${result.atlas.batchesViaSingleAtlas}) |`,
    '',
  ].join('\n');
}
