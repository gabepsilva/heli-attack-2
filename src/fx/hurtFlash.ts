/**
 * Full-screen player-hurt flash — hard on for one frame, then off.
 *
 * Phaser `cameras.main.flash` fades alpha over its duration; this overlay
 * stays fully opaque for {@link HURT_FLASH.durationMs} then disappears.
 */

import type Phaser from 'phaser';
import { HURT_FLASH } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';

export type HurtFlashOptions = {
  scene: Phaser.Scene;
};

/** Presentation-side hurt flash. Create once in GameScene.create(). */
export class HurtFlash {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private remainingMs = 0;

  constructor(options: HurtFlashOptions) {
    const color =
      (HURT_FLASH.red << 16) | (HURT_FLASH.green << 8) | HURT_FLASH.blue;
    this.overlay = options.scene.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        color,
        1,
      )
      .setScrollFactor(0)
      .setDepth(10_000)
      .setVisible(false);
  }

  /** True while the flash rectangle is showing. */
  isActive(): boolean {
    return this.remainingMs > 0;
  }

  /** Start (or restart) a hard flash for {@link HURT_FLASH.durationMs}. */
  trigger(): void {
    this.remainingMs = HURT_FLASH.durationMs;
    this.overlay.setVisible(true);
  }

  /**
   * Advance the flash clock. Call every render frame; when time expires the
   * overlay snaps off (no fade).
   */
  update(deltaMs: number): void {
    if (this.remainingMs <= 0) {
      return;
    }
    this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, deltaMs));
    if (this.remainingMs <= 0) {
      this.overlay.setVisible(false);
    }
  }

  destroy(): void {
    this.remainingMs = 0;
    this.overlay.destroy();
  }
}
