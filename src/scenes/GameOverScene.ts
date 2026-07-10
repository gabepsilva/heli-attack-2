import Phaser from 'phaser';
import { formatGameOverScore, type GameOverSceneData } from '../core/gameFlow';
import {
  accuracyPercent,
  formatHighScoreTableText,
  formatRunStatsLine,
  submitRunScore,
} from '../core/highScores';
import { BOOT_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';

/**
 * Game-over screen — issues #24 / #25.
 * Shows Flash-scaled final score, records the run into the local high-score
 * table, and lists the persisted rankings. Restart starts a clean run; Menu
 * returns home.
 */
export class GameOverScene extends Phaser.Scene {
  private finalScore = 0;
  private helisKilled = 0;
  private shots = 0;
  private hits = 0;

  constructor() {
    super({ key: SCENE_KEYS.GameOver });
  }

  init(data: GameOverSceneData): void {
    this.finalScore =
      typeof data?.finalScore === 'number' && Number.isFinite(data.finalScore)
        ? data.finalScore
        : 0;
    this.helisKilled =
      typeof data?.helisKilled === 'number' && Number.isFinite(data.helisKilled)
        ? Math.max(0, Math.floor(data.helisKilled))
        : 0;
    this.shots =
      typeof data?.shots === 'number' && Number.isFinite(data.shots)
        ? Math.max(0, Math.floor(data.shots))
        : 0;
    this.hits =
      typeof data?.hits === 'number' && Number.isFinite(data.hits)
        ? Math.max(0, Math.floor(data.hits))
        : 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    const submitted = submitRunScore({
      score: this.finalScore,
      helisKilled: this.helisKilled,
      shots: this.shots,
      hits: this.hits,
    });
    const table = submitted.table;
    const accuracy = accuracyPercent(this.hits, this.shots);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 280, 'GAME OVER', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ff6b6b',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 160,
        formatGameOverScore(this.finalScore),
        {
          fontFamily: 'monospace',
          fontSize: '64px',
          color: '#f5f5f5',
        },
      )
      .setOrigin(0.5);

    if (submitted.isNewRecord) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, 'NEW HIGH SCORE!', {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#ffe066',
        })
        .setOrigin(0.5);
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 30,
        formatRunStatsLine(this.helisKilled, accuracy),
        {
          fontFamily: 'monospace',
          fontSize: '32px',
          color: '#aaaaaa',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'HIGH SCORES', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#c9ada7',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 90,
        formatHighScoreTableText(table),
        {
          fontFamily: 'monospace',
          fontSize: '28px',
          color: '#f5f5f5',
          align: 'center',
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 140, 'R / Space / click — restart', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'M — main menu', {
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
