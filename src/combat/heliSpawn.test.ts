/**
 * Replacement spawn treadmill & difficulty ramp — issue #19 acceptance criteria.
 *
 * AC: Heli population never hits zero mid-game
 * AC: Concurrent count measurably grows with kills
 *
 * Spec values: Flash `addEnemy(300)` on kill, `nextLevel = 10000` doubling,
 * fire `Math.max(10,16-level)`, aim `Math.max(1,10-level)`, edge/top spawns.
 */

import { describe, expect, it } from 'vitest';
import {
  HELI,
  HELI_SPAWN,
  HEAVY_PROJECTILE,
  WEAPONS,
} from '../config/constants';
import { SimSession } from '../core/simSession';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import {
  createHelicopter,
  createSpawnRng,
  damageHelicopter,
} from './helicopter';
import {
  activeHeliCount,
  createHeliSpawnState,
  ensureHeliPopulation,
  heliFireInterval,
  heliGunTurnDivisor,
  onHeliKilled,
  recordHeliKill,
  stepDifficultyFromScore,
  targetConcurrent,
} from './heliSpawn';
import { applyAbombBlastDamage } from './specialProjectile';

describe('heli spawn treadmill (issue #19)', () => {
  it('locks HELI_SPAWN and Flash difficulty thresholds to exact spec values', () => {
    expect(HELI_SPAWN.initialConcurrent).toBe(1);
    expect(HELI_SPAWN.killsPerExtraHeli).toBe(3);
    expect(HELI_SPAWN.maxConcurrent).toBe(6);
    expect(HELI_SPAWN.firstLevelScore).toBe(10000);
    expect(HELI.hp).toBe(300);
    expect(HELI.fireIntervalFrames).toBe(16);
    expect(HELI.fireIntervalMin).toBe(10);
    expect(HELI.gunTurnDivisor).toBe(10);
    expect(HELI.gunTurnDivisorMin).toBe(1);
  });

  it('targetConcurrent grows with kills and caps at maxConcurrent', () => {
    expect(targetConcurrent(0)).toBe(1);
    expect(targetConcurrent(2)).toBe(1);
    expect(targetConcurrent(3)).toBe(2);
    expect(targetConcurrent(5)).toBe(2);
    expect(targetConcurrent(6)).toBe(3);
    expect(targetConcurrent(9)).toBe(4);
    expect(targetConcurrent(12)).toBe(5);
    expect(targetConcurrent(15)).toBe(6);
    expect(targetConcurrent(99)).toBe(HELI_SPAWN.maxConcurrent);
  });

  it('Flash fire interval is Math.max(10, 16-level)', () => {
    expect(heliFireInterval(0)).toBe(16);
    expect(heliFireInterval(1)).toBe(15);
    expect(heliFireInterval(6)).toBe(10);
    expect(heliFireInterval(20)).toBe(10);
  });

  it('Flash gun turn divisor is Math.max(1, 10-level)', () => {
    expect(heliGunTurnDivisor(0)).toBe(10);
    expect(heliGunTurnDivisor(5)).toBe(5);
    expect(heliGunTurnDivisor(9)).toBe(1);
    expect(heliGunTurnDivisor(99)).toBe(1);
  });

  it('score level-up doubles nextLevel from 10000 (Flash nextLevel)', () => {
    const state = createHeliSpawnState();
    expect(state.level).toBe(0);
    expect(state.nextLevelScore).toBe(10000);

    expect(stepDifficultyFromScore(state, 10000)).toBe(0); // score > next, not >=
    expect(state.level).toBe(0);

    expect(stepDifficultyFromScore(state, 10001)).toBe(1);
    expect(state.level).toBe(1);
    expect(state.nextLevelScore).toBe(20000);

    expect(stepDifficultyFromScore(state, 40001)).toBe(2);
    expect(state.level).toBe(3);
    expect(state.nextLevelScore).toBe(80000);
  });

  it('replacement spawn keeps population ≥1 after a kill (AC: never empty)', () => {
    const rng = createSpawnRng(7);
    const state = createHeliSpawnState();
    const helis = [createHelicopter(400, 200, HELI.hp, rng)];
    expect(activeHeliCount(helis)).toBe(1);

    damageHelicopter(helis[0]!, HELI.hp);
    expect(helis[0]!.active).toBe(false);

    onHeliKilled(helis, state, 0, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(state.kills).toBe(1);
    expect(activeHeliCount(helis)).toBeGreaterThanOrEqual(1);
    expect(activeHeliCount(helis)).toBe(targetConcurrent(1));
  });

  it('concurrent count measurably grows with kills (AC)', () => {
    const rng = createSpawnRng(19);
    const state = createHeliSpawnState();
    const helis = [] as ReturnType<typeof createHelicopter>[];
    ensureHeliPopulation(helis, state, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(activeHeliCount(helis)).toBe(1);

    const counts: number[] = [];
    for (let k = 0; k < 15; k += 1) {
      // Instant-kill one living heli, then refill via treadmill.
      const victim = helis.find((h) => h.active);
      expect(victim).toBeDefined();
      damageHelicopter(victim!, HELI.hp);
      onHeliKilled(
        helis,
        state,
        k * HELI.hp,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        rng,
      );
      counts.push(activeHeliCount(helis));
    }

    expect(state.kills).toBe(15);
    expect(counts[0]).toBe(1); // after 1 kill still target 1
    expect(counts[2]).toBe(2); // after 3 kills → 2 concurrent
    expect(counts[5]).toBe(3); // after 6 kills → 3
    expect(counts[14]).toBe(6); // after 15 kills → capped at 6
    // Strictly non-decreasing target over the run.
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    }
    expect(counts[14]!).toBeGreaterThan(counts[0]!);
  });

  it('spawns replacements from screen edges or top', () => {
    const rng = createSpawnRng(42);
    const state = createHeliSpawnState();
    state.kills = 3; // target 2
    const helis = [] as ReturnType<typeof createHelicopter>[];
    ensureHeliPopulation(helis, state, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(helis).toHaveLength(2);
    for (const heli of helis) {
      const offLeft = heli.x < 0 || heli.x > LEVEL1_WIDTH_PX;
      const offTop = heli.y < 0;
      expect(offLeft || offTop).toBe(true);
      expect(heli.health).toBe(300);
    }
  });

  it('SimSession never leaves the sky empty after a kill mid-game', () => {
    const session = new SimSession();
    expect(session.helicopters).toHaveLength(1);
    expect(session.heliSpawn.kills).toBe(0);

    const heli = session.helicopters[0]!;
    heli.x = 900;
    heli.y = 220;
    heli.xspeed = 0;
    heli.yspeed = 0;
    heli.tx = heli.x;
    heli.ty = heli.y;

    const hit = {
      x: heli.x - HELI.spriteW / 2 + 22,
      y: heli.y - HELI.spriteH / 2 + 2,
    };
    session.player.placeAt(hit.x - 80, hit.y);
    session.player.mouse = { x: hit.x, y: hit.y };
    session.fireHeld = true;

    for (let tick = 0; tick < 30 * 20 && heli.active; tick += 1) {
      heli.xspeed = 0;
      heli.yspeed = 0;
      heli.tx = heli.x;
      heli.ty = heli.y;
      session.update(1000 / 30);
      // Mid-game: after the opening spawn, living count must stay ≥ 1.
      expect(activeHeliCount(session.helicopters)).toBeGreaterThanOrEqual(1);
    }

    expect(heli.active).toBe(false);
    expect(session.heliSpawn.kills).toBe(1);
    expect(session.score.value).toBe(HELI.hp);
    expect(activeHeliCount(session.helicopters)).toBe(1);
    expect(WEAPONS[0].damage).toBe(10);
  });

  it('SimSession concurrent grows after every killsPerExtraHeli kills', () => {
    const session = new SimSession();
    const rng = session.spawnRng;

    for (let k = 0; k < HELI_SPAWN.killsPerExtraHeli; k += 1) {
      const victim = session.helicopters.find((h) => h.active)!;
      damageHelicopter(victim, HELI.hp);
      // Match SimSession: record during "hit", refill after the loop.
      recordHeliKill(session.heliSpawn, session.score.value + HELI.hp);
      session.score.value += HELI.hp;
      ensureHeliPopulation(
        session.helicopters,
        session.heliSpawn,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        rng,
      );
    }

    expect(session.heliSpawn.kills).toBe(3);
    expect(activeHeliCount(session.helicopters)).toBe(2);
    expect(targetConcurrent(session.heliSpawn.kills)).toBe(2);
  });

  it('deferred refill does not skip multi-heli A-Bomb victims (Lead #71)', () => {
    // Regression: splicing helis inside onHit skipped survivors in the same
    // blast. recordHeliKill is state-only; ensureHeliPopulation runs after.
    const helis = [
      createHelicopter(100, 100, HELI.hp),
      createHelicopter(150, 100, HELI.hp),
      createHelicopter(200, 100, HELI.hp),
    ];
    expect(HEAVY_PROJECTILE.abombBlastRadius).toBe(300);
    const state = createHeliSpawnState();
    const rng = createSpawnRng(71);
    let killEvents = 0;

    const hits = applyAbombBlastDamage(
      100,
      100,
      WEAPONS[10].damage,
      helis,
      (event) => {
        if (event.killed) {
          killEvents += 1;
          recordHeliKill(state, killEvents * HELI.hp);
        }
      },
    );

    expect(WEAPONS[10].damage).toBe(HELI.hp);
    expect(hits).toBe(3);
    expect(killEvents).toBe(3);
    expect(helis.every((h) => !h.active)).toBe(true);
    expect(state.kills).toBe(3);
    // Array still holds the three dead hulls — no mid-loop splice.
    expect(helis).toHaveLength(3);

    ensureHeliPopulation(helis, state, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(activeHeliCount(helis)).toBe(targetConcurrent(3));
    expect(targetConcurrent(3)).toBe(2);
  });
});
