/**
 * Scale config — unit tests for issue #28 acceptance criteria.
 * Locks FIT + CENTER_BOTH (and the RESIZE rejection) to exact Phaser enum values.
 */

import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from './game';
import {
  phaserScaleConfig,
  SCALE,
  SCALE_CENTER_BOTH,
  SCALE_MODE_FIT,
  SCALE_MODE_RESIZE,
  SCALE_PARENT_ID,
  scaleModeRationale,
} from './scale';

describe('SCALE config (issue #28)', () => {
  it('locks design resolution to 1920×1080 (16:9)', () => {
    expect(SCALE.designWidth).toBe(1920);
    expect(SCALE.designHeight).toBe(1080);
    expect(SCALE.designWidth).toBe(GAME_WIDTH);
    expect(SCALE.designHeight).toBe(GAME_HEIGHT);
    expect(SCALE.aspectRatio).toBeCloseTo(16 / 9, 10);
  });

  it('chooses Phaser FIT (3) over RESIZE (5) with CENTER_BOTH (1)', () => {
    expect(SCALE_MODE_FIT).toBe(3);
    expect(SCALE_MODE_RESIZE).toBe(5);
    expect(SCALE_CENTER_BOTH).toBe(1);

    expect(SCALE.mode).toBe(SCALE_MODE_FIT);
    expect(SCALE.modeName).toBe('FIT');
    expect(SCALE.rejectedMode).toBe(SCALE_MODE_RESIZE);
    expect(SCALE.rejectedModeName).toBe('RESIZE');
    expect(SCALE.autoCenter).toBe(SCALE_CENTER_BOTH);
    expect(SCALE.autoCenterName).toBe('CENTER_BOTH');
  });

  it('targets the full-page game container for parent + fullscreen', () => {
    expect(SCALE.parent).toBe(SCALE_PARENT_ID);
    expect(SCALE.fullscreenTarget).toBe(SCALE_PARENT_ID);
    expect(SCALE_PARENT_ID).toBe('game-container');
  });

  it('exports a Phaser scale fragment matching the chosen mode', () => {
    expect(phaserScaleConfig()).toEqual({
      mode: 3,
      autoCenter: 1,
      fullscreenTarget: 'game-container',
    });
  });

  it('documents why RESIZE was rejected', () => {
    const reason = scaleModeRationale();
    expect(reason).toContain('FIT');
    expect(reason).toContain('RESIZE');
    expect(reason).toContain('1920×1080');
  });
});
