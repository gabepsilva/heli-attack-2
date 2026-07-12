/**
 * Issue #33 acceptance: player animation frames match Flash hero gfx states
 * (idle / duck / jump / jump2 / walk) plus hurt + death, with exact frame ids.
 */

import { describe, expect, it } from 'vitest';
import { PLAYER_ANIM_FRAMES } from '../art/catalog';
import {
  PLAYER_WALK_HOLD_TICKS,
  advanceWalkTicks,
  playerAnimMoving,
  selectPlayerAnimFrame,
  walkPhaseFor,
  type PlayerAnimInput,
} from './playerAnim';

const base: PlayerAnimInput = {
  ducking: false,
  jump: false,
  jump2: false,
  moving: false,
  hurt: false,
  dead: false,
  walkPhase: 0,
};

describe('playerAnim (issue #33 — state → frame)', () => {
  it('maps Flash gfx frames 1–5 to the documented atlas ids', () => {
    // Frame 1 idle
    expect(selectPlayerAnimFrame(base)).toBe(PLAYER_ANIM_FRAMES.idle);
    expect(PLAYER_ANIM_FRAMES.idle).toBe('player_idle');

    // Frame 2 duck
    expect(selectPlayerAnimFrame({ ...base, ducking: true })).toBe(
      PLAYER_ANIM_FRAMES.duck,
    );
    expect(PLAYER_ANIM_FRAMES.duck).toBe('player_duck');

    // Frame 3 jump (first jump, jump2 unset)
    expect(selectPlayerAnimFrame({ ...base, jump: true, jump2: false })).toBe(
      PLAYER_ANIM_FRAMES.jump,
    );
    expect(PLAYER_ANIM_FRAMES.jump).toBe('player_jump');

    // Frame 5 double-jump
    expect(selectPlayerAnimFrame({ ...base, jump: true, jump2: true })).toBe(
      PLAYER_ANIM_FRAMES.jump2,
    );
    expect(PLAYER_ANIM_FRAMES.jump2).toBe('player_jump2');

    // Frame 4 walk cycle
    expect(PLAYER_ANIM_FRAMES.walk).toEqual(['player_step1', 'player_step2']);
    expect(selectPlayerAnimFrame({ ...base, moving: true, walkPhase: 0 })).toBe(
      'player_step1',
    );
    expect(selectPlayerAnimFrame({ ...base, moving: true, walkPhase: 1 })).toBe(
      'player_step2',
    );
  });

  it('prefers duck over jump (Flash: duck block after jump pre-set)', () => {
    expect(
      selectPlayerAnimFrame({
        ...base,
        ducking: true,
        jump: true,
        jump2: true,
      }),
    ).toBe('player_duck');
  });

  it('shows hurt during i-frames / hit flash, and death over everything', () => {
    expect(PLAYER_ANIM_FRAMES.hurt).toBe('player_hurt');
    expect(PLAYER_ANIM_FRAMES.death).toBe('player_death');

    expect(selectPlayerAnimFrame({ ...base, hurt: true })).toBe('player_hurt');
    expect(
      selectPlayerAnimFrame({
        ...base,
        hurt: true,
        ducking: true,
        jump: true,
        moving: true,
      }),
    ).toBe('player_hurt');

    expect(selectPlayerAnimFrame({ ...base, dead: true })).toBe('player_death');
    expect(
      selectPlayerAnimFrame({
        ...base,
        dead: true,
        hurt: true,
        ducking: true,
      }),
    ).toBe('player_death');
  });

  it('only accumulates walk ticks while moving, and folds a whole sim batch', () => {
    expect(advanceWalkTicks(7, false, 3)).toBe(7);
    expect(advanceWalkTicks(7, true, 0)).toBe(7);
    expect(advanceWalkTicks(7, true, 3)).toBe(10);
    // Standing still holds mid-stride rather than resetting the cycle.
    expect(walkPhaseFor(advanceWalkTicks(5, false, 9))).toBe(walkPhaseFor(5));
  });

  it('holds each walk bitmap for PLAYER_WALK_HOLD_TICKS before advancing', () => {
    expect(PLAYER_WALK_HOLD_TICKS).toBe(4);
    const cycle = PLAYER_WALK_HOLD_TICKS * PLAYER_ANIM_FRAMES.walk.length;
    for (let tick = 0; tick < PLAYER_WALK_HOLD_TICKS; tick += 1) {
      expect(walkPhaseFor(tick), `tick ${tick}`).toBe(0);
      expect(walkPhaseFor(tick + PLAYER_WALK_HOLD_TICKS), `tick ${tick}`).toBe(
        1,
      );
      // The cycle repeats rather than running off the end of the frame list.
      expect(walkPhaseFor(tick + cycle), `tick ${tick}`).toBe(0);
    }
  });

  it('treats any non-zero vx as Flash xchange != 0', () => {
    expect(playerAnimMoving(0)).toBe(false);
    expect(playerAnimMoving(1)).toBe(true);
    expect(playerAnimMoving(-5)).toBe(true);
  });
});
