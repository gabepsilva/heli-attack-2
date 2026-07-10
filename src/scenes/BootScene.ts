import Phaser from 'phaser';
import {
  BOOT_BACKGROUND_COLOR,
  BOOT_TITLE,
  BOOT_TITLE_STYLE,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/game';
import { SCENE_KEYS } from '../config/scenes';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, BOOT_TITLE, BOOT_TITLE_STYLE)
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 80,
        'Press SPACE or click to start',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '32px',
          color: '#aaaaaa',
        },
      )
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.start(SCENE_KEYS.Game);
    });
    this.input.once('pointerdown', () => {
      this.scene.start(SCENE_KEYS.Game);
    });
  }
}
