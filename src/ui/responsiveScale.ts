/**
 * Pure responsive layout math for issue #28.
 *
 * Mirrors Phaser Scale Manager FIT + CENTER_BOTH: uniform scale to fit the
 * parent, then center the display rect. HUD elements live in design space
 * (1920×1080); under FIT they map through this transform and stay anchored
 * to the game canvas corners regardless of window / fullscreen aspect.
 */

import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
  SCALE,
  SCALE_CENTER_BOTH,
  SCALE_MODE_FIT,
  scaleModeRationale,
} from '../config/scale';
import { HUD_LAYOUT } from './hud';

export type FitLayout = {
  /** Uniform CSS scale applied to the design canvas. */
  scale: number;
  displayWidth: number;
  displayHeight: number;
  /** Letterbox / pillarbox offsets that keep the canvas centered. */
  offsetX: number;
  offsetY: number;
  parentWidth: number;
  parentHeight: number;
  designWidth: number;
  designHeight: number;
};

/**
 * Compute the FIT display rect for a parent size (Phaser Scale.FIT + CENTER_BOTH).
 */
export function computeFitLayout(
  parentWidth: number,
  parentHeight: number,
  designWidth: number = GAME_WIDTH,
  designHeight: number = GAME_HEIGHT,
): FitLayout {
  if (parentWidth <= 0 || parentHeight <= 0) {
    return {
      scale: 0,
      displayWidth: 0,
      displayHeight: 0,
      offsetX: 0,
      offsetY: 0,
      parentWidth,
      parentHeight,
      designWidth,
      designHeight,
    };
  }

  const scale = Math.min(
    parentWidth / designWidth,
    parentHeight / designHeight,
  );
  const displayWidth = designWidth * scale;
  const displayHeight = designHeight * scale;

  return {
    scale,
    displayWidth,
    displayHeight,
    offsetX: (parentWidth - displayWidth) / 2,
    offsetY: (parentHeight - displayHeight) / 2,
    parentWidth,
    parentHeight,
    designWidth,
    designHeight,
  };
}

/** Map a design-space point into parent/screen coordinates under FIT. */
export function designToParent(
  designX: number,
  designY: number,
  layout: FitLayout,
): { x: number; y: number } {
  return {
    x: layout.offsetX + designX * layout.scale,
    y: layout.offsetY + designY * layout.scale,
  };
}

/**
 * HUD corner anchors in design space — the positions GameHud uses.
 * Under FIT these stay at the corresponding corners of the fitted canvas.
 */
export function hudDesignAnchors() {
  return {
    health: { x: HUD_LAYOUT.health.x, y: HUD_LAYOUT.health.y },
    score: { x: HUD_LAYOUT.score.x, y: HUD_LAYOUT.score.y },
    weapon: { x: HUD_LAYOUT.weapon.x, y: HUD_LAYOUT.weapon.y },
    powerup: { x: HUD_LAYOUT.powerup.x, y: HUD_LAYOUT.powerup.y },
    meters: {
      hyperJumpX: HUD_LAYOUT.meters.hyperJumpX,
      bulletTimeX: HUD_LAYOUT.meters.bulletTimeX,
      y: HUD_LAYOUT.meters.y,
    },
    designWidth: HUD_LAYOUT.designWidth,
    designHeight: HUD_LAYOUT.designHeight,
    margin: HUD_LAYOUT.margin,
  };
}

/**
 * Project HUD anchors into parent space for a given window/fullscreen size.
 * Used to verify corners remain on the fitted canvas under varied aspects.
 */
export function hudParentAnchors(layout: FitLayout) {
  const a = hudDesignAnchors();
  return {
    health: designToParent(a.health.x, a.health.y, layout),
    score: designToParent(a.score.x, a.score.y, layout),
    weapon: designToParent(a.weapon.x, a.weapon.y, layout),
    powerup: designToParent(a.powerup.x, a.powerup.y, layout),
    hyperJump: designToParent(a.meters.hyperJumpX, a.meters.y, layout),
    bulletTime: designToParent(a.meters.bulletTimeX, a.meters.y, layout),
    canvasTopLeft: designToParent(0, 0, layout),
    canvasBottomRight: designToParent(
      layout.designWidth,
      layout.designHeight,
      layout,
    ),
  };
}

/** True when a parent-space point lies on/inside the fitted game canvas. */
export function isInsideFitCanvas(
  x: number,
  y: number,
  layout: FitLayout,
  epsilon = 1e-6,
): boolean {
  return (
    x >= layout.offsetX - epsilon &&
    y >= layout.offsetY - epsilon &&
    x <= layout.offsetX + layout.displayWidth + epsilon &&
    y <= layout.offsetY + layout.displayHeight + epsilon
  );
}

/**
 * Scale-mode decision for #28: FIT first; RESIZE evaluated and rejected.
 */
export function chooseDesktopScaleMode(): {
  modeName: 'FIT';
  mode: typeof SCALE_MODE_FIT;
  autoCenter: typeof SCALE_CENTER_BOTH;
  rejectedModeName: 'RESIZE';
  rationale: string;
} {
  return {
    modeName: SCALE.modeName,
    mode: SCALE.mode,
    autoCenter: SCALE.autoCenter,
    rejectedModeName: SCALE.rejectedModeName,
    rationale: scaleModeRationale(),
  };
}

/** Label for the fullscreen toggle button. */
export function fullscreenButtonLabel(isFullscreen: boolean): string {
  return isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
}
