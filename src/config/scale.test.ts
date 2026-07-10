/**
 * Scale config — unit tests for issue #28.
 * Pins the Scale Manager fragment actually passed to Phaser.
 */

import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from './game';
import {
  phaserScaleConfig,
  SCALE,
  SCALE_CENTER_BOTH,
  SCALE_MODE_FIT,
  SCALE_PARENT_ID,
} from './scale';

describe('SCALE config (issue #28)', () => {
  it('locks design resolution to 1920×1080 (16:9)', () => {
    expect(SCALE.designWidth).toBe(1920);
    expect(SCALE.designHeight).toBe(1080);
    expect(SCALE.designWidth).toBe(GAME_WIDTH);
    expect(SCALE.designHeight).toBe(GAME_HEIGHT);
    expect(SCALE.aspectRatio).toBeCloseTo(16 / 9, 10);
  });

  it('hands Phaser FIT (3) + CENTER_BOTH (1) on game-container', () => {
    expect(SCALE_MODE_FIT).toBe(3);
    expect(SCALE_CENTER_BOTH).toBe(1);
    expect(SCALE.mode).toBe(SCALE_MODE_FIT);
    expect(SCALE.autoCenter).toBe(SCALE_CENTER_BOTH);
    expect(SCALE.parent).toBe(SCALE_PARENT_ID);
    expect(SCALE.fullscreenTarget).toBe(SCALE_PARENT_ID);
    expect(SCALE_PARENT_ID).toBe('game-container');

    expect(phaserScaleConfig()).toEqual({
      mode: 3,
      autoCenter: 1,
      fullscreenTarget: 'game-container',
    });
  });
});
