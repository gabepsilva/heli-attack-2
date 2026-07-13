/**
 * In-game HUD snapshot + 1080p layout — issue #23 / #105 / #106.
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
 *   heroDie: HUD.ammo = "0 x "
 *
 * Meter composition (#106): Flash HUD places put hyperjump → bullettime →
 * reload left-to-right on the 450×320 stage. Weapon crate + ammo sit
 * bottom-right above reload (ammo left of crate, right-aligned). Coords
 * scale to 1920×1080 via {@link flashToDesign}.
 *
 * All FLASH_* constants below are read from `reference/ha2-source/heli2.swf`
 * (DefineSprite "HUD", export id 215) — PlaceObject2 matrices and the
 * DefineEditText records, twips ÷ 20.
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
import { hasAmmo, isReloadReady, type WeaponState } from '../combat/weapon';
import { weaponHudIconFrame, type SpriteId } from '../art/catalog';

/** Flash `HUD.powerup.text` labels for `powerupOn` 1..5. */
export const POWERUP_HUD_NAMES: Readonly<Record<number, string>> = {
  [POWERUP.TriDamage]: 'TriDamage',
  [POWERUP.Invulnerability]: 'Invulnerability',
  [POWERUP.PredatorMode]: 'PredatorMode',
  [POWERUP.TimeRift]: 'TimeRift',
  [POWERUP.Jetpack]: 'Jetpack',
};

/**
 * Original Flash embed stage (`heli2.html` object/embed width/height).
 * HUD Symbol 38 instance positions are authored in this space.
 */
export const FLASH_STAGE = { width: 450, height: 320 } as const;

/**
 * Flash `HUD` (export id 215 / Symbol 38) meter instance **place** positions
 * in stage pixels (SWF PlaceObject2 matrix tx/ty, twips ÷ 20).
 *
 * Extracted from `reference/ha2-source/heli2.swf` DefineSprite "HUD".
 * Cross-check: each meter sits just right of its label; weapon/ammo sit
 * bottom-right above the reload meter.
 */
export const FLASH_HUD_METERS = {
  hyperjump: { x: 129, y: 302 },
  bullettime: { x: 282, y: 302 },
  reload: { x: 407, y: 302 },
} as const;

/**
 * Flash HUD meter labels (left of each bar) in stage pixels.
 *
 * These are the **white** static-text places. Every text in the Flash HUD is
 * drawn twice — a black copy offset by {@link FLASH_HUD_TEXT_SHADOW}, then the
 * white one on top — so the black twins sit at (58,307)/(210,307)/(365,307).
 */
export const FLASH_HUD_METER_LABELS = {
  hyperjump: { x: 57, y: 306, text: 'HyperJump:' },
  bullettime: { x: 209, y: 306, text: 'TimeDistort:' },
  reload: { x: 364, y: 306, text: 'Reload:' },
} as const;

/**
 * Offset of the black shadow twin behind every Flash HUD text, in stage px.
 * e.g. white `ammo` at (363,287), black `ammo` at (364,288).
 */
export const FLASH_HUD_TEXT_SHADOW = { dx: 1, dy: 1 } as const;

/**
 * Flash `HUD.weapon` crate clip place (named instance, 14-frame power*.png).
 * Bottom-right of the 450×320 stage, above the reload meter.
 */
export const FLASH_HUD_WEAPON = { x: 416, y: 269 } as const;

/**
 * Flash `HUD.ammo` EditText (white copy; the black twin is offset by
 * {@link FLASH_HUD_TEXT_SHADOW}). DefineEditText: `align=right`, font height 8,
 * bounds x −2..55.2 / y −2..14, `varName="ammo"`.
 *
 * The field is 16 stage px tall for an 8px font and Flash lays a single line
 * out from the **top** of the box, so `y` is the text top — not its baseline
 * and not the crate's bottom edge. Its right edge (`x + boundsRight` = 418.2)
 * overhangs the crate's left edge (416) by ~2px, so long counts read into the
 * crate exactly as they did in the original.
 */
export const FLASH_HUD_AMMO = {
  x: 363,
  y: 287,
  /** EditText bounds xmax, place-relative: right edge = x + boundsRight. */
  boundsRight: 55.2,
  fontSize: 8,
} as const;

/** Map a Flash stage point into the 1920×1080 design resolution. */
export function flashToDesign(x: number, y: number): { x: number; y: number } {
  return {
    x: (x * GAME_WIDTH) / FLASH_STAGE.width,
    y: (y * GAME_HEIGHT) / FLASH_STAGE.height,
  };
}

/**
 * Meter ids sorted by Flash stage X (original left→right composition).
 * Derived from {@link FLASH_HUD_METERS}, not a hard-coded aesthetic order.
 */
export function flashHudMeterOrderLeftToRight(): ReadonlyArray<
  keyof typeof FLASH_HUD_METERS
