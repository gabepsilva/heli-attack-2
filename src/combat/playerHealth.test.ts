/**
 * Player health / i-frames — issue #18 acceptance criteria.
 *
 * AC: Player takes damage from heli bullets (10 dmg, max 100)
 * AC: I-frames prevent instant death
 */

import { describe, expect, it } from 'vitest';
import {
  ENEMY_BULLET,
  PLAYER_COMBAT,
  PLAYER_DEFAULTS,
} from '../config/constants';
import {
  createPlayerHealth,
  damagePlayer,
  formatHealthHud,
  isPlayerDead,
  isPlayerHurtFlashing,
  isPlayerInvulnerable,
  playerCombatMaxHealthMatchesSpec,
  playerHealthFraction,
  stepPlayerIFrames,
  syncPlayerLastHealth,
} from './playerHealth';

describe('playerHealth (issue #18)', () => {
  it('seeds max health 100 matching PLAYER / PLAYER_COMBAT spec', () => {
    expect(PLAYER_COMBAT.maxHealth).toBe(100);
    expect(PLAYER_DEFAULTS.health).toBe(100);
    expect(ENEMY_BULLET.damage).toBe(10);
    expect(PLAYER_COMBAT.iFrameFrames).toBe(10);
    expect(playerCombatMaxHealthMatchesSpec()).toBe(true);

    const state = createPlayerHealth();
    expect(state.health).toBe(100);
    expect(state.maxHealth).toBe(100);
    expect(state.alive).toBe(true);
    expect(state.iFramesRemaining).toBe(0);
  });

  it('applies exact enemy-bullet damage of 10 and reaches death at 0', () => {
    const state = createPlayerHealth();
    // Bypass i-frames between hits by clearing them after each apply.
    for (let i = 0; i < 9; i += 1) {
      const result = damagePlayer(state, ENEMY_BULLET.damage, 0);
      expect(result.applied).toBe(10);
      expect(result.killed).toBe(false);
      expect(state.health).toBe(100 - (i + 1) * 10);
      expect(state.alive).toBe(true);
    }
    const last = damagePlayer(state, ENEMY_BULLET.damage, 0);
    expect(last.applied).toBe(10);
    expect(last.killed).toBe(true);
    expect(state.health).toBe(0);
    expect(state.alive).toBe(false);
    expect(isPlayerDead(state)).toBe(true);
  });

  it('i-frames block stacked hits so one volley cannot instantly kill', () => {
    const state = createPlayerHealth();
    // Ten overlapping hits in one frame — without i-frames this is 100 dmg.
    let totalApplied = 0;
    let kills = 0;
    for (let i = 0; i < 10; i += 1) {
      const result = damagePlayer(state, ENEMY_BULLET.damage);
      totalApplied += result.applied;
      if (result.killed) {
        kills += 1;
      }
    }
    expect(totalApplied).toBe(10);
    expect(kills).toBe(0);
    expect(state.health).toBe(90);
    expect(state.alive).toBe(true);
    expect(isPlayerInvulnerable(state)).toBe(true);
    expect(state.iFramesRemaining).toBe(PLAYER_COMBAT.iFrameFrames);
  });

  it('i-frames expire after exactly PLAYER_COMBAT.iFrameFrames ticks', () => {
    const state = createPlayerHealth();
    damagePlayer(state, ENEMY_BULLET.damage);
    expect(state.iFramesRemaining).toBe(10);

    for (let i = 0; i < 9; i += 1) {
      stepPlayerIFrames(state, 1);
      expect(isPlayerInvulnerable(state)).toBe(true);
    }
    stepPlayerIFrames(state, 1);
    expect(state.iFramesRemaining).toBe(0);
    expect(isPlayerInvulnerable(state)).toBe(false);

    const second = damagePlayer(state, ENEMY_BULLET.damage);
    expect(second.applied).toBe(10);
    expect(state.health).toBe(80);
  });

  it('tracks hurt flash via lastHealth and formats HUD / death', () => {
    const state = createPlayerHealth();
    expect(formatHealthHud(state)).toBe('Health: 100/100');
    expect(playerHealthFraction(state)).toBe(1);

    damagePlayer(state, ENEMY_BULLET.damage, 0);
    expect(isPlayerHurtFlashing(state)).toBe(true);
    syncPlayerLastHealth(state);
    expect(isPlayerHurtFlashing(state)).toBe(false);
    expect(formatHealthHud(state)).toBe('Health: 90/100');
    expect(playerHealthFraction(state)).toBeCloseTo(0.9);

    state.health = 0;
    state.alive = false;
    expect(formatHealthHud(state)).toBe('Health: DEAD');
    expect(playerHealthFraction(state)).toBe(0);
  });
});
