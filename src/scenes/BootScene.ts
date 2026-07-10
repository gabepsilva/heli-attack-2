import Phaser from 'phaser';
import { atlasLoadPaths } from '../art/atlasManifest';
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
    this.scene.start(SCENE_KEYS.Menu);
  }
}
