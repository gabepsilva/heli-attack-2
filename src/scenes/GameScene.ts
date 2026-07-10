import Phaser from 'phaser';
import { SIM_HZ } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { DEMO_SPEED, SimSession } from '../core/simSession';

const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '28px',
  color: '#e8e8e8',
};

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim and shows
 * an on-screen tick-rate counter so refresh rate independence is visible.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();

  private rateText!: Phaser.GameObjects.Text;
  private timeStepText!: Phaser.GameObjects.Text;
  private demoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  create(): void {
    // Phaser reuses this instance across scene.start — only create() re-runs.
    this.session.reset();

    this.cameras.main.setBackgroundColor('#0d1b2a');

    this.add
      .text(GAME_WIDTH / 2, 80, 'GameScene — fixed 30 Hz sim', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '48px',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.rateText = this.add.text(40, 160, '', HUD_STYLE);
    this.timeStepText = this.add.text(40, 200, '', HUD_STYLE);
    this.demoText = this.add.text(40, 240, '', HUD_STYLE);

    this.add.text(
      40,
      GAME_HEIGHT - 80,
      'Press 1 / 2 to set timeStep to 1.0 / 0.5  ·  Esc → BootScene',
      { ...HUD_STYLE, fontSize: '22px', color: '#9ab' },
    );

    this.input.keyboard?.on('keydown-ONE', () => {
      this.session.timeScale.setTimeStep(1);
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      this.session.timeScale.setTimeStep(0.5);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.Boot);
    });
  }

  update(_time: number, delta: number): void {
    this.session.update(delta);

    this.rateText.setText(
      `Sim rate: ${this.session.displayedSimRate.toFixed(1)} /s  (target ${SIM_HZ})`,
    );
    this.timeStepText.setText(
      `timeStep: ${this.session.timeScale.timeStep.toFixed(2)}`,
    );
    this.demoText.setText(
      `demo x (speed ${DEMO_SPEED}×timeStep): ${this.session.demoX.toFixed(1)}`,
    );
  }
}
