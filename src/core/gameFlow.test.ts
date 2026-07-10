/**
 * Game state flow — unit tests for issue #24 acceptance criteria.
 *
 * AC: Every transition works (menu → play → pause → play → death → game over → restart)
 * AC: Game-over shows the correct final score; restart resets cleanly
 *
 * Restart/menu in the shipped game are scene transitions that re-enter
 * GameScene.create() → startPlaying() + session.reset() — tests assert that
 * path, not parallel helpers the scenes never call.
 */

import { describe, expect, it } from 'vitest';
import { GAME_FLOW, SCORE } from '../config/constants';
import { SCENE_KEYS } from '../config/scenes';
import { displayedScore } from '../combat/score';
import {
  beginDeath,
  createGameFlowState,
  formatGameOverScore,
  pauseGame,
  resumeGame,
  startPlaying,
  tickDeath,
} from './gameFlow';

describe('gameFlow Flash constants (issue #24)', () => {
  it('locks death delay to Flash `gameover > 200`', () => {
    expect(GAME_FLOW.gameOverDelayFrames).toBe(200);
  });

  it('locks pause key to Flash pauseKey = 80 (P) for scene addKey binding', () => {
    expect(GAME_FLOW.pauseKeyCode).toBe(80);
  });

  it('registers Boot → Menu → Game ↔ Pause → GameOver scene keys', () => {
    expect(SCENE_KEYS).toEqual({
      Boot: 'BootScene',
      Menu: 'MenuScene',
      Game: 'GameScene',
      Pause: 'PauseScene',
      GameOver: 'GameOverScene',
    });
  });
});

describe('session transitions (issue #24 AC: every transition works)', () => {
  it('menu → playing → paused → playing', () => {
    const flow = createGameFlowState('menu');
    expect(flow.phase).toBe('menu');

    startPlaying(flow);
    expect(flow.phase).toBe('playing');

    expect(pauseGame(flow)).toBe(true);
    expect(flow.phase).toBe('paused');

    expect(resumeGame(flow)).toBe(true);
    expect(flow.phase).toBe('playing');
  });

  it('rejects pause/resume outside their valid phases', () => {
    const flow = createGameFlowState('menu');
    expect(pauseGame(flow)).toBe(false);
    expect(resumeGame(flow)).toBe(false);

    startPlaying(flow);
    expect(resumeGame(flow)).toBe(false);

    pauseGame(flow);
    expect(pauseGame(flow)).toBe(false);
  });

  it('playing → dying → gameOver after exactly Flash delay (> 200 frames)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);

    expect(beginDeath(flow, 42.7)).toBe(true);
    expect(flow.phase).toBe('dying');
    expect(flow.finalScore).toBe(42.7);
    expect(flow.gameOverFrames).toBe(0);

    // Flash: `gameover > 200` — frames 1..200 stay dying; frame 201 opens stats.
    for (let i = 0; i < GAME_FLOW.gameOverDelayFrames; i += 1) {
      expect(tickDeath(flow)).toBe(false);
      expect(flow.phase).toBe('dying');
      expect(flow.gameOverFrames).toBe(i + 1);
    }

    expect(tickDeath(flow)).toBe(true);
    expect(flow.gameOverFrames).toBe(201);
    expect(flow.phase).toBe('gameOver');
  });

  it('beginDeath is idempotent while dying / gameOver', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 10);
    expect(beginDeath(flow, 999)).toBe(false);
    expect(flow.finalScore).toBe(10);

    for (let i = 0; i <= GAME_FLOW.gameOverDelayFrames; i += 1) {
      tickDeath(flow);
    }
    expect(flow.phase).toBe('gameOver');
    expect(beginDeath(flow, 1)).toBe(false);
    expect(tickDeath(flow)).toBe(false);
  });

  it('rejects beginDeath from menu or paused (paused GameScene does not update)', () => {
    const menu = createGameFlowState('menu');
    expect(beginDeath(menu, 1)).toBe(false);
    expect(menu.phase).toBe('menu');

    const flow = createGameFlowState();
    startPlaying(flow);
    pauseGame(flow);
    expect(beginDeath(flow, 5)).toBe(false);
    expect(flow.phase).toBe('paused');
  });

  it('startPlaying after gameOver clears death state (GameScene.create on restart)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 77);
    for (let i = 0; i <= GAME_FLOW.gameOverDelayFrames; i += 1) {
      tickDeath(flow);
    }
    expect(flow.phase).toBe('gameOver');

    // Shipped restart: GameOverScene → scene.start(Game) → create() → startPlaying.
    startPlaying(flow);
    expect(flow.phase).toBe('playing');
    expect(flow.gameOverFrames).toBe(0);
    expect(flow.finalScore).toBe(0);
  });

  it('full loop: play → pause → resume → death → gameOver → startPlaying restart', () => {
    const flow = createGameFlowState('menu');

    startPlaying(flow);
    pauseGame(flow);
    resumeGame(flow);
    beginDeath(flow, 12.4);
    for (let i = 0; i <= GAME_FLOW.gameOverDelayFrames; i += 1) {
      tickDeath(flow);
    }
    expect(flow.phase).toBe('gameOver');
    expect(displayedScore(flow.finalScore)).toBe(1200);
    expect(formatGameOverScore(flow.finalScore)).toBe('Final Score: 1200');

    startPlaying(flow);
    expect(flow.phase).toBe('playing');
    expect(flow.finalScore).toBe(0);
  });
});

describe('game-over score display (issue #24 AC: correct final score)', () => {
  it('uses Flash Math.floor(score)*100 via displayedScore', () => {
    expect(SCORE.displayScale).toBe(100);
    expect(displayedScore(0)).toBe(0);
    expect(displayedScore(1)).toBe(100);
    expect(displayedScore(10.9)).toBe(1000);
    expect(displayedScore(42.7)).toBe(4200);
    expect(formatGameOverScore(42.7)).toBe('Final Score: 4200');
    expect(formatGameOverScore(0)).toBe('Final Score: 0');
  });

  it('freezes the internal score at beginDeath (later sim changes ignored)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 33.3);
    expect(flow.finalScore).toBe(33.3);
    expect(formatGameOverScore(flow.finalScore)).toBe('Final Score: 3300');
  });
});
