/**
 * Player intent layer — issue #29.
 *
 * Gameplay reads this abstract intent (move / aim / fire / jump / duck /
 * boost / bullet-time / weapon switch), never raw keyboard or pointer APIs.
 * Input sources (keyboard+mouse, touch #30, gamepad #31) sample hardware into
 * {@link PlayerIntent}; {@link applyPlayerIntent} copies it onto the sim
 * session each render frame.
 *
 * Key rebinding is out of scope, but sources feed intent via a bindings table
 * so a future rebind UI can swap mappings without touching gameplay.
 */

import {
  nextWeapon,
  prevWeapon,
  selectWeaponByDigitKey,
} from '../combat/weaponInventory';
import type { SimSession } from '../core/simSession';

/**
 * Full per-frame player intent.
 * Held flags are level-triggered; weapon fields are edge-triggered (one-shot).
 */
export type PlayerIntent = {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  /** Boost / hyper-jump (default: Ctrl). */
  boost: boolean;
  /** Bullet-time hold (default: Shift). */
  bulletTime: boolean;
  /** Primary fire hold (default: mouse button). */
  fire: boolean;
  /** Aim point in arena / world space (same coords as the player body). */
  aimX: number;
  aimY: number;
  /**
   * Digit key 0–9 pressed this frame, or `null`.
   * Mapped to arsenal indices by {@link selectWeaponByDigitKey}.
   */
  selectWeaponDigit: number | null;
  /** Cycle to previous owned weapon (default: Q). */
  prevWeapon: boolean;
  /** Cycle to next owned weapon (default: E). */
  nextWeapon: boolean;
};

/** Empty / released intent — safe default before the first sample. */
export function createPlayerIntent(aimX = 0, aimY = 0): PlayerIntent {
  return {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
    bulletTime: false,
    fire: false,
    aimX,
    aimY,
    selectWeaponDigit: null,
    prevWeapon: false,
    nextWeapon: false,
  };
}

/**
 * Copy intent onto the sim session so physics / combat read only session
 * fields — never keys or pointers.
 */
export function applyPlayerIntent(
  session: SimSession,
  intent: PlayerIntent,
): void {
  session.player.input = {
    left: intent.left,
    right: intent.right,
    jump: intent.jump,
    duck: intent.duck,
    boost: intent.boost,
  };
  session.player.mouse = { x: intent.aimX, y: intent.aimY };
  session.fireHeld = intent.fire;
  session.bulletTimeHeld = intent.bulletTime;

  const powerupOn = session.playerPowerup.powerupOn;
  if (intent.selectWeaponDigit !== null) {
    selectWeaponByDigitKey(
      session.inventory,
      intent.selectWeaponDigit,
      powerupOn,
    );
  }
  if (intent.prevWeapon) {
    prevWeapon(session.inventory, powerupOn);
  }
  if (intent.nextWeapon) {
    nextWeapon(session.inventory, powerupOn);
  }
}

/**
 * Combine two intents for a frame (keyboard + touch/gamepad, or chained merges).
 * Held flags OR; weapon edges OR; aim prefers the secondary source when active.
 */
export function mergePlayerIntents(
  primary: PlayerIntent,
  secondary: PlayerIntent,
  opts: { preferSecondaryAim: boolean },
): PlayerIntent {
  return {
    left: primary.left || secondary.left,
    right: primary.right || secondary.right,
    jump: primary.jump || secondary.jump,
    duck: primary.duck || secondary.duck,
    boost: primary.boost || secondary.boost,
    bulletTime: primary.bulletTime || secondary.bulletTime,
    fire: primary.fire || secondary.fire,
    aimX: opts.preferSecondaryAim ? secondary.aimX : primary.aimX,
    aimY: opts.preferSecondaryAim ? secondary.aimY : primary.aimY,
    selectWeaponDigit: primary.selectWeaponDigit ?? secondary.selectWeaponDigit,
    prevWeapon: primary.prevWeapon || secondary.prevWeapon,
    nextWeapon: primary.nextWeapon || secondary.nextWeapon,
  };
}
