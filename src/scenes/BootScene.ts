import Phaser from 'phaser';
import {
  BOOT_BACKGROUND_COLOR,
  BOOT_TITLE,
  BOOT_TITLE_STYLE,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/game';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, BOOT_TITLE, BOOT_TITLE_STYLE)
      .setOrigin(0.5);
  }
}
