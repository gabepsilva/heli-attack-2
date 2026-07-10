import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import {
  applyJumpInput,
  cancelJumpOnCeiling,
  createJumpState,
  markAirborneIfMoving,
  resetJumpOnLand,
} from './jumpPhysics';

describe('jumpPhysics (spec §Player physics — jump)', () => {
  it('locks jumpVel / hold window / doubleJump to exact spec values', () => {
    expect(PLAYER.jumpVel).toBe(-8);
    expect(PLAYER.jumpHoldFrames).toBe(6);
    expect(PLAYER.doubleJump).toBe(true);
  });

  it('starts with a full 6-frame hold window and no jump flags', () => {
    const state = createJumpState();
    expect(state).toEqual({
      jump: false,
      jump2: false,
      up: 6,
      upHeld: false,
    });
  });

  it('forces vy = min(vy, -8) for each of the 6 hold frames while key is held', () => {
    const state = createJumpState();
    const frames: number[] = [];

    for (let i = 0; i < 6; i += 1) {
      // Simulate gravity already applied from a prior frame (vy climbing).
      const before = i === 0 ? 0 : -7 + i;
      const after = applyJumpInput(before, state, { jump: true, duck: false });
      frames.push(after);
    }

    // Every hold frame clamps to −8; up counts down 6 → 0.
    expect(frames).toEqual([-8, -8, -8, -8, -8, -8]);
    expect(state.up).toBe(0);
    expect(state.jump).toBe(true);
    expect(state.jump2).toBe(false);
  });

  it('stops clamping after the hold window expires (short hop if released early)', () => {
    const state = createJumpState();

    // Tap: hold 2 frames then release.
    let vy = applyJumpInput(0, state, { jump: true, duck: false });
    expect(vy).toBe(-8);
    expect(state.up).toBe(5);

    vy = applyJumpInput(vy + 1, state, { jump: true, duck: false }); // gravity mid-hold
    expect(vy).toBe(-8);
    expect(state.up).toBe(4);

    // Release — refill because !duck and double-jump still open.
    vy = applyJumpInput(vy + 1, state, { jump: false, duck: false });
    expect(state.up).toBe(PLAYER.jumpHoldFrames);
    expect(state.upHeld).toBe(false);

    // Without holding, gravity alone would raise vy; no clamp applied.
    expect(vy).toBe(-7);
  });

  it('refills the hold window on release when grounded (jump flag clear)', () => {
    const state = createJumpState();
    state.up = 0;
    state.jump = false;
    state.jump2 = false;

    applyJumpInput(0, state, { jump: false, duck: false });
    expect(state.up).toBe(6);
  });

  it('does not refill while airborne after double-jump is spent', () => {
    const state = createJumpState();
    state.jump = true;
    state.jump2 = true;
    state.up = 3;

    applyJumpInput(-4, state, { jump: false, duck: false });
    expect(state.up).toBe(0);
  });

  it('blocks hold-window refill while ducking after the first jump', () => {
    const state = createJumpState();
    state.jump = true;
    state.jump2 = false;
    state.up = 3;

    applyJumpInput(-4, state, { jump: false, duck: true });
    expect(state.up).toBe(0);
  });

  it('blocks hold-window refill while ducking on the ground', () => {
    const state = createJumpState();
    state.jump = false;
    state.jump2 = false;
    state.up = 0;

    applyJumpInput(0, state, { jump: false, duck: true });
    expect(state.up).toBe(0);
  });

  it('blocks jump press while ducking on the ground (no vy clamp, no jump flag)', () => {
    const state = createJumpState();
    expect(state.up).toBe(PLAYER.jumpHoldFrames);

    const vy = applyJumpInput(0, state, { jump: true, duck: true });
    expect(vy).toBe(0);
    expect(state.jump).toBe(false);
    expect(state.jump2).toBe(false);
    expect(state.up).toBe(PLAYER.jumpHoldFrames);
  });

  it('blocks double-jump press while ducking even when up was refilled before duck', () => {
    const state = createJumpState();
    state.jump = true;
    state.jump2 = false;
    state.up = PLAYER.jumpHoldFrames;

    const vy = applyJumpInput(-2, state, { jump: true, duck: true });
    expect(vy).toBe(-2);
    expect(state.jump2).toBe(false);
    expect(state.up).toBe(PLAYER.jumpHoldFrames);
  });

  it('consumes jump2 on the second press while airborne', () => {
    const state = createJumpState();
    // First jump
    applyJumpInput(0, state, { jump: true, duck: false });
    expect(state.jump).toBe(true);
    expect(state.jump2).toBe(false);

    // Release mid-air — refill because !jump2
    applyJumpInput(-5, state, { jump: false, duck: false });
    expect(state.up).toBe(6);

    // Second press
    applyJumpInput(-2, state, { jump: true, duck: false });
    expect(state.jump2).toBe(true);
    expect(state.up).toBe(5);
  });

  it('markAirborneIfMoving sets jump when walking off a ledge', () => {
    const state = createJumpState();
    markAirborneIfMoving(state, 1);
    expect(state.jump).toBe(true);
    markAirborneIfMoving(state, 2);
    expect(state.jump2).toBe(false); // only first flag
  });

  it('resetJumpOnLand clears both flags; cancelJumpOnCeiling burns both', () => {
    const land = createJumpState();
    land.jump = true;
    land.jump2 = true;
    land.up = 0;
    resetJumpOnLand(land);
    expect(land.jump).toBe(false);
    expect(land.jump2).toBe(false);

    const ceil = createJumpState();
    cancelJumpOnCeiling(ceil);
    expect(ceil.jump).toBe(true);
    expect(ceil.jump2).toBe(true);
    expect(ceil.up).toBe(0);
  });
});
