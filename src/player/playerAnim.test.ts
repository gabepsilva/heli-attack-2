/**
 * Issue #33 acceptance: player animation frames match Flash hero gfx states
 * (idle / duck / jump / jump2 / walk) plus hurt + death, with exact frame ids.
 */

import { describe, expect, it } from 'vitest';
import { PLAYER_ANIM_FRAMES } from '../art/catalog';
import {
  advanceWalkPhase,
  playerAnimMoving,
  selectPlayerAnimFrame,
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

  it('advances the 2-frame walk cycle only on move ticks while moving', () => {
    expect(advanceWalkPhase(0, false, true)).toBe(0);
    expect(advanceWalkPhase(0, true, false)).toBe(0);
    expect(advanceWalkPhase(0, true, true)).toBe(1);
    expect(advanceWalkPhase(1, true, true)).toBe(0);
  });

  it('treats any non-zero vx as Flash xchange != 0', () => {
    expect(playerAnimMoving(0)).toBe(false);
    expect(playerAnimMoving(1)).toBe(true);
    expect(playerAnimMoving(-5)).toBe(true);
  });
});
