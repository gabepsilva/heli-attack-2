/**
 * Responsive FIT layout + HUD anchoring — issue #28 acceptance criteria.
 *
 * Asserts exact centering math and that HUD corners stay on the fitted
 * canvas under varied parent aspect ratios (desktop window + fullscreen).
 */

import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { HUD_LAYOUT } from './hud';
import {
  chooseDesktopScaleMode,
  computeFitLayout,
  designToParent,
  fullscreenButtonLabel,
  hudDesignAnchors,
  hudParentAnchors,
  isInsideFitCanvas,
} from './responsiveScale';

/** Representative parent sizes: native 16:9, ultrawide, portrait, small laptop. */
const PARENTS = [
  { name: '1080p', w: 1920, h: 1080 },
  { name: 'ultrawide', w: 2560, h: 1080 },
  { name: 'portrait', w: 1080, h: 1920 },
  { name: 'laptop', w: 1366, h: 768 },
  { name: '4k', w: 3840, h: 2160 },
  { name: 'square', w: 1200, h: 1200 },
] as const;

describe('computeFitLayout (issue #28 AC: centered)', () => {
  it('fills exactly at native 1920×1080 with zero letterbox', () => {
    const layout = computeFitLayout(1920, 1080);
    expect(layout.scale).toBe(1);
    expect(layout.displayWidth).toBe(1920);
    expect(layout.displayHeight).toBe(1080);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(0);
  });

  it('pillarboxes ultrawide and centers horizontally', () => {
    const layout = computeFitLayout(2560, 1080);
    expect(layout.scale).toBe(1);
    expect(layout.displayWidth).toBe(1920);
    expect(layout.displayHeight).toBe(1080);
    expect(layout.offsetX).toBe(320);
    expect(layout.offsetY).toBe(0);
  });

  it('letterboxes portrait and centers vertically', () => {
    const layout = computeFitLayout(1080, 1920);
    expect(layout.scale).toBeCloseTo(1080 / 1920, 10);
    expect(layout.displayWidth).toBeCloseTo(1080, 10);
    expect(layout.displayHeight).toBeCloseTo(1080 * (1080 / 1920), 10);
    expect(layout.offsetX).toBeCloseTo(0, 10);
    expect(layout.offsetY).toBeCloseTo((1920 - layout.displayHeight) / 2, 10);
  });

  it('keeps 16:9 display aspect for every parent size', () => {
    for (const p of PARENTS) {
      const layout = computeFitLayout(p.w, p.h);
      expect(layout.displayWidth / layout.displayHeight).toBeCloseTo(
        16 / 9,
        10,
      );
      expect(layout.offsetX).toBeCloseTo((p.w - layout.displayWidth) / 2, 10);
      expect(layout.offsetY).toBeCloseTo((p.h - layout.displayHeight) / 2, 10);
      expect(layout.displayWidth).toBeLessThanOrEqual(p.w + 1e-9);
      expect(layout.displayHeight).toBeLessThanOrEqual(p.h + 1e-9);
    }
  });

  it('handles degenerate parent sizes without NaN', () => {
    const layout = computeFitLayout(0, 800);
    expect(layout.scale).toBe(0);
    expect(Number.isFinite(layout.offsetX)).toBe(true);
    expect(Number.isFinite(layout.offsetY)).toBe(true);
  });
});

describe('HUD anchoring under FIT (issue #28 AC: HUD positioned)', () => {
  it('locks design-space anchors to HUD_LAYOUT / 1080p corners', () => {
    const a = hudDesignAnchors();
    expect(a.designWidth).toBe(GAME_WIDTH);
    expect(a.designHeight).toBe(GAME_HEIGHT);
    expect(a.margin).toBe(40);
    expect(a.health).toEqual({ x: 40, y: 40 });
    expect(a.score).toEqual({ x: GAME_WIDTH - 40, y: 36 });
    expect(a.weapon).toEqual({ x: 40, y: GAME_HEIGHT - 120 });
    expect(a.powerup).toEqual({ x: 40, y: 100 });
    expect(a.meters.y).toBe(GAME_HEIGHT - 56);
    expect(a.meters.hyperJumpX).toBe(GAME_WIDTH / 2 - 300);
    expect(a.meters.bulletTimeX).toBe(GAME_WIDTH / 2 + 20);
    expect(HUD_LAYOUT.health.x).toBe(a.health.x);
  });

  it('keeps every HUD anchor inside the fitted canvas for varied aspects', () => {
    for (const p of PARENTS) {
      const layout = computeFitLayout(p.w, p.h);
      const anchors = hudParentAnchors(layout);

      expect(
        isInsideFitCanvas(anchors.health.x, anchors.health.y, layout),
      ).toBe(true);
      expect(isInsideFitCanvas(anchors.score.x, anchors.score.y, layout)).toBe(
        true,
      );
      expect(
        isInsideFitCanvas(anchors.weapon.x, anchors.weapon.y, layout),
      ).toBe(true);
      expect(
        isInsideFitCanvas(anchors.powerup.x, anchors.powerup.y, layout),
      ).toBe(true);
      expect(
        isInsideFitCanvas(anchors.hyperJump.x, anchors.hyperJump.y, layout),
      ).toBe(true);
      expect(
        isInsideFitCanvas(anchors.bulletTime.x, anchors.bulletTime.y, layout),
      ).toBe(true);

      // Canvas corners map to the centered display rect.
      expect(anchors.canvasTopLeft.x).toBeCloseTo(layout.offsetX, 10);
      expect(anchors.canvasTopLeft.y).toBeCloseTo(layout.offsetY, 10);
      expect(anchors.canvasBottomRight.x).toBeCloseTo(
        layout.offsetX + layout.displayWidth,
        10,
      );
      expect(anchors.canvasBottomRight.y).toBeCloseTo(
        layout.offsetY + layout.displayHeight,
        10,
      );
    }
  });

  it('maps health (40,40) through ultrawide FIT to the canvas top-left inset', () => {
    const layout = computeFitLayout(2560, 1080);
    const health = designToParent(40, 40, layout);
    expect(health.x).toBe(320 + 40);
    expect(health.y).toBe(40);
  });
});

describe('scale mode choice + fullscreen label (issue #28)', () => {
  it('selects FIT + CENTER_BOTH and records RESIZE rejection', () => {
    const choice = chooseDesktopScaleMode();
    expect(choice.modeName).toBe('FIT');
    expect(choice.mode).toBe(3);
    expect(choice.autoCenter).toBe(1);
    expect(choice.rejectedModeName).toBe('RESIZE');
    expect(choice.rationale).toContain('FIT');
    expect(choice.rationale).toContain('RESIZE');
  });

  it('toggles fullscreen button copy', () => {
    expect(fullscreenButtonLabel(false)).toBe('Fullscreen');
    expect(fullscreenButtonLabel(true)).toBe('Exit Fullscreen');
  });
});
