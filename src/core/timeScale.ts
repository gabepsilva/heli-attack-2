import { WORLD } from '../config/constants';

/**
 * Global per-frame time-scale (`timeStep`) applied to entity motion.
 * Default 1; bullet-time eases toward 0.2, TimeRift reuses the same path.
 */
export class TimeScale {
  private _timeStep: number = WORLD.timeStep;

  get timeStep(): number {
    return this._timeStep;
  }

  setTimeStep(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('timeStep must be a finite non-negative number');
    }
    this._timeStep = value;
  }

  reset(): void {
    this._timeStep = WORLD.timeStep;
  }
}

/**
 * Advance a 1D position by `speed` px/frame, scaled by `timeStep`.
 * All entity motion should go through this (or an equivalent multiply).
 */
export function applyMotion(
  position: number,
  speed: number,
  timeStep: number,
): number {
  return position + speed * timeStep;
}
