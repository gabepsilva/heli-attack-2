import Phaser from 'phaser';
import { atlasLoadPaths } from '../art/atlasManifest';
import {
  BOOT_BACKGROUND_COLOR,
  BOOT_TITLE,
  BOOT_TITLE_STYLE,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/game';
import { SCENE_KEYS } from '../config/scenes';

/**
 * Asset boot — loads the atlas, then enters the main menu (#24).
 * Audio unlock happens on the menu Start gesture (browser autoplay policy).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  preload(): void {
    const atlas = atlasLoadPaths();
    this.load.atlas(atlas.key, atlas.imagePath, atlas.jsonPath);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, BOOT_TITLE, BOOT_TITLE_STYLE)
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, 'Loading…', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.scene.start(SCENE_KEYS.Menu);
  }
}
