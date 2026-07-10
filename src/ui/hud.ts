/**
 * In-game HUD snapshot + 1080p layout — issue #23.
 *
 * Pure logic (no Phaser). GameScene feeds live sim values each frame; the
 * Phaser view ({@link ./gameHud}) only draws this snapshot.
 *
 * Flash HUD bindings (decompiled):
 *   HUD.score = "Score: " + (Math.floor(score)*100)
 *   HUD.health.mask._yscale = health/100 * 100
 *   HUD.ammo = "Infinite x " | bullets + " x "
 *   HUD.weapon.gotoAndStop(cgun+1)
 *   HUD.reload.mask._xscale = reloadtime/reload * 100
 *   HUD.hyperjump.mask._xscale = hyperjump/150 * 100
 *   HUD.bullettime.mask._xscale = bullettime/maxbullettime * 100
 *   HUD.powerup.text + powerup.mask._yscale = powerupTime/powerupTime * 100
 */

import {
  BULLET_TIME,
  PLAYER,
  PLAYER_COMBAT,
  POWERUP,
  POWERUP_FRAMES,
  SCORE,
} from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { displayedScore, formatScoreHud } from '../combat/score';
import {
  playerHealthFraction,
  type PlayerHealthState,
} from '../combat/playerHealth';
import {
  hasActivePowerup,
  powerupTimeFraction,
} from '../combat/powerupEffects';
import type { PlayerPowerupState } from '../combat/powerupDrop';
import { bulletTimeMeterRatio, type BulletTimeState } from '../core/bulletTime';
import { boostChargeRatio, type BoostState } from '../player/boostPhysics';
import type { WeaponDef } from '../config/weapons';
import type { WeaponState } from '../combat/weapon';

/** Flash `HUD.powerup.text` labels for `powerupOn` 1..5. */
export const POWERUP_HUD_NAMES: Readonly<Record<number, string>> = {
  [POWERUP.TriDamage]: 'TriDamage',
  [POWERUP.Invulnerability]: 'Invulnerability',
  [POWERUP.PredatorMode]: 'PredatorMode',
  [POWERUP.TimeRift]: 'TimeRift',
  [POWERUP.Jetpack]: 'Jetpack',
};

/**
 * Layout anchored to the 1920×1080 design resolution (#23 / #28).
 * Under Phaser Scale.FIT these design-space coords stay correct at any
 * window / fullscreen aspect (see {@link ./responsiveScale}).
 * Sizes chosen so bars and labels read clearly at full HD.
 */
export const HUD_LAYOUT = {
  designWidth: GAME_WIDTH,
  designHeight: GAME_HEIGHT,
  margin: 40,
  /** Top-left health bar. */
  health: { x: 40, y: 40, width: 360, height: 28, labelGap: 8 },
  /** Top-right score. */
  score: { x: GAME_WIDTH - 40, y: 36, fontSize: 48 },
  /** Bottom-left weapon + ammo + reload. */
  weapon: {
    x: 40,
    y: GAME_HEIGHT - 120,
    fontSize: 32,
    ammoFontSize: 28,
    reloadWidth: 280,
    reloadHeight: 12,
    reloadGap: 10,
  },
  /** Bottom meters: hyper-jump (left of center) + bullet-time (right). */
  meters: {
    y: GAME_HEIGHT - 56,
    width: 280,
    height: 18,
    labelGap: 6,
    hyperJumpX: GAME_WIDTH / 2 - 300,
    bulletTimeX: GAME_WIDTH / 2 + 20,
  },
  /** Active powerup chip under the health bar. */
  powerup: {
    x: 40,
    y: 100,
    width: 280,
    height: 16,
    labelGap: 6,
    fontSize: 26,
  },
  /** Centered death banner during the dying delay (#24 owns game-over screen). */
  death: { fontSize: 96 },
  depth: 40,
} as const;

/** Live values the HUD view needs each frame. */
export type HudSnapshot = {
  scoreText: string;
  displayedScore: number;
  healthFraction: number;
  healthAlive: boolean;
  healthLabel: string;
  weaponName: string;
  weaponIndex: number;
  ammoText: string;
  reloadFraction: number;
  reloadReady: boolean;
  hyperJumpFraction: number;
  bulletTimeFraction: number;
  powerupVisible: boolean;
  powerupName: string;
  powerupFraction: number;
  showDeath: boolean;
};

/** Inputs gathered from SimSession / inventory for {@link buildHudSnapshot}. */
export type HudBuildInput = {
  score: number;
  health: Readonly<PlayerHealthState>;
  weapon: Readonly<WeaponState>;
  weaponDef: Readonly<WeaponDef>;
  weaponIndex: number;
  boost: Readonly<BoostState>;
  bulletTime: Readonly<BulletTimeState>;
  powerup: Readonly<PlayerPowerupState>;
};

/** Flash: `HUD.ammo = "Infinite x "` when bullets are infinite. */
export function formatAmmoHud(bullets: number): string {
  if (!Number.isFinite(bullets)) {
    return 'Infinite x';
  }
  return `${Math.max(0, Math.floor(bullets))} x`;
}

/** Flash: `HUD.reload.mask._xscale = reloadtime/reloadtime * 100`. */
export function weaponReloadFraction(
  weapon: Readonly<WeaponState>,
  def: Readonly<WeaponDef>,
): number {
  if (def.reload <= 0) {
    return 1;
  }
  if (!Number.isFinite(weapon.reloadTime)) {
    return 1;
  }
  return Math.max(0, Math.min(1, weapon.reloadTime / def.reload));
}

/** Flash powerup label, or empty when none active. */
export function powerupHudName(powerupOn: number): string {
  return POWERUP_HUD_NAMES[powerupOn] ?? '';
}

/**
 * Build a full HUD snapshot from live sim state.
 * Every meter uses the same 0..1 fractions Flash drove via mask `_xscale`.
 */
export function buildHudSnapshot(input: HudBuildInput): HudSnapshot {
  const { health, weapon, weaponDef, powerup } = input;
  const powerupVisible = hasActivePowerup(powerup);
  const healthFrac = playerHealthFraction(health);
  const alive = health.alive && health.health > 0;

  return {
    scoreText: formatScoreHud(input.score),
    displayedScore: displayedScore(input.score),
    healthFraction: healthFrac,
    healthAlive: alive,
    healthLabel: alive
      ? `Health: ${Math.max(0, Math.floor(health.health))}/${health.maxHealth}`
      : 'Health: DEAD',
    weaponName: weaponDef.name,
    weaponIndex: input.weaponIndex,
    ammoText: formatAmmoHud(weapon.bullets),
    reloadFraction: weaponReloadFraction(weapon, weaponDef),
    reloadReady: weapon.reloadTime >= weaponDef.reload,
    hyperJumpFraction: boostChargeRatio(input.boost),
    bulletTimeFraction: bulletTimeMeterRatio(input.bulletTime),
    powerupVisible,
    powerupName: powerupVisible ? powerupHudName(powerup.powerupOn) : '',
    powerupFraction: powerupTimeFraction(powerup),
    showDeath: !alive,
  };
}

/** Spec seeds the HUD meters depend on (exact Flash values). */
export function hudSpecSeeds() {
  return {
    designWidth: HUD_LAYOUT.designWidth,
    designHeight: HUD_LAYOUT.designHeight,
    scoreDisplayScale: SCORE.displayScale,
    maxHealth: PLAYER_COMBAT.maxHealth,
    boostChargeFrames: PLAYER.boostChargeFrames,
    bulletTimeMaxFrames: BULLET_TIME.maxFrames,
    powerupFrames: POWERUP_FRAMES,
  };
}
