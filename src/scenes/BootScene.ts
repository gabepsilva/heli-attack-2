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
        'Press SPACE or click to start (unlocks audio)',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '32px',
          color: '#aaaaaa',
        },
      )
      .setOrigin(0.5);

    const startGame = (): void => {
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

    this.input.keyboard?.once('keydown-SPACE', startGame);
    this.input.once('pointerdown', startGame);
  }
}
