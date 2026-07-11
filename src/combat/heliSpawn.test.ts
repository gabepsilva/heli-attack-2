/**
 * Replacement spawn treadmill & difficulty ramp — issues #19 / #109.
 *
 * AC (#109): Living combat heli count never exceeds 1
 * AC (#109): Kill / despawn immediately spawns a 1:1 replacement
 * AC (#19): Score-based level++ / fire-rate hardening (nextLevel doubling)
 *
 * Spec values: Flash `addEnemy(300)` on kill, `nextLevel = 10000` doubling,
 * fire `Math.max(10,16-level)`, aim `Math.max(1,10-level)`, edge/top spawns.
 * Concurrent population is fixed at 1 — every-3-kills only gates crates (#91).
 */

import { describe, expect, it } from 'vitest';
import {
  HELI,
  HELI_SPAWN,
  HEAVY_PROJECTILE,
  POWERUP_DROP,
  WEAPONS,
} from '../config/constants';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import {
  createHelicopter,
  createSpawnRng,
  damageHelicopter,
} from './helicopter';
import { createCombatSession } from '../core/simSessionFixture';
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
import {
  createPowerupDropState,
  trySpawnDropOnKill,
  type PowerupPickup,
} from './powerupDrop';

describe('heli spawn treadmill (issue #19 / #109)', () => {
  it('locks HELI_SPAWN and Flash difficulty thresholds to exact spec values', () => {
    expect(HELI_SPAWN).toEqual({
      initialConcurrent: 1,
      maxConcurrent: 1,
      firstLevelScore: 10000,
    });
    expect(HELI_SPAWN).not.toHaveProperty('killsPerExtraHeli');
    expect(HELI.hp).toBe(300);
    expect(HELI.fireIntervalFrames).toBe(16);
    expect(HELI.fireIntervalMin).toBe(10);
    expect(HELI.gunTurnDivisor).toBe(10);
    expect(HELI.gunTurnDivisorMin).toBe(1);
  });

  it('targetConcurrent stays at 1 regardless of kill count (AC #109)', () => {
    expect(targetConcurrent(0)).toBe(1);
    expect(targetConcurrent(2)).toBe(1);
    expect(targetConcurrent(3)).toBe(1);
    expect(targetConcurrent(15)).toBe(1);
    expect(targetConcurrent(99)).toBe(HELI_SPAWN.maxConcurrent);
    expect(HELI_SPAWN.maxConcurrent).toBe(1);
    expect(HELI_SPAWN.initialConcurrent).toBe(1);
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

  it('replacement spawn keeps population exactly 1 after a kill (AC #109)', () => {
    const rng = createSpawnRng(7);
    const state = createHeliSpawnState();
    const helis = [createHelicopter(400, 200, HELI.hp, rng)];
    expect(activeHeliCount(helis)).toBe(1);

    damageHelicopter(helis[0]!, HELI.hp);
    expect(helis[0]!.active).toBe(false);

    onHeliKilled(helis, state, 0, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(state.kills).toBe(1);
    expect(activeHeliCount(helis)).toBe(1);
    expect(activeHeliCount(helis)).toBe(targetConcurrent(1));
  });

  it('living combat heli count never exceeds 1 across a long kill run (AC #109)', () => {
    const rng = createSpawnRng(19);
    const state = createHeliSpawnState();
    const helis = [] as ReturnType<typeof createHelicopter>[];
    ensureHeliPopulation(helis, state, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(activeHeliCount(helis)).toBe(1);

    const counts: number[] = [];
    for (let k = 0; k < 15; k += 1) {
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
      const living = activeHeliCount(helis);
      expect(living).toBe(1);
      counts.push(living);
    }

    expect(state.kills).toBe(15);
    expect(counts.every((n) => n === 1)).toBe(true);
    expect(Math.max(...counts)).toBe(1);
  });

  it('spawns replacements from screen edges or top', () => {
    const rng = createSpawnRng(42);
    const state = createHeliSpawnState();
    state.kills = 3;
    const helis = [] as ReturnType<typeof createHelicopter>[];
    ensureHeliPopulation(helis, state, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, rng);
    expect(helis).toHaveLength(1);
    for (const heli of helis) {
      const offLeft = heli.x < 0 || heli.x > LEVEL1_WIDTH_PX;
      const offTop = heli.y < 0;
      expect(offLeft || offTop).toBe(true);
      expect(heli.health).toBe(300);
    }
  });

  it('SimSession never leaves the sky empty after a kill mid-game', () => {
    const session = createCombatSession();
    expect(session.helicopters).toHaveLength(1);
    expect(session.heliSpawn.kills).toBe(0);

    const heli = session.helicopters[0]!;
    heli.x = 900;
    heli.y = 220;
    heli.xspeed = 0;
    heli.yspeed = 0;
    heli.tx = heli.x;
    heli.ty = heli.y;
    heli.onScreen = 10_000;
    heli.repositioning = false;

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
      heli.onScreen = 10_000;
      heli.repositioning = false;
      session.update(1000 / 30);
      // Mid-game: living count stays exactly 1 (never empty, never multi).
      expect(activeHeliCount(session.helicopters)).toBe(1);
    }

    expect(heli.active).toBe(false);
    expect(session.heliSpawn.kills).toBe(1);
    expect(session.score.value).toBe(HELI.hp);
    expect(activeHeliCount(session.helicopters)).toBe(1);
    expect(WEAPONS[0].damage).toBe(10);
  });

  it('SimSession stays at 1 concurrent after many kills (AC #109)', () => {
    const session = createCombatSession();
    const rng = session.spawnRng;

    for (let k = 0; k < 9; k += 1) {
      const victim = session.helicopters.find((h) => h.active)!;
      damageHelicopter(victim, HELI.hp);
      recordHeliKill(session.heliSpawn, session.score.value + HELI.hp);
      session.score.value += HELI.hp;
      ensureHeliPopulation(
        session.helicopters,
        session.heliSpawn,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        rng,
      );
      expect(activeHeliCount(session.helicopters)).toBe(1);
    }

    expect(session.heliSpawn.kills).toBe(9);
    expect(activeHeliCount(session.helicopters)).toBe(1);
    expect(targetConcurrent(session.heliSpawn.kills)).toBe(1);
  });

  it('every-3-kills still drops a crate without growing heli count (AC #91/#109)', () => {
    expect(POWERUP_DROP.killsPerCrate).toBe(3);
    const dropState = createPowerupDropState();
    const pickups: PowerupPickup[] = [];
    const rng = createSpawnRng(91);

    // Simulate three kills: only kill 3 attaches a crate; heli target stays 1.
    for (let kills = 1; kills <= 3; kills += 1) {
      trySpawnDropOnKill(kills, dropState, pickups, 400, 200, rng);
      expect(targetConcurrent(kills)).toBe(1);
    }

    expect(pickups).toHaveLength(1);
    expect(pickups[0]!.active).toBe(true);
    expect(pickups[0]!.kind).not.toBe('health');
  });

  it('deferred refill does not skip multi-heli A-Bomb victims (Lead #71)', () => {
    // Regression: splicing helis inside onHit skipped survivors in the same
    // blast. recordHeliKill is state-only; ensureHeliPopulation runs after.
    // Artificial multi-heli setup — normal play never exceeds maxConcurrent.
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
    expect(activeHeliCount(helis)).toBe(1);
    expect(targetConcurrent(3)).toBe(1);
  });
});
