/**
 * Phaser Scale Manager settings — issue #28.
 *
 * FIT (letterbox/pillarbox) keeps the fixed 1920×1080 design resolution and
 * HUD anchors intact across window sizes and fullscreen. RESIZE was evaluated
 * and rejected: it changes the game size to the parent, which would stretch
 * or reflow the world and break {@link ../ui/hud.HUD_LAYOUT} corner anchors.
 *
 * Numeric mode/center values match Phaser 4 enums (`Scale.FIT` = 3,
 * `Scale.CENTER_BOTH` = 1) so unit tests can lock the config handed to Phaser
 * without importing the engine (needs a DOM).
 */

import { GAME_HEIGHT, GAME_WIDTH } from './game';

/** Phaser.Scale.ScaleModes.FIT */
export const SCALE_MODE_FIT = 3;
/** Phaser.Scale.Center.CENTER_BOTH */
export const SCALE_CENTER_BOTH = 1;

export const SCALE_PARENT_ID = 'game-container';

/**
 * Chosen Scale Manager configuration for desktop window + fullscreen.
 */
export const SCALE = {
  designWidth: GAME_WIDTH,
  designHeight: GAME_HEIGHT,
  /** Aspect locked by FIT (16:9). */
  aspectRatio: GAME_WIDTH / GAME_HEIGHT,
  mode: SCALE_MODE_FIT,
  autoCenter: SCALE_CENTER_BOTH,
  parent: SCALE_PARENT_ID,
  fullscreenTarget: SCALE_PARENT_ID,
} as const;

/**
 * Phaser `scale` config fragment for {@link Phaser.Types.Core.GameConfig}.
 * Width/height stay on the top-level game config; this only covers scaling.
 */
export function phaserScaleConfig(): {
  mode: number;
  autoCenter: number;
  fullscreenTarget: string;
} {
  return {
    mode: SCALE.mode,
    autoCenter: SCALE.autoCenter,
    fullscreenTarget: SCALE.fullscreenTarget,
  };
}
