/**
 * Replacement spawn treadmill & difficulty ramp (#19).
 *
 * Flash model:
 * - On heli death: `addEnemy(300)` → immediate replacement (sky never empty).
 * - `if (score > nextLevel) { nextLevel *= 2; level++; }` — fire/aim harden.
 *
 * Port addition (ticket AC): target concurrent grows with kill count so
 * pressure escalates the longer you survive, not only via fire rate.
 */

import { HELI, HELI_SPAWN } from '../config/constants';
import { spawnHelicopter, type Helicopter, type SpawnRng } from './helicopter';

export type HeliSpawnState = {
  /** Total helis destroyed this run (Flash `rthelis`). */
  kills: number;
  /** Flash `level` — drives fire cadence / gun turn. */
  level: number;
  /** Flash `nextLevel` — score threshold for the next level-up. */
  nextLevelScore: number;
};

export function createHeliSpawnState(): HeliSpawnState {
  return {
    kills: 0,
    level: 0,
    nextLevelScore: HELI_SPAWN.firstLevelScore,
  };
}

/**
 * Target on-screen population for the current kill count.
 * `1 + floor(kills / killsPerExtraHeli)`, capped at {@link HELI_SPAWN.maxConcurrent}.
 */
export function targetConcurrent(
  kills: number,
  cfg: typeof HELI_SPAWN = HELI_SPAWN,
): number {
  const extra = Math.floor(Math.max(0, kills) / cfg.killsPerExtraHeli);
  return Math.min(cfg.maxConcurrent, cfg.initialConcurrent + extra);
}

/** Active (living) heli count. */
export function activeHeliCount(helis: readonly Helicopter[]): number {
  let n = 0;
  for (let i = 0; i < helis.length; i += 1) {
    if (helis[i]!.active) {
      n += 1;
    }
  }
  return n;
}

/**
 * Flash fire interval: `Math.max(10, 16 - level)`.
 * Level 0 → 16; level 6+ → 10 (floor).
 */
export function heliFireInterval(
  level: number,
  base: number = HELI.fireIntervalFrames,
  min: number = HELI.fireIntervalMin,
): number {
  return Math.max(min, base - Math.max(0, level));
}

/**
 * Flash gun turn divisor: `Math.max(1, 10 - level)`.
 * Level 0 → 10; level 9+ → 1 (snappiest aim).
 */
export function heliGunTurnDivisor(
  level: number,
  base: number = HELI.gunTurnDivisor,
  min: number = HELI.gunTurnDivisorMin,
): number {
  return Math.max(min, base - Math.max(0, level));
}

/**
 * Flash score level-up: while `score > nextLevel`, double the threshold and
 * increment level. Returns how many levels were gained this call.
 */
export function stepDifficultyFromScore(
  state: HeliSpawnState,
  score: number,
): number {
  let gained = 0;
  while (score > state.nextLevelScore) {
    state.nextLevelScore *= 2;
    state.level += 1;
    gained += 1;
  }
  return gained;
}

/**
 * Drop inactive helis from the array (dead hulls are tracked via explosions).
 * Mutates `helis` in place; returns the number removed.
 */
export function pruneInactiveHelis(helis: Helicopter[]): number {
  let removed = 0;
  for (let i = helis.length - 1; i >= 0; i -= 1) {
    if (!helis[i]!.active) {
      helis.splice(i, 1);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Ensure living population matches {@link targetConcurrent} for `state.kills`.
 * Spawns from edges/top via {@link spawnHelicopter}. Returns how many were added.
 */
export function ensureHeliPopulation(
  helis: Helicopter[],
  state: HeliSpawnState,
  arenaW: number,
  arenaH: number,
  rng: SpawnRng,
  health: number = HELI.hp,
): number {
  const target = targetConcurrent(state.kills);
  pruneInactiveHelis(helis);
  let added = 0;
  while (helis.length < target) {
    helis.push(spawnHelicopter(health, arenaW, arenaH, rng));
    added += 1;
  }
  return added;
}

/**
 * Record a kill (Flash `rthelis++`), bump difficulty from score, then refill
 * the sky to the new target concurrent. Always leaves ≥1 living heli mid-game
 * once the run has started (target is at least {@link HELI_SPAWN.initialConcurrent}).
 */
export function onHeliKilled(
  helis: Helicopter[],
  state: HeliSpawnState,
  score: number,
  arenaW: number,
  arenaH: number,
  rng: SpawnRng,
): { added: number; levelsGained: number } {
  state.kills += 1;
  const levelsGained = stepDifficultyFromScore(state, score);
  const added = ensureHeliPopulation(helis, state, arenaW, arenaH, rng);
  return { added, levelsGained };
}
