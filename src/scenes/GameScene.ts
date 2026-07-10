import Phaser from 'phaser';
import { SIM_HZ } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { FixedTimestepAccumulator } from '../core/fixedTimestep';
import { applyMotion, TimeScale } from '../core/timeScale';

const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '28px',
  color: '#e8e8e8',
};

/** Demo entity speed in px/sim-frame (walk-cap style) to show timeStep scaling. */
const DEMO_SPEED = 5;

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim and shows
 * an on-screen tick-rate counter so refresh rate independence is visible.
 */
export class GameScene extends Phaser.Scene {
  private readonly accumulator = new FixedTimestepAccumulator();
  private readonly timeScale = new TimeScale();

  private simTickCount = 0;
  private ticksThisSecond = 0;
  private secondTimerMs = 0;
  private displayedSimRate = 0;

  /** Demo entity position — proves `timeStep` scales motion. */
  private demoX = 0;

  private rateText!: Phaser.GameObjects.Text;
  private timeStepText!: Phaser.GameObjects.Text;
  private demoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  create(): void {
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
      this.timeScale.setTimeStep(1);
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      this.timeScale.setTimeStep(0.5);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.Boot);
    });
  }

  update(_time: number, delta: number): void {
    const steps = this.accumulator.advance(delta / 1000);

    for (let i = 0; i < steps; i += 1) {
      this.simTick();
    }

    this.secondTimerMs += delta;
    if (this.secondTimerMs >= 1000) {
      this.displayedSimRate =
        this.ticksThisSecond / (this.secondTimerMs / 1000);
      this.ticksThisSecond = 0;
      this.secondTimerMs = 0;
    }

    this.rateText.setText(
      `Sim rate: ${this.displayedSimRate.toFixed(1)} /s  (target ${SIM_HZ})`,
    );
    this.timeStepText.setText(
      `timeStep: ${this.timeScale.timeStep.toFixed(2)}`,
    );
    this.demoText.setText(
      `demo x (speed ${DEMO_SPEED}×timeStep): ${this.demoX.toFixed(1)}`,
    );
  }

  private simTick(): void {
    this.simTickCount += 1;
    this.ticksThisSecond += 1;
    // Constant DEMO_SPEED px/frame — halves when timeStep is 0.5.
    this.demoX = applyMotion(this.demoX, DEMO_SPEED, this.timeScale.timeStep);
  }

  /** Exposed for tests / debugging. */
  getSimTickCount(): number {
    return this.simTickCount;
  }
}
