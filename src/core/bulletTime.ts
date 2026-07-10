/**
 * Manual bullet-time ("timeDistort") — issue #42.
 *
 * Hold-key slow-motion with a draining meter that eases the whole sim toward
 * 0.2× and back to 1×. TimeRift (`powerupOn == 4`) and death slow-mo reuse the
 * same easing path without requiring the key; TimeRift never drains the meter.
 *
 * Flash: `sendGameSpeed = max(0.2, sendGameSpeed - 0.1)` while active, else
 * `min(gameSpeed, sendGameSpeed + 0.1)`; meter `maxbullettime = 250`.
 */

import { BULLET_TIME, WORLD } from '../config/constants';

/** Live meter — Flash `player.bullettime` (frames remaining). */
export type BulletTimeState = {
  /** Remaining meter frames; starts at {@link BULLET_TIME.maxFrames}. */
  meter: number;
};

/** Per-tick drivers for the slow-mo gate (Flash key / powerup / gameover). */
export type BulletTimeDrivers = {
  /** Shift (or rebound) held this sim tick. */
  keyHeld: boolean;
  /** Flash `player.powerupOn == 4` (TimeRift). */
  timeRiftActive: boolean;
  /** Flash `gameover` — death sequence also runs through this path. */
  gameOver: boolean;
};

/** Full meter at run start (Flash `this.bullettime = maxbullettime`). */
export function createBulletTimeState(): BulletTimeState {
  return { meter: BULLET_TIME.maxFrames };
}

/**
 * Whether this tick should ease toward {@link BULLET_TIME.minScale}.
 *
 * Flash precedence:
 * `(bullettime > 0 && Key.isDown(bulletTimeKey) && gamestarted) || gameover || powerupOn == 4`
 */
export function isBulletTimeActive(
  state: BulletTimeState,
  drivers: BulletTimeDrivers,
): boolean {
  const keyPath = state.meter > 0 && drivers.keyHeld;
  return keyPath || drivers.gameOver || drivers.timeRiftActive;
}

/**
 * One sim frame of easing + optional meter drain.
 * Returns the next global `timeStep` (Flash `sendGameSpeed`).
 *
 * Drain only while the key path is live and TimeRift is off — TimeRift forces
 * the same slow-mo without consuming the meter (issue AC / Flash
 * `if (powerupOn != 4) bullettime--`).
 *
 * Steps are quantized to the 0.1 ease quantum so IEEE drift cannot leave the
 * scale stuck at 0.20000000000000015 instead of the spec floor 0.2.
 */
export function stepBulletTime(
  state: BulletTimeState,
  currentTimeStep: number,
  drivers: BulletTimeDrivers,
): number {
  const keyPath = state.meter > 0 && drivers.keyHeld;
  const active = keyPath || drivers.gameOver || drivers.timeRiftActive;

  if (active) {
    if (keyPath && !drivers.timeRiftActive) {
      state.meter = Math.max(0, state.meter - 1);
    }
    return quantizeTimeStep(
      Math.max(
        BULLET_TIME.minScale,
        currentTimeStep - BULLET_TIME.easePerFrame,
      ),
    );
  }

  return quantizeTimeStep(
    Math.min(WORLD.timeStep, currentTimeStep + BULLET_TIME.easePerFrame),
  );
}

/** Snap to the 0.1 ease grid (Flash ±0.1/frame). */
function quantizeTimeStep(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Heli-kill refill — Flash
 * `bullettime = min(maxbullettime, bullettime + maxbullettime/3)`.
 */
export function refillBulletTimeOnKill(state: BulletTimeState): void {
  state.meter = Math.min(
    BULLET_TIME.maxFrames,
    state.meter + BULLET_TIME.refillPerKill,
  );
}

/** HUD fraction 0..1 (Flash `bullettime/maxbullettime` → mask `_xscale`). */
export function bulletTimeMeterRatio(state: BulletTimeState): number {
  return state.meter / BULLET_TIME.maxFrames;
}
