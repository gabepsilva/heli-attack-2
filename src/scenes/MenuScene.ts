import Phaser from 'phaser';
import { BG_IMAGE_KEY, TITLE_IMAGE_KEY } from '../config/art';
import { BOOT_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { getGameAudio } from '../audio/gameAudio';
import {
  formatHighScoreHud,
  formatHighScoreTableText,
  loadHighScores,
} from '../core/highScores';

/**
 * Main menu — issues #24 / #25 / #27.
 * Boot loads assets then lands here; Space / click starts a fresh run,
 * unlocks audio, and preloads the full SFX/music catalog. Shows Flash
 * `bg.png` + transparent `title.png` stacked (original intro/menu plates),
 * a dark text panel (Flash menu button backs), and the local high-score table.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Menu });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);

    const table = loadHighScores();

    // Flash intro/menu: full-bleed desert plate, then title overlay on top.
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_IMAGE_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-11);
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TITLE_IMAGE_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10);

    // Flash menu buttons sat on near-black backs (SWF DefineBitsLossless2
    // id419/id427 — solid black with soft alpha edges). One panel behind our
    // text stack keeps START / scores readable over the bright desert + heli.
    this.add
      .rectangle(GAME_WIDTH / 2, 520, 720, 560, 0x000000, 0.55)
      .setDepth(-5);

    this.add
      .text(GAME_WIDTH / 2, 280, 'START', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 360, 'Press SPACE or click to play', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 460, formatHighScoreHud(table.stats.bestScore), {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffe066',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 530, 'HIGH SCORES', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#c9ada7',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 580, formatHighScoreTableText(table), {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f5f5f5',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 80,
        'F fullscreen · Phone: landscape + on-screen sticks · P / Esc pause',
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
          await audio.loadAll();
        } catch {
          // GameScene retries; partial loads still unlock the bus.
        }
        this.scene.start(SCENE_KEYS.Game);
      });
    };

    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }
}