> {
  return (
    Object.entries(FLASH_HUD_METERS) as Array<
      [keyof typeof FLASH_HUD_METERS, { x: number; y: number }]
    >
  )
    .sort((a, b) => a[1].x - b[1].x)
    .map(([id]) => id);
}

const DESIGN_HYPER_JUMP = flashToDesign(
  FLASH_HUD_METERS.hyperjump.x,
  FLASH_HUD_METERS.hyperjump.y,
);
const DESIGN_BULLET_TIME = flashToDesign(
  FLASH_HUD_METERS.bullettime.x,
  FLASH_HUD_METERS.bullettime.y,
);
const DESIGN_RELOAD = flashToDesign(
  FLASH_HUD_METERS.reload.x,
  FLASH_HUD_METERS.reload.y,
);
const DESIGN_HJ_LABEL = flashToDesign(
  FLASH_HUD_METER_LABELS.hyperjump.x,
  FLASH_HUD_METER_LABELS.hyperjump.y,
);
const DESIGN_BT_LABEL = flashToDesign(
  FLASH_HUD_METER_LABELS.bullettime.x,
  FLASH_HUD_METER_LABELS.bullettime.y,
);
const DESIGN_RL_LABEL = flashToDesign(
  FLASH_HUD_METER_LABELS.reload.x,
  FLASH_HUD_METER_LABELS.reload.y,
);
/**
 * Uniform HUD scale — the **height** factor (450×320 → 1920×1080).
 *
 * The Flash stage is 1.41:1 and our canvas is 16:9, so {@link flashToDesign}
 * stretches X harder than Y. That is fine for spreading positions across the
 * wider canvas, but applying it to *art* distorts it: the crate came out 26%
 * too wide. Art therefore scales uniformly by this factor, and the bottom-right
 * cluster is anchored to the right edge (see {@link flashRightAnchoredX}) so it
 * still hugs the corner the way Flash's did.
 */
const FLASH_HUD_SCALE = GAME_HEIGHT / FLASH_STAGE.height;

/**
 * Design X for a Flash stage X, measured inward from the **right** edge at
 * uniform scale. Keeps a right-hugging cluster's internal spacing intact
 * instead of stretching it: Flash's crate sat 1px off the 450px stage edge, so
 * ours sits `1 × scale` off the canvas edge.
 */
function flashRightAnchoredX(stageX: number): number {
  return GAME_WIDTH - (FLASH_STAGE.width - stageX) * FLASH_HUD_SCALE;
}

/**
 * Layout anchored to the 1920×1080 design resolution (#23 / #28 / #106).
 * Under Phaser Scale.FIT these design-space coords stay correct at any
 * window / fullscreen aspect (uniform canvas scale + letterbox).
 * Weapon/ammo/meters use Flash Symbol 38 places scaled 450×320 → 1920×1080.
 */
