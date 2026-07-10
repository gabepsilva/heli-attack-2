/**
 * Game state flow — unit tests for issue #24 acceptance criteria.
 *
 * AC: Every transition works (menu → play → pause → play → death → game over → restart/menu)
 * AC: Game-over shows the correct final score; restart resets cleanly
 */

import { describe, expect, it } from 'vitest';
import { GAME_FLOW, SCORE } from '../config/constants';
import { SCENE_KEYS } from '../config/scenes';
import {
  beginDeath,
  createGameFlowState,
  formatGameOverScore,
  gameFlowSpecSeeds,
  gameOverDisplayedScore,
  goToMenu,
  isGameOverReady,
  pauseGame,
  restartFromGameOver,
  resumeGame,
  startPlaying,
  tickDeath,
} from './gameFlow';

describe('gameFlow spec seeds (issue #24)', () => {
  it('locks death delay and pause key to exact Flash values', () => {
    const seeds = gameFlowSpecSeeds();
    expect(seeds.gameOverDelayFrames).toBe(200);
    expect(seeds.gameOverDelayFrames).toBe(GAME_FLOW.gameOverDelayFrames);
    expect(seeds.pauseKeyCode).toBe(80);
    expect(seeds.pauseKeyCode).toBe(GAME_FLOW.pauseKeyCode);
    expect(seeds.scoreDisplayScale).toBe(100);
    expect(seeds.scoreDisplayScale).toBe(SCORE.displayScale);
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
    expect(isGameOverReady(flow)).toBe(false);

    // Flash: `gameover > 200` — frames 1..200 stay dying; frame 201 opens stats.
    for (let i = 0; i < GAME_FLOW.gameOverDelayFrames; i += 1) {
      expect(tickDeath(flow)).toBe(false);
      expect(flow.phase).toBe('dying');
      expect(flow.gameOverFrames).toBe(i + 1);
    }

    expect(tickDeath(flow)).toBe(true);
    expect(flow.gameOverFrames).toBe(201);
    expect(flow.phase).toBe('gameOver');
    expect(isGameOverReady(flow)).toBe(true);
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

  it('rejects beginDeath from menu', () => {
    const flow = createGameFlowState('menu');
    expect(beginDeath(flow, 1)).toBe(false);
    expect(flow.phase).toBe('menu');
  });

  it('paused → dying is allowed (death while overlay open)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    pauseGame(flow);
    expect(beginDeath(flow, 5)).toBe(true);
    expect(flow.phase).toBe('dying');
  });

  it('gameOver → restart → playing clears death state', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 77);
    for (let i = 0; i <= GAME_FLOW.gameOverDelayFrames; i += 1) {
      tickDeath(flow);
    }
    expect(flow.phase).toBe('gameOver');

    restartFromGameOver(flow);
    expect(flow.phase).toBe('playing');
    expect(flow.gameOverFrames).toBe(0);
    expect(flow.finalScore).toBe(0);
  });

  it('any phase → menu clears counters (AC: restart / menu resets cleanly)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 50);
    tickDeath(flow);
    goToMenu(flow);
    expect(flow.phase).toBe('menu');
    expect(flow.gameOverFrames).toBe(0);
    expect(flow.finalScore).toBe(0);
  });

  it('full loop: menu → play → pause → resume → death → gameOver → menu → play', () => {
    const flow = createGameFlowState('menu');

    startPlaying(flow);
    pauseGame(flow);
    resumeGame(flow);
    beginDeath(flow, 12.4);
    for (let i = 0; i <= GAME_FLOW.gameOverDelayFrames; i += 1) {
      tickDeath(flow);
    }
    expect(flow.phase).toBe('gameOver');
    expect(gameOverDisplayedScore(flow.finalScore)).toBe(1200);

    goToMenu(flow);
    startPlaying(flow);
    expect(flow.phase).toBe('playing');
    expect(flow.finalScore).toBe(0);
  });
});

describe('game-over score display (issue #24 AC: correct final score)', () => {
  it('uses Flash Math.floor(score)*100 for the game-over readout', () => {
    expect(gameOverDisplayedScore(0)).toBe(0);
    expect(gameOverDisplayedScore(1)).toBe(100);
    expect(gameOverDisplayedScore(10.9)).toBe(1000);
    expect(gameOverDisplayedScore(42.7)).toBe(4200);
    expect(formatGameOverScore(42.7)).toBe('Final Score: 4200');
    expect(formatGameOverScore(0)).toBe('Final Score: 0');
  });

  it('freezes the internal score at beginDeath (later sim changes ignored)', () => {
    const flow = createGameFlowState();
    startPlaying(flow);
    beginDeath(flow, 33.3);
    // Sim might keep ticking score elsewhere — flow keeps the snapshot.
    expect(flow.finalScore).toBe(33.3);
    expect(formatGameOverScore(flow.finalScore)).toBe('Final Score: 3300');
  });
});
