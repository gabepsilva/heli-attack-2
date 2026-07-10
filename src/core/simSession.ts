import { FixedTimestepAccumulator } from './fixedTimestep';
import { applyMotion, TimeScale } from './timeScale';

/** Demo entity speed in px/sim-frame (walk-cap style) to show timeStep scaling. */
export const DEMO_SPEED = 5;

/**
 * Per-run sim state for GameScene: fixed-step accumulator, timeStep, and
 * HUD counters. Lives outside Phaser so scene restarts and the update loop
 * are unit-testable (Phaser reuses the scene instance; only create() re-runs).
 */
export class SimSession {
  readonly accumulator = new FixedTimestepAccumulator();
  readonly timeScale = new TimeScale();

  simTickCount = 0;
  ticksThisSecond = 0;
  secondTimerMs = 0;
  displayedSimRate = 0;

  /** Demo entity position — proves `timeStep` scales motion. */
  demoX = 0;

  /** Clear all per-run state — call from GameScene.create() on every start. */
  reset(): void {
    this.accumulator.reset();
    this.timeScale.reset();
    this.simTickCount = 0;
    this.ticksThisSecond = 0;
    this.secondTimerMs = 0;
    this.displayedSimRate = 0;
    this.demoX = 0;
  }

  /**
   * Drive one render frame. `deltaMs` is Phaser's update delta (milliseconds);
   * converted to seconds for the accumulator.
   */
  update(deltaMs: number): void {
    const steps = this.accumulator.advance(deltaMs / 1000);

    for (let i = 0; i < steps; i += 1) {
      this.simTick();
    }

    this.secondTimerMs += deltaMs;
    if (this.secondTimerMs >= 1000) {
      this.displayedSimRate =
        this.ticksThisSecond / (this.secondTimerMs / 1000);
      this.ticksThisSecond = 0;
      this.secondTimerMs = 0;
    }
  }

  private simTick(): void {
    this.simTickCount += 1;
    this.ticksThisSecond += 1;
    this.demoX = applyMotion(this.demoX, DEMO_SPEED, this.timeScale.timeStep);
  }
}