export const HUD_LAYOUT = {
  designWidth: GAME_WIDTH,
  designHeight: GAME_HEIGHT,
  margin: 40,
  /** Top-left health bar. */
  health: { x: 40, y: 40, width: 360, height: 28, labelGap: 8 },
  /** Top-right score. */
  score: { x: GAME_WIDTH - 40, y: 36, fontSize: 48 },
  /**
   * Bottom-right weapon cluster (#105): Flash `HUD.weapon` + `HUD.ammo`.
   * Crate hugs the right margin; the ammo count sits to its left, right-aligned
   * so it grows leftwards. Reload lives with the bottom meters (#106), not
   * under the crate.
   *
   * The whole cluster is right-anchored at uniform {@link FLASH_HUD_SCALE}, so
   * the crate keeps its 33×32 aspect and the count keeps its Flash gap from the
   * crate. Every value here is design-space and ready to draw.
   */
  weapon: {
    x: flashRightAnchoredX(FLASH_HUD_WEAPON.x),
    y: FLASH_HUD_WEAPON.y * FLASH_HUD_SCALE,
    /** Flash crate logical size (power*.png), drawn at uniform scale. */
    iconW: 33,
    iconH: 32,
    iconScale: FLASH_HUD_SCALE,
    /** Right edge of the Flash ammo field — the right-align anchor. */
    ammoRightX: flashRightAnchoredX(
      FLASH_HUD_AMMO.x + FLASH_HUD_AMMO.boundsRight,
    ),
    /** Top of the ammo line; see {@link FLASH_HUD_AMMO} on why it is the top. */
    ammoTopY: FLASH_HUD_AMMO.y * FLASH_HUD_SCALE,
    /** Flash font 8px × uniform scale. */
    ammoFontSize: FLASH_HUD_AMMO.fontSize * FLASH_HUD_SCALE,
    ammoShadowDx: FLASH_HUD_TEXT_SHADOW.dx * FLASH_HUD_SCALE,
    ammoShadowDy: FLASH_HUD_TEXT_SHADOW.dy * FLASH_HUD_SCALE,
  },
  /**
   * Bottom meters (#106): Flash order hyper-jump → bullet-time → reload.
   * Anchors are Flash Symbol 38 positions scaled 450×320 → 1920×1080.
   * Width is capped so the rightmost (reload) bar stays on-canvas at that
   * Flash X — Flash bars were short; 176px still reads clearly at 1080p.
   */
  meters: {
    y: DESIGN_HYPER_JUMP.y,
    /** Fits `reloadX + width < designWidth` at Flash-scaled reload X. */
    width: 176,
    height: 18,
    labelFontSize: 18,
    hyperJumpX: DESIGN_HYPER_JUMP.x,
    bulletTimeX: DESIGN_BULLET_TIME.x,
    reloadX: DESIGN_RELOAD.x,
    hyperJumpLabelX: DESIGN_HJ_LABEL.x,
    bulletTimeLabelX: DESIGN_BT_LABEL.x,
    reloadLabelX: DESIGN_RL_LABEL.x,
    labelY: DESIGN_HJ_LABEL.y,
    hyperJumpLabel: FLASH_HUD_METER_LABELS.hyperjump.text,
    bulletTimeLabel: FLASH_HUD_METER_LABELS.bullettime.text,
    reloadLabel: FLASH_HUD_METER_LABELS.reload.text,
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

/**
 * HUD corner anchors in design space — the positions GameHud uses (#28).
 * Under FIT these stay at the corresponding corners of the fitted canvas.
 */
export function hudDesignAnchors() {
  const flashOrder = flashHudMeterOrderLeftToRight();
  return {
    health: { x: HUD_LAYOUT.health.x, y: HUD_LAYOUT.health.y },
    score: { x: HUD_LAYOUT.score.x, y: HUD_LAYOUT.score.y },
    weapon: { x: HUD_LAYOUT.weapon.x, y: HUD_LAYOUT.weapon.y },
    powerup: { x: HUD_LAYOUT.powerup.x, y: HUD_LAYOUT.powerup.y },
    meters: {
      /** Derived from Flash stage X via {@link flashHudMeterOrderLeftToRight}. */
      order: flashOrder,
      hyperJumpX: HUD_LAYOUT.meters.hyperJumpX,
      bulletTimeX: HUD_LAYOUT.meters.bulletTimeX,
      reloadX: HUD_LAYOUT.meters.reloadX,
      y: HUD_LAYOUT.meters.y,
      labelY: HUD_LAYOUT.meters.labelY,
    },
    designWidth: HUD_LAYOUT.designWidth,
    designHeight: HUD_LAYOUT.designHeight,
    margin: HUD_LAYOUT.margin,
  };
}

/** Live values the HUD view needs each frame. */
export type HudSnapshot = {
  scoreText: string;
  displayedScore: number;
  healthFraction: number;
  healthAlive: boolean;
  healthLabel: string;
  weaponName: string;
  weaponIndex: number;
  /** Atlas frame for Flash `HUD.weapon` crate icon (#105). */
  weaponIconFrame: SpriteId;
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

/**
 * Flash: `HUD.ammo = "Infinite x "` when bullets are infinite;
 * otherwise `bullets + " x "`.
 *
 * The trailing space is load-bearing, not a typo: the field is right-aligned
 * against the crate's left edge, so that space *is* the gap between the count
 * and the crate. Drop it and the `x` collides with the crate.
 */
export function formatAmmoHud(bullets: number): string {
  if (!Number.isFinite(bullets)) {
    return 'Infinite x ';
  }
  return `${Math.max(0, Math.floor(bullets))} x `;
}

/** Flash `heroDie`: `HUD.ammo = "0 x "` (trailing space — see {@link formatAmmoHud}). */
export const DEATH_AMMO_HUD = '0 x ';

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
    weaponIconFrame: weaponHudIconFrame(input.weaponIndex),
    // Flash heroDie forces "0 x " regardless of remaining bullets.
    ammoText: alive ? formatAmmoHud(weapon.bullets) : DEATH_AMMO_HUD,
    reloadFraction: weaponReloadFraction(weapon, weaponDef),
    // Flash: `if (reloadtime >= reload) { if (bullets > 0) yellow._visible = 1 }`
    reloadReady: isReloadReady(weapon, weaponDef) && hasAmmo(weapon),
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
    weaponIconW: HUD_LAYOUT.weapon.iconW,
    weaponIconH: HUD_LAYOUT.weapon.iconH,
  };
}

/** Design-space size of the weapon crate icon (uniform — keeps its aspect). */
export function weaponHudIconDisplaySize(): { w: number; h: number } {
  const { iconW, iconH, iconScale } = HUD_LAYOUT.weapon;
  return {
    w: iconW * iconScale,
    h: iconH * iconScale,
  };
}
