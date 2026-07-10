/**
 * Player health, i-frames, and death — issue #18.
 *
 * Flash: `player.health = 100`; enemy hits do `player.health -= 10` when
 * `powerupon != 2`. The ticket adds brief invulnerability frames so stacked
 * same-volley hits cannot instantly drain 100 HP.
 */

import {
  HEALTH_PICKUP,
  PLAYER_COMBAT,
  PLAYER_DEFAULTS,
} from '../config/constants';

export type PlayerHealthState = {
  health: number;
  maxHealth: number;
  /** Sim frames of post-hit invulnerability remaining. */
  iFramesRemaining: number;
  /** False once health reaches ≤ 0. */
  alive: boolean;
  /**
   * Prior-frame health for hurt-flash detection (Flash `lasthealth`).
   * Synced at the end of each combat step.
   */
  lastHealth: number;
};

export type PlayerDamageResult = {
  /** Damage actually applied (0 when blocked by i-frames / death). */
  applied: number;
  /** True when this hit reduced health to ≤ 0. */
  killed: boolean;
};

export function createPlayerHealth(
  maxHealth: number = PLAYER_COMBAT.maxHealth,
): PlayerHealthState {
  return {
    health: maxHealth,
    maxHealth,
    iFramesRemaining: 0,
    alive: true,
    lastHealth: maxHealth,
  };
}

/** True while post-hit i-frames (or death) block further damage. */
export function isPlayerInvulnerable(state: PlayerHealthState): boolean {
  return !state.alive || state.iFramesRemaining > 0;
}

export function isPlayerDead(state: PlayerHealthState): boolean {
  return !state.alive || state.health <= 0;
}

/** True for one combat step after a hit (Flash `lasthealth > health` flash). */
export function isPlayerHurtFlashing(state: PlayerHealthState): boolean {
  return state.lastHealth > state.health;
}

/**
 * Tick down i-frames. Call once per sim tick before resolving enemy hits.
 */
export function stepPlayerIFrames(
  state: PlayerHealthState,
  timeStep: number,
): void {
  if (state.iFramesRemaining <= 0) {
    return;
  }
  state.iFramesRemaining = Math.max(0, state.iFramesRemaining - timeStep);
}

/**
 * Apply enemy (or other) damage. Blocked while invulnerable / dead.
 * On a successful hit, starts {@link PLAYER_COMBAT.iFrameFrames} of i-frames.
 */
export function damagePlayer(
  state: PlayerHealthState,
  amount: number,
  iFrameFrames: number = PLAYER_COMBAT.iFrameFrames,
): PlayerDamageResult {
  if (amount <= 0 || isPlayerInvulnerable(state)) {
    return { applied: 0, killed: false };
  }
  state.health -= amount;
  state.iFramesRemaining = iFrameFrames;
  if (state.health <= 0) {
    state.health = 0;
    state.alive = false;
    return { applied: amount, killed: true };
  }
  return { applied: amount, killed: false };
}

/** Sync `lastHealth` after combat resolution (Flash end-of-heroAction). */
export function syncPlayerLastHealth(state: PlayerHealthState): void {
  state.lastHealth = state.health;
}

/**
 * Instant health pickup (Flash `health = Math.min(100, health += 20)`).
 * Returns the amount actually healed (0 when dead / already at cap).
 */
export function healPlayer(
  state: PlayerHealthState,
  amount: number = HEALTH_PICKUP.amount,
  cap: number = HEALTH_PICKUP.cap,
): number {
  if (!state.alive || amount <= 0) {
    return 0;
  }
  const before = state.health;
  state.health = Math.min(cap, state.health + amount);
  return state.health - before;
}

/** Health fraction in [0, 1] for HUD mask scale (Flash `health/100`). */
export function playerHealthFraction(state: PlayerHealthState): number {
  if (state.maxHealth <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, state.health / state.maxHealth));
}

/** Temporary HUD string until #23 owns the real health bar. */
export function formatHealthHud(state: PlayerHealthState): string {
  if (!state.alive) {
    return 'Health: DEAD';
  }
  return `Health: ${Math.max(0, Math.floor(state.health))}/${state.maxHealth}`;
}

/** Spec seed sanity — max health matches PLAYER defaults. */
export function playerCombatMaxHealthMatchesSpec(): boolean {
  return (
    PLAYER_COMBAT.maxHealth === PLAYER_DEFAULTS.health &&
    PLAYER_COMBAT.maxHealth === 100
  );
}
