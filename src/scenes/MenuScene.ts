import Phaser from 'phaser';
import { AUDIO_TEST_SFX_ID } from '../config/audio';
import {
  BOOT_BACKGROUND_COLOR,
  BOOT_TITLE,
  BOOT_TITLE_STYLE,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { getGameAudio } from '../audio/gameAudio';

/**
 * Main menu — issue #24.
 * Boot loads assets then lands here; Space / click starts a fresh run
 * and unlocks audio on that user gesture.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Menu });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, BOOT_TITLE, BOOT_TITLE_STYLE)
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'START', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 120,
        'Press SPACE or click to play',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '32px',
          color: '#aaaaaa',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 80,
        'In game: P / Esc pause · die for game over',
        {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#6a7a8a',
        },
      )
      .setOrigin(0.5);

    const start = (): void => {
      const audio = getGameAudio();
      void audio.unlock().then(async () => {
        try {
          await audio.load(AUDIO_TEST_SFX_ID);
        } catch {
          // Demo still runs if a format fails; GameScene will retry.
        }
        this.scene.start(SCENE_KEYS.Game);
      });
    };

    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }
}
