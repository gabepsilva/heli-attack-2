/**
 * Smoke-trail tick helper (issue #35) — Flash `!(r%N)` on rocket frames.
 */

/**
 * True when a projectile with `interval` sim-frame cadence should emit a
 * smoke puff after advancing `age` by `timeStep`.
 */
export function shouldEmitSmokeTrail(
  age: number,
  timeStep: number,
  interval: number,
): boolean {
  if (interval <= 0 || timeStep <= 0) {
    return false;
  }
  const prev = age - timeStep;
  if (prev < 0) {
    return false;
  }
  return Math.floor(age / interval) > Math.floor(prev / interval);
}
