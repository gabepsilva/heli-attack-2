import Phaser from 'phaser';
import { formatGameOverScore, type GameOverSceneData } from '../core/gameFlow';
import { BOOT_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';

/**
 * Game-over screen — issue #24.
 * Shows Flash-scaled final score; Restart starts a clean run, Menu returns home.
 */
export class GameOverScene extends Phaser.Scene {
  private finalScore = 0;

  constructor() {
    super({ key: SCENE_KEYS.GameOver });
  }

  init(data: GameOverSceneData): void {
    this.finalScore =
      typeof data?.finalScore === 'number' && Number.isFinite(data.finalScore)
        ? data.finalScore
        : 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'GAME OVER', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ff6b6b',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        formatGameOverScore(this.finalScore),
        {
          fontFamily: 'monospace',
          fontSize: '64px',
          color: '#f5f5f5',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 120,
        'R / Space / click — restart',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '36px',
          color: '#cccccc',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 180, 'M — main menu', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const restart = (): void => {
      this.scene.start(SCENE_KEYS.Game);
    };

    const toMenu = (): void => {
      this.scene.start(SCENE_KEYS.Menu);
    };

    this.input.keyboard?.once('keydown-R', restart);
    this.input.keyboard?.once('keydown-SPACE', restart);
    this.input.keyboard?.once('keydown-M', toMenu);
    this.input.once('pointerdown', restart);
  }
}
