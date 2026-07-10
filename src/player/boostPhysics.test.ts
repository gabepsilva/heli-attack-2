import { describe, expect, it } from 'vitest';
import { PLAYER, SIM_HZ } from '../config/constants';
import {
  applyBoostInput,
  boostChargeRatio,
  createBoostState,
  resetBoostOnLand,
  type BoostJumpFlags,
} from './boostPhysics';

describe('boostPhysics (spec §Player physics — hyper/boost jump)', () => {
  it('locks boostVel / charge frames to exact spec values', () => {
    expect(PLAYER.boostVel).toBe(-32);
    expect(PLAYER.boostChargeFrames).toBe(150);
    // ~5s refill at the fixed 30 Hz sim.
    expect(PLAYER.boostChargeFrames / SIM_HZ).toBe(5);
  });

  it('starts fully charged with no hjump latch', () => {
    const state = createBoostState();
    expect(state).toEqual({
      charge: 150,
      hjump: false,
      boostHeld: false,
    });
    expect(boostChargeRatio(state)).toBe(1);
  });

  it('fires vy = -32 on boost edge when charged and grounded', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: false, jump2: false };

    const vy = applyBoostInput(0, state, flags, { boost: true });

    expect(vy).toBe(-32);
    expect(state.charge).toBe(0);
    expect(state.hjump).toBe(true);
    expect(flags.jump).toBe(true);
    expect(flags.jump2).toBe(false); // ground boost does not spend jump2
    expect(boostChargeRatio(state)).toBe(0);
  });

  it('does not re-fire while the boost key is held (edge detect)', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: false, jump2: false };

    applyBoostInput(0, state, flags, { boost: true });
    expect(state.charge).toBe(0);

    // Still held next frame — charge ticks 0→1, but no second fire.
    const vy = applyBoostInput(5, state, flags, { boost: true });
    expect(vy).toBe(5);
    expect(state.charge).toBe(1);
    expect(state.hjump).toBe(true);
  });

  it('refills exactly 1 frame per tick and reaches 150 after a full dump', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: false, jump2: false };

    applyBoostInput(0, state, flags, { boost: true });
    expect(state.charge).toBe(0);

    // Release so boostHeld clears; charge still ticks every frame.
    for (let i = 0; i < PLAYER.boostChargeFrames; i += 1) {
      applyBoostInput(0, state, flags, { boost: false });
    }
    expect(state.charge).toBe(150);
    expect(boostChargeRatio(state)).toBe(1);
  });

  it('refuses to fire until the meter is full again', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: false, jump2: false };

    applyBoostInput(0, state, flags, { boost: true });
    applyBoostInput(0, state, flags, { boost: false });

    // Partial charge — press boost, must not fire.
    state.charge = 149;
    state.hjump = false; // pretend we landed
    flags.jump = false;
    flags.jump2 = false;

    // One tick: charge 149→150, then same-frame fire is allowed (AS order).
    const vyReady = applyBoostInput(3, state, flags, { boost: true });
    expect(state.charge).toBe(0); // fired and dumped
    expect(vyReady).toBe(-32);
  });

  it('does not fire at charge 149 without the increment reaching 150', () => {
    const state = createBoostState();
    state.charge = 148;
    state.hjump = false;
    const flags: BoostJumpFlags = { jump: false, jump2: false };

    const vy = applyBoostInput(3, state, flags, { boost: true });
    // 148→149, still below threshold → no fire.
    expect(vy).toBe(3);
    expect(state.charge).toBe(149);
    expect(state.hjump).toBe(false);
  });

  it('spends jump2 when boosting after the first jump', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: true, jump2: false };

    applyBoostInput(-4, state, flags, { boost: true });
    expect(flags.jump).toBe(true);
    expect(flags.jump2).toBe(true);
    expect(state.hjump).toBe(true);
  });

  it('blocks boost when both jump slots are spent', () => {
    const state = createBoostState();
    const flags: BoostJumpFlags = { jump: true, jump2: true };

    const vy = applyBoostInput(10, state, flags, { boost: true });
    expect(vy).toBe(10);
    expect(state.charge).toBe(150);
    expect(state.hjump).toBe(false);
  });

  it('blocks a second boost in the same airtime via hjump', () => {
    const state = createBoostState();
    state.hjump = true;
    state.charge = 150;
    const flags: BoostJumpFlags = { jump: true, jump2: false };

    const vy = applyBoostInput(10, state, flags, { boost: true });
    expect(vy).toBe(10);
    expect(state.charge).toBe(150);
  });

  it('resetBoostOnLand clears hjump so a fresh boost is available', () => {
    const state = createBoostState();
    state.hjump = true;
    resetBoostOnLand(state);
    expect(state.hjump).toBe(false);
  });
});
