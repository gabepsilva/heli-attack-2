/**
 * Issue #37 acceptance: under peak load, fixed pools never grow (GC-safe),
 * gameplay draws batch via a single atlas, and measured sim-tick time fits
 * the mobile frame budget headroom (≥30fps / 60fps targets).
 */

import { describe, expect, it } from 'vitest';
import { ATLAS_KEY } from '../config/art';
import { BULLET, ENEMY_BULLET, HELI_SPAWN } from '../config/constants';
import { PERF } from '../config/perf';
import { particleBudgetCap } from '../config/particles';
import { SimSession } from '../core/simSession';
import {
  formatPeakLoadReportMarkdown,
  runPeakLoadAudit,
  saturatePeakLoad,
} from './peakLoadAudit';

describe('tooling/peakLoadAudit (#37)', () => {
  it('saturates pools to capacity without growing them (GC / pooling audit)', () => {
    const session = new SimSession();
    expect(session.bullets.capacity).toBe(BULLET.poolCapacity);
    expect(session.enemyBullets.capacity).toBe(ENEMY_BULLET.poolCapacity);
    expect(session.particleFx.capacity).toBe(PERF.particleEventQueueCapacity);

    saturatePeakLoad(session);

    expect(session.bullets.capacity).toBe(64);
    expect(session.enemyBullets.capacity).toBe(64);
    expect(session.particleFx.capacity).toBe(128);
    expect(session.bullets.activeCount).toBe(64);
    expect(session.enemyBullets.activeCount).toBe(64);
    expect(session.helicopters.length).toBe(HELI_SPAWN.maxConcurrent);
    expect(session.helicopters.length).toBe(6);
    expect(session.particleFx.length).toBe(128);
    expect(session.particleFx.dropped).toBeGreaterThan(0);
    // Acquire past capacity must fail — pool never grows.
    expect(session.bullets.acquire(0, 0, 0)).toBeNull();
    expect(session.enemyBullets.acquire(0, 0, 0)).toBeNull();
  });

  it('measures peak-load sim ticks within the locked budget (AC: frame targets)', () => {
    const result = runPeakLoadAudit({
      // Fewer ticks keep the unit test fast; budget assertion still applies.
      measureTicks: 90,
    });

    expect(result.measureTicks).toBe(90);
    expect(result.pools.playerBulletCapacity).toBe(
      PERF.playerBulletPoolCapacity,
    );
    expect(result.pools.enemyBulletCapacity).toBe(PERF.enemyBulletPoolCapacity);
    expect(result.pools.particleQueueCapacity).toBe(
      PERF.particleEventQueueCapacity,
    );
    expect(result.pools.particleBudgetCap).toBe(particleBudgetCap());
    expect(result.pools.particleBudgetCap).toBe(432);
    expect(result.pools.heliMaxConcurrent).toBe(6);
    expect(result.pools.capacitiesGrew).toBe(false);
    // Still at peak occupancy after the measured burst (refill each tick).
    expect(result.pools.playerBulletsActive).toBe(
      PERF.playerBulletPoolCapacity,
    );
    expect(result.pools.enemyBulletsActive).toBe(PERF.enemyBulletPoolCapacity);
    expect(result.pools.heliCount).toBe(PERF.heliMaxConcurrent);

    expect(result.atlas.gameplayAtlasKey).toBe(ATLAS_KEY);
    expect(result.atlas.gameplayAtlasKey).toBe('game-atlas');
    expect(result.atlas.batchesViaSingleAtlas).toBe(true);

    // Acceptance: measured avg tick fits the peak-load budget → mobile/desktop
    // frame budgets have headroom under peak load.
    expect(result.avgTickMs).toBeLessThanOrEqual(PERF.peakSimTickBudgetMs);
    expect(result.meetsSimTickBudget).toBe(true);
    expect(result.mobileFrameHeadroomMs).toBeGreaterThan(0);
    expect(result.desktopFrameHeadroomMs).toBeGreaterThan(0);

    // Logged report includes the exact budget numbers.
    const md = formatPeakLoadReportMarkdown(result);
    expect(md).toContain('## Peak-load measurement (automated)');
    expect(md).toContain(`≤ ${PERF.peakSimTickBudgetMs} ms`);
    expect(md).toContain('**PASS**');
    expect(md).toContain('game-atlas');
  });

  it('uses a deterministic clock when injected (report math)', () => {
    let t = 0;
    const result = runPeakLoadAudit({
      measureTicks: 10,
      now: () => {
        // Each now() call advances 0.5ms → update uses 2 samples → 1ms/tick.
        t += 0.5;
        return t;
      },
    });
    // 10 ticks × (start + end around loop) — totalMs is t1-t0 across the loop.
    expect(result.measureTicks).toBe(10);
    expect(result.avgTickMs).toBeGreaterThan(0);
    expect(result.meetsSimTickBudget).toBe(true);
  });
});
