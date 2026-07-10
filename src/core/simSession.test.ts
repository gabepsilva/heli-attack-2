import { describe, expect, it } from 'vitest';
import { PLAYER, SIM_DT, SIM_HZ, WORLD } from '../config/constants';
import { PLAYER_SPAWN } from '../player/player';
import { DEBUG_BOX_SPAWN, SimSession } from './simSession';

describe('SimSession', () => {
  it('reset restores a fresh run after timeStep / motion mutations (scene switch)', () => {
    const session = new SimSession();

    session.timeScale.setTimeStep(0.5);
    session.accumulator.advance(SIM_DT / 2);
    session.update(1000 / 30); // one sim tick at half speed
    expect(session.timeScale.timeStep).toBe(0.5);
    expect(session.debugBox.body.vy).toBeGreaterThan(0);
    expect(session.player.body.vy).toBeGreaterThan(0);
    expect(session.simTickCount).toBeGreaterThan(0);
    expect(session.accumulator.leftoverSeconds).toBeCloseTo(SIM_DT / 2);

    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
    };
    session.player.placeAt(400, 50);
    session.debugBox.placeAt(400, 50);
    session.debugBox.dragging = true;

    // Game → Boot → Game: create() must call reset() so state does not leak.
    session.reset();

    expect(session.timeScale.timeStep).toBe(1);
    expect(session.player.body.x).toBe(PLAYER_SPAWN.x);
    expect(session.player.body.y).toBe(PLAYER_SPAWN.y);
    expect(session.player.body.vx).toBe(0);
    expect(session.player.body.vy).toBe(0);
    expect(session.player.input).toEqual({
      left: false,
      right: false,
      jump: false,
      duck: false,
    });
    expect(session.debugBox.body.x).toBe(DEBUG_BOX_SPAWN.x);
    expect(session.debugBox.body.y).toBe(DEBUG_BOX_SPAWN.y);
    expect(session.debugBox.body.vx).toBe(0);
    expect(session.debugBox.body.vy).toBe(0);
    expect(session.debugBox.dragging).toBe(false);
    expect(session.simTickCount).toBe(0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
    expect(session.displayedSimRate).toBe(0);
    expect(session.accumulator.leftoverSeconds).toBe(0);
  });

  it('steps the player walk curve through the fixed sim (ramp to cap, decay to 0)', () => {
    const session = new SimSession();
    // Settle onto the floor.
    for (let i = 0; i < 40; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.player.body.onGround).toBe(true);

    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
    };
    const ramp: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
      ramp.push(session.player.body.vx);
    }
    expect(ramp).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(session.player.body.vx).toBe(PLAYER.walkCap);

    session.player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
    };
    const decay: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      session.update(1000 / 30);
      decay.push(session.player.body.vx);
    }
    expect(decay).toEqual([4, 3, 2, 1, 0, 0]);
    expect(session.player.body.vx).toBe(0);
  });

  it('ignores NaN deltas so the HUD rate timer cannot freeze', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);

    session.update(Number.NaN);
    for (let i = 0; i < 300; i += 1) {
      session.update(1000 / 30);
    }

    expect(Number.isNaN(session.secondTimerMs)).toBe(false);
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
  });

  it('converts Phaser delta ms → seconds and steps at ~30 Hz for 60 Hz frames', () => {
    const session = new SimSession();
    const frames = 60;
    const deltaMs = 1000 / 60;

    for (let i = 0; i < frames; i += 1) {
      session.update(deltaMs);
    }

    expect(session.simTickCount).toBe(SIM_HZ);
    const rate = session.simTickCount / (frames * (deltaMs / 1000));
    expect(rate).toBeGreaterThanOrEqual(SIM_HZ - 1);
    expect(rate).toBeLessThanOrEqual(SIM_HZ + 1);
  });

  it('updates displayedSimRate after ~1s of wall time', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
  });

  it('steps the debug box under gravity scaled by the live timeStep', () => {
    const session = new SimSession();
    session.timeScale.setTimeStep(0.5);
    session.update(1000 / 30); // exactly one SIM_DT in ms

    // Gravity applied once; displacement = vy * timeStep = 1 * 0.5.
    expect(session.debugBox.body.vy).toBe(WORLD.gravity);
    expect(session.debugBox.body.y).toBe(
      DEBUG_BOX_SPAWN.y + WORLD.gravity * 0.5,
    );
  });

  it('owns the original 35×15 level of 50px tiles (not the test arena)', () => {
    const session = new SimSession();
    expect(session.map.tileSize).toBe(50);
    expect(session.map.width).toBe(35);
    expect(session.map.height).toBe(15);
    // Continuous ground row from decompiled map1.
    expect(session.map.cells[14]!.every((c) => c === 1)).toBe(true);
  });
});
