/**
 * Menu → play → pause → game-over session loop — issue #24.
 *
 * Pure logic (no Phaser). Scenes call these transitions; unit tests assert
 * acceptance criteria and exact Flash timing / score display values.
 *
 * Flash references:
 *   gameover++ while dead; stats when `gameover > 200`
 *   temp.score = Math.floor(score)*100
 *   pauseKey toggles onEnterFrame; menu via gotoAndStop("menu")
 */

import { GAME_FLOW, SCORE } from '../config/constants';
import { displayedScore } from '../combat/score';

/** High-level session phases driven by scene transitions. */
export type GameFlowPhase =
  'menu' | 'playing' | 'paused' | 'dying' | 'gameOver';

export type GameFlowState = {
  phase: GameFlowPhase;
  /**
   * Flash `gameover` counter — sim frames since death began.
   * Stats screen when `gameOverFrames > GAME_FLOW.gameOverDelayFrames`.
   */
  gameOverFrames: number;
  /** Internal score frozen at death (Flash `score`, not ×100). */
  finalScore: number;
};

/** Data handed to GameOverScene via `scene.start(key, data)`. */
export type GameOverSceneData = {
  finalScore: number;
};

export function createGameFlowState(
  phase: GameFlowPhase = 'menu',
): GameFlowState {
  return {
    phase,
    gameOverFrames: 0,
    finalScore: 0,
  };
}

/** Menu / restart → gameplay. Clears death counters. */
export function startPlaying(state: GameFlowState): void {
  state.phase = 'playing';
  state.gameOverFrames = 0;
  state.finalScore = 0;
}

/** Playing → paused. Returns false if not currently playing. */
export function pauseGame(state: GameFlowState): boolean {
  if (state.phase !== 'playing') {
    return false;
  }
  state.phase = 'paused';
  return true;
}

/** Paused → playing. Returns false if not paused. */
export function resumeGame(state: GameFlowState): boolean {
  if (state.phase !== 'paused') {
    return false;
  }
  state.phase = 'playing';
  return true;
}

/**
 * Begin the death sequence (Flash `gameover` path).
 * Freezes `finalScore` for the game-over screen. Idempotent while dying.
 */
export function beginDeath(state: GameFlowState, score: number): boolean {
  if (state.phase === 'dying' || state.phase === 'gameOver') {
    return false;
  }
  if (state.phase !== 'playing' && state.phase !== 'paused') {
    return false;
  }
  state.phase = 'dying';
  state.gameOverFrames = 0;
  state.finalScore = score;
  return true;
}

/**
 * Advance the Flash `gameover` counter by one sim frame.
 * Returns true the first tick that crosses into the game-over screen
 * (`gameover > 200`).
 */
export function tickDeath(state: GameFlowState): boolean {
  if (state.phase !== 'dying') {
    return false;
  }
  state.gameOverFrames += 1;
  if (state.gameOverFrames > GAME_FLOW.gameOverDelayFrames) {
    state.phase = 'gameOver';
    return true;
  }
  return false;
}

/** True once death delay has elapsed (ready to show GameOverScene). */
export function isGameOverReady(state: Readonly<GameFlowState>): boolean {
  return state.phase === 'gameOver';
}

/** Any screen → main menu. */
export function goToMenu(state: GameFlowState): void {
  state.phase = 'menu';
  state.gameOverFrames = 0;
  state.finalScore = 0;
}

/** Game-over → fresh run (same as startPlaying). */
export function restartFromGameOver(state: GameFlowState): void {
  startPlaying(state);
}

/** Flash HUD / stats numeric: `Math.floor(score) * 100`. */
export function gameOverDisplayedScore(internalScore: number): number {
  return displayedScore(internalScore);
}

/** Label for the game-over screen. */
export function formatGameOverScore(internalScore: number): string {
  return `Final Score: ${gameOverDisplayedScore(internalScore)}`;
}

/** Spec seeds the session loop depends on (exact Flash values). */
export function gameFlowSpecSeeds() {
  return {
    gameOverDelayFrames: GAME_FLOW.gameOverDelayFrames,
    pauseKeyCode: GAME_FLOW.pauseKeyCode,
    scoreDisplayScale: SCORE.displayScale,
  };
}
