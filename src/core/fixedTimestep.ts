import { SIM_DT } from '../config/constants';

/**
 * Frame-rate-independent fixed-update accumulator.
 * Wall-clock deltas (any refresh rate) are banked and spent in {@link SIM_DT} chunks
 * so the sim always advances at a steady {@link SIM_HZ} ticks per real second.
 */
export class FixedTimestepAccumulator {
  private accumulator = 0;

  constructor(
    private readonly stepSeconds: number = SIM_DT,
    /** Cap steps per render frame to avoid spiral-of-death on long stalls. */
    private readonly maxStepsPerFrame: number = 5,
  ) {
    if (stepSeconds <= 0) {
      throw new Error('stepSeconds must be positive');
    }
    if (maxStepsPerFrame < 1) {
      throw new Error('maxStepsPerFrame must be at least 1');
    }
  }

  /** Bank `deltaSeconds` of wall time and return how many sim ticks to run. */
  advance(deltaSeconds: number): number {
    // NaN < 0 is false — reject non-finite so a bad delta cannot poison the bank.
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      return 0;
    }

    this.accumulator += deltaSeconds;
    let steps = 0;

    while (
      this.accumulator >= this.stepSeconds &&
      steps < this.maxStepsPerFrame
    ) {
      this.accumulator -= this.stepSeconds;
      steps += 1;
    }

    // Drop excess so a hitch cannot queue unbounded catch-up.
    if (
      steps === this.maxStepsPerFrame &&
      this.accumulator >= this.stepSeconds
    ) {
      this.accumulator = 0;
    }

    return steps;
  }

  /** Unspent wall time waiting for the next full sim tick. */
  get leftoverSeconds(): number {
    return this.accumulator;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
