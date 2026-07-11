import { describe, expect, it } from 'vitest';
import { PLAYER, WORLD } from '../config/constants';
import { createLevel1 } from '../world/level1';
import {
  PLAYER_PARACHUTE,
  beginParachuteIntro,
  completeParachuteIntro,
  createParachuteIntroState,
  stepParachuteIntro,
} from './parachuteIntro';
import { Player } from './player';

describe('parachuteIntro (Flash heroStart)', () => {
  it('locks chute tunables to the decompiled heroStart values', () => {
    expect(PLAYER_PARACHUTE).toEqual({
      chuteFallSpeed: 2,
      fallBoost: 5,
      chuteScaleRate: 10,
      chuteScaleMax: 100,
      groundLookaheadTiles: 5,
      spawnY: -50,
    });
  });

  it('opens the chute while descending slowly from spawn', () => {
    const map = createLevel1();
    const player = new Player(20, PLAYER_PARACHUTE.spawnY);
    player.beginParachute();

    const y0 = player.body.y;
    player.step(map, 1);

    expect(player.parachuting).toBe(true);
    expect(player.parachute.chuteScale).toBe(PLAYER_PARACHUTE.chuteScaleRate);
    expect(player.body.y).toBe(
      y0 + PLAYER_PARACHUTE.chuteFallSpeed + PLAYER_PARACHUTE.fallBoost,
    );
    expect(player.body.vx).toBe(0);
  });

  it('collapses the chute near ground then hands off to heroAction', () => {
    const map = createLevel1();
    const player = new Player(20, PLAYER_PARACHUTE.spawnY);
    player.beginParachute();

    let finished = false;
    for (let i = 0; i < 200; i += 1) {
      const wasActive = player.parachuting;
      player.step(map, 1);
      if (wasActive && !player.parachuting) {
        finished = true;
        break;
      }
    }

    expect(finished).toBe(true);
    expect(player.parachute.chuteScale).toBe(0);
    expect(player.parachute.fall).toBe(false);
    // Still airborne after handoff — normal gravity takes over next tick.
    expect(player.body.onGround).toBe(false);
    expect(player.body.y).toBeGreaterThan(300);
  });

  it('trips fall when a solid is 5 tiles below the 48px clip feet', () => {
    const map = createLevel1();
    const state = createParachuteIntroState(true);
    // Feet at spriteH below body.y; lookRow = footRow + 5 must hit ground row 14.
    // footRow = 9 → lookRow 14. body.y + 48 >= 9*50 → body.y >= 402.
    const body = {
      x: 20,
      y: 402,
      w: PLAYER.boxW,
      h: PLAYER.boxH,
      vx: 0,
      vy: 0,
      onGround: false,
      onCeiling: false,
    };

    // Open chute fully first.
    state.chuteScale = 100;
    stepParachuteIntro(state, body, map, 1);
    expect(state.fall).toBe(true);

    // Collapse over 10 ticks at rate 10.
    for (let i = 0; i < 9; i += 1) {
      expect(stepParachuteIntro(state, body, map, 1)).toBe(false);
      expect(state.active).toBe(true);
    }
    expect(stepParachuteIntro(state, body, map, 1)).toBe(true);
    expect(state.active).toBe(false);
    expect(state.chuteScale).toBe(0);
  });

  it('completeParachuteIntro clears state for tests / teleports', () => {
    const state = createParachuteIntroState(true);
    state.fall = true;
    state.chuteScale = 40;
    completeParachuteIntro(state);
    expect(state).toEqual({
      active: false,
      fall: false,
      chuteScale: 0,
    });
    beginParachuteIntro(state);
    expect(state.active).toBe(true);
  });

  it('uses WORLD.tile for the lookahead probe (5 tiles = 250px)', () => {
    expect(PLAYER_PARACHUTE.groundLookaheadTiles * WORLD.tile).toBe(250);
  });
});
