import Phaser from 'phaser';
import { atlasLoadPaths } from '../art/atlasManifest';
import {
  BG_IMAGE_KEY,
  BG_IMAGE_PATH,
  TITLE_IMAGE_KEY,
  TITLE_IMAGE_PATH,
} from '../config/art';
import { SCENE_KEYS } from '../config/scenes';

/**
 * Asset boot — loads the atlas + stage plates, then enters the main menu
 * (#24 / #34). Audio unlock happens on the menu Start gesture (browser
 * autoplay policy).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  preload(): void {
    const atlas = atlasLoadPaths();
    this.load.atlas(atlas.key, atlas.imagePath, atlas.jsonPath);
    this.load.image(BG_IMAGE_KEY, BG_IMAGE_PATH);
    this.load.image(TITLE_IMAGE_KEY, TITLE_IMAGE_PATH);
  }

  create(): void {
    this.scene.start(SCENE_KEYS.Menu);
  }
}
