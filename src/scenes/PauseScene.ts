import Phaser from 'phaser';
import { GAME_FLOW } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';

/**
 * Pause overlay — issue #24.
 * Launched while GameScene is paused; Resume continues, Menu returns to title.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Pause });
  }

  create(): void {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, 'PAUSED', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'P / Esc / Space — resume', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, 'M — main menu', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const resume = (): void => {
      this.scene.stop(SCENE_KEYS.Pause);
      this.scene.resume(SCENE_KEYS.Game);
    };

    const toMenu = (): void => {
      this.scene.stop(SCENE_KEYS.Pause);
      this.scene.stop(SCENE_KEYS.Game);
      this.scene.start(SCENE_KEYS.Menu);
    };

    // addKey respects emitOnRepeat=false — avoids OS key-repeat strobing pause.
    const pauseKey = this.input.keyboard!.addKey(GAME_FLOW.pauseKeyCode);
    pauseKey.on('down', resume);
    this.input
      .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', resume);
    this.input
      .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', resume);
    this.input
      .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)
      .on('down', toMenu);
    this.input.once('pointerdown', resume);
  }
}
