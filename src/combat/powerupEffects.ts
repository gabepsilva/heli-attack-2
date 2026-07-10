/**
 * Timed state powerup effects — issue #22.
 *
 * Five `powerupOn` values (1..5) last {@link POWERUP_FRAMES} sim frames, then
 * clear. Health pickup is instant (#21) and is not handled here.
 *
 * | id | Effect |
 * |---:|---|
 * | 1 | TriDamage — weapon damage ×3 |
 * | 2 | Invulnerability — player takes no damage |
 * | 3 | PredatorMode — invisible, predator gun, no switch, random enemy aim |
 * | 4 | TimeRift — world slow-mo; player steps at timeStep 1 |
 * | 5 | Jetpack — hold jump → yspeed = max(yspeed−2, −32) |
 */

import {
  POWERUP,
  POWERUP_EFFECTS,
  POWERUP_FRAMES,
} from '../config/constants';
import { PREDATOR_WEAPON_INDEX } from '../config/weapons';
import type { PlayerPowerupState } from './powerupDrop';
import type { WeaponInventory } from './weaponInventory';

export type PowerupStepResult = {
  /** Id that just expired (0 if still active / none). */
  expired: number;
};

/** True while a timed state powerup is active. */
export function hasActivePowerup(state: Readonly<PlayerPowerupState>): boolean {
  return state.powerupOn !== 0 && state.powerupTime > 0;
}

/** HUD meter fraction in [0, 1] (Flash `powerupTime / powerupTime`). */
export function powerupTimeFraction(
  state: Readonly<PlayerPowerupState>,
): number {
  if (state.powerupOn === 0 || POWERUP_FRAMES <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, state.powerupTime / POWERUP_FRAMES));
}

/** TriDamage → 3; otherwise 1. */
export function weaponDamageMultiplier(powerupOn: number): number {
  return powerupOn === POWERUP.TriDamage
    ? POWERUP_EFFECTS.triDamageMultiplier
    : 1;
}

/** Invulnerability powerup blocks all player damage (Flash `powerupon != 2`). */
export function isPowerupInvulnerable(powerupOn: number): boolean {
  return powerupOn === POWERUP.Invulnerability;
}

/** PredatorMode locks next/prev/number-key weapon switching. */
export function canSwitchWeapons(powerupOn: number): boolean {
  return powerupOn !== POWERUP.PredatorMode;
}

/**
 * TimeRift: player motion uses full-speed `1` while the world keeps the eased
 * slow-mo scale. Manual bullet-time does not override (player slows with world).
 */
export function playerTimeStepForPowerup(
  worldTimeStep: number,
  powerupOn: number,
): number {
  return powerupOn === POWERUP.TimeRift ? 1 : worldTimeStep;
}

/**
 * Jetpack thrust while jump is held (Flash `yspeed = max(yspeed-2, -32)`).
 * Also marks airborne / hyper-jump flags so landing resets cleanly.
 */
export function applyJetpackThrust(vy: number): number {
  return Math.max(
    vy - POWERUP_EFFECTS.jetpackThrust,
    POWERUP_EFFECTS.jetpackMaxUpSpeed,
  );
}

/** True when Jetpack should replace the normal jump hold path. */
export function isJetpackActive(powerupOn: number, jumpHeld: boolean): boolean {
  return powerupOn === POWERUP.Jetpack && jumpHeld;
}

/**
 * PredatorMode sprite alpha (Flash `gfx._alpha = 0`, with rare flicker).
 * Returns 0..1 for Phaser `setAlpha`.
 */
export function predatorSpriteAlpha(predCounter: number): number {
  // Flash: `(pred++%10) == 4` → 10; `== 8` → 4; else 0 (on 0–100 scale).
  const phase = predCounter % 10;
  if (phase === 4) {
    return 0.1;
  }
  if (phase === 8) {
    return 0.04;
  }
  return 0;
}

/** Player draw alpha for the active powerup (1 = fully visible). */
export function playerPowerupAlpha(
  powerupOn: number,
  predCounter: number = 0,
): number {
  if (powerupOn === POWERUP.PredatorMode) {
    return predatorSpriteAlpha(predCounter);
  }
  return 1;
}

/**
 * Force ShoulderCannon while PredatorMode is live; restore MachineGun when it
 * expires (Flash `cgun = guns.length-1` / `cgun = 0`).
 */
export function syncPredatorWeapon(
  inventory: WeaponInventory,
  powerupOn: number,
  expiredId: number = 0,
): void {
  if (powerupOn === POWERUP.PredatorMode) {
    inventory.activeIndex = PREDATOR_WEAPON_INDEX;
    return;
  }
  if (
    expiredId === POWERUP.PredatorMode &&
    inventory.activeIndex === PREDATOR_WEAPON_INDEX
  ) {
    inventory.activeIndex = 0;
  }
}

/**
 * One discrete sim frame of the timed powerup slot (Flash `powerupTime--`).
 * Clears `powerupOn` when the timer hits 0. Returns the expired id (if any)
 * so callers can restore predator weapon / visibility.
 */
export function stepPlayerPowerup(
  state: PlayerPowerupState,
): PowerupStepResult {
  if (state.powerupOn === 0) {
    return { expired: 0 };
  }
  state.powerupTime -= 1;
  if (state.powerupTime > 0) {
    return { expired: 0 };
  }
  const expired = state.powerupOn;
  state.powerupOn = 0;
  state.powerupTime = 0;
  return { expired };
}

/** Spec sanity — effect multipliers / jetpack match portable config. */
export function powerupEffectsMatchSpec(): boolean {
  return (
    POWERUP_FRAMES === 500 &&
    POWERUP.TriDamage === 1 &&
    POWERUP.Invulnerability === 2 &&
    POWERUP.PredatorMode === 3 &&
    POWERUP.TimeRift === 4 &&
    POWERUP.Jetpack === 5 &&
    POWERUP_EFFECTS.triDamageMultiplier === 3 &&
    POWERUP_EFFECTS.jetpackThrust === 2 &&
    POWERUP_EFFECTS.jetpackMaxUpSpeed === -32
  );
}
