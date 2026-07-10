/**
 * Arcade score — Flash `score += damage` on every bullet hit.
 * HUD shows `Score: ${Math.floor(score) * displayScale}` (×100).
 */

import { SCORE } from '../config/constants';

export type ScoreState = {
  /** Internal damage-points total (Flash `score`). */
  value: number;
};

export function createScoreState(initial = 0): ScoreState {
  return { value: initial };
}

/** Add damage dealt this hit (Flash `score += this.damage`). */
export function addDamageScore(score: ScoreState, damage: number): void {
  if (damage <= 0) {
    return;
  }
  score.value += damage;
}

/** Flash HUD numeric value: `Math.floor(score) * 100`. */
export function displayedScore(score: number): number {
  return Math.floor(score) * SCORE.displayScale;
}

/** Flash: `HUD.score = "Score: " + (Math.floor(score) * 100)`. */
export function formatScoreHud(score: number): string {
  return `Score: ${displayedScore(score)}`;
}
