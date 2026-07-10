/**
 * Menu → play → pause → game-over session loop — issue #24.
 *
 * Pure logic (no Phaser). Scenes call these transitions; unit tests assert
 * acceptance criteria and exact Flash timing / score display values.
 *
 * Flash references:
 *   gameover++ while dead; stats when `gameover > 200`
 *   (Flash also early-outs when enemyArray/entityArray are empty — not ported;
 *   the treadmill keeps helis spawning, so the 200-frame path is the real one.)
 *   temp.score = Math.floor(score)*100
 *   pauseKey toggles onEnterFrame; menu via gotoAndStop("menu")
 *
 * Shipped scene wiring (do not invent parallel helpers for these):
 *   Menu → Game: scene.start(Game) → create() → startPlaying + session.reset
 *   Pause resume: scene.resume(Game) → RESUME → resumeGame
 *   Pause/GameOver → Menu: scene.start(Menu) (next Game create() re-seeds flow)
 *   GameOver restart: scene.start(Game) → create() → startPlaying + session.reset
 */

import { GAME_FLOW } from '../config/constants';
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
  /**
   * Internal score frozen at death for the game-over screen.
   * (Flash reads score at stats time; we snapshot so in-flight hits after death
   * cannot desync the banner from what the player saw when they died.)
   */
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

/**
 * Enter gameplay. Called from GameScene.create() on every start/restart —
 * that is the shipped reset path (with session.reset()).
 */
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
 * Only from `playing` — a paused GameScene does not run update(), so death
 * while paused cannot occur. Freezes `finalScore` for GameOverScene.
 */
export function beginDeath(state: GameFlowState, score: number): boolean {
  if (state.phase !== 'playing') {
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

/** Label for the game-over screen — Flash `Math.floor(score)*100`. */
export function formatGameOverScore(internalScore: number): string {
  return `Final Score: ${displayedScore(internalScore)}`;
}
