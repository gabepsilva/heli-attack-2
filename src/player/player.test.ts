import { describe, expect, it } from 'vitest';
import { PLAYER, WORLD } from '../config/constants';
import { createTestArena } from '../world/testArena';
import { PLAYER_SPAWN, Player } from './player';

describe('Player', () => {
  it('uses the spec collision box 10×42 at the default spawn', () => {
    const player = new Player();
    expect(player.body.w).toBe(PLAYER.boxW);
    expect(player.body.h).toBe(PLAYER.boxH);
    expect(player.body.w).toBe(10);
    expect(player.body.h).toBe(42);
    expect(player.body.x).toBe(PLAYER_SPAWN.x);
    expect(player.body.y).toBe(PLAYER_SPAWN.y);
  });

  it('ramps vx to the walk cap under right input, then decays to 0 on release', () => {
    const map = createTestArena();
    const player = new Player(100, 200);

    // Settle onto the floor first so wall/floor resolve does not fight us.
    for (let i = 0; i < 40; i += 1) {
      player.step(map, 1);
    }
    expect(player.body.onGround).toBe(true);

    player.input = { left: false, right: true };
    const ramp: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      player.step(map, 1);
      ramp.push(player.body.vx);
    }
    expect(ramp).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(player.body.vx).toBe(PLAYER.walkCap);

    player.input = { left: false, right: false };
    const decay: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      player.step(map, 1);
      decay.push(player.body.vx);
    }
    expect(decay).toEqual([4, 3, 2, 1, 0, 0]);
    expect(player.body.vx).toBe(0);
  });

  it('is blocked by walls and zeroes vx on impact', () => {
    const map = createTestArena();
    // Near the left wall (col 0 solid); floor at row 12.
    const player = new Player(60, 12 * WORLD.tile - PLAYER.boxH - 1);
    player.body.onGround = true;
    player.body.vx = -PLAYER.walkCap;
    player.input = { left: true, right: false };

    for (let i = 0; i < 30; i += 1) {
      player.step(map, 1);
    }

    // Snapped just right of the left wall tile (col 0 → x = tile - 1 = 49).
    expect(player.body.x).toBe(WORLD.tile - 1);
    expect(player.body.vx).toBe(0);
  });

  it('placeAt clears velocity for a clean reset', () => {
    const player = new Player();
    player.body.vx = 5;
    player.body.vy = 9;
    player.body.onGround = true;
    player.placeAt(200, 100);

    expect(player.body.x).toBe(200);
    expect(player.body.y).toBe(100);
    expect(player.body.vx).toBe(0);
    expect(player.body.vy).toBe(0);
    expect(player.body.onGround).toBe(false);
  });
});
