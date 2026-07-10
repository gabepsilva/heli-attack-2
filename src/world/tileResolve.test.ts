import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/constants';
import { createAabbBody } from './aabbBody';
import { createTestArena } from './testArena';
import { resolveAabbAgainstTiles } from './tileResolve';
import { TILE_SOLID, createTileMap } from './tileMap';

/** Tiny 5×5 room: solid border, empty interior. */
function roomMap() {
  return createTileMap([
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ]);
}

describe('resolveAabbAgainstTiles — acceptance criteria', () => {
  it('box rests on floors (AC: rests on floors)', () => {
    const map = roomMap();
    // 20×20 box above the floor row (row 4 starts at y=200).
    const body = createAabbBody(60, 100, 20, 20);
    body.vy = 0;

    // Fall under gravity until settled (terminal is 50; floor is close).
    for (let i = 0; i < 40; i += 1) {
      body.vy += WORLD.gravity;
      resolveAabbAgainstTiles(map, body, 1);
    }

    // Floor tile top is y=200; body bottom snaps to 199 → y = 179.
    expect(body.onGround).toBe(true);
    expect(body.vy).toBe(0);
    expect(body.y + body.h).toBe(4 * WORLD.tile - 1); // 199
    expect(body.y).toBe(179);
  });

  it('box is blocked by walls and zeroes vx (AC: blocked by walls)', () => {
    const map = roomMap();
    // Sitting on the floor, moving right into the right wall (col 4 @ x=200).
    // Predicted right edge must reach the wall column: 175+10+20 = 205 → col 4.
    const body = createAabbBody(175, 179, 20, 20);
    body.vx = 10;
    body.vy = 0;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vx).toBe(0);
    // Right edge snaps to 1px left of wall column: 200 - 1 = 199 → x = 179.
    expect(body.x + body.w).toBe(4 * WORLD.tile - 1);
    expect(body.x).toBe(179);
  });

  it('box is blocked by left walls', () => {
    const map = roomMap();
    const body = createAabbBody(55, 179, 20, 20);
    body.vx = -10;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vx).toBe(0);
    // Original snap: (tilex+1)*tile - 1 → 49 when tilex=0.
    expect(body.x).toBe(WORLD.tile - 1);
  });

  it('cannot tunnel through a floor at terminal fall speed (AC: no tunneling)', () => {
    const map = roomMap();
    // Place just above the floor with vy = terminal (50 == tile size).
    // Without predictive tile resolve this would jump an entire tile and
    // land inside / past the floor.
    const body = createAabbBody(60, 150, 20, 20);
    body.vy = WORLD.terminal; // 50 — exact spec terminal / tileHeight
    expect(body.vy).toBe(50);
    expect(body.vy).toBe(WORLD.tile);

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.onGround).toBe(true);
    expect(body.vy).toBe(0);
    expect(body.y + body.h).toBe(4 * WORLD.tile - 1);
    // Must remain above the floor tile, never inside it.
    expect(body.y + body.h).toBeLessThan(4 * WORLD.tile);
  });

  it('cannot tunnel through a wall at full horizontal speed', () => {
    const map = roomMap();
    // Approaching the right wall with vx = tile size (50).
    const body = createAabbBody(140, 100, 20, 20);
    body.vx = WORLD.tile; // 50

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vx).toBe(0);
    expect(body.x + body.w).toBe(4 * WORLD.tile - 1);
    expect(body.x + body.w).toBeLessThan(4 * WORLD.tile);
  });

  it('clamps vy to WORLD.terminal (50) before resolving', () => {
    const map = roomMap();
    // From (60,60) with vy=999 → clamp to 50, free-fall to y=110 (no floor hit).
    const body = createAabbBody(60, 60, 20, 20);
    body.vy = 999;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vy).toBe(WORLD.terminal);
    expect(body.y).toBe(110);
  });

  it('clamps upward vy to -WORLD.terminal (-50) before resolving', () => {
    const map = roomMap();
    // From (60,120) with vy=-999 → clamp to -50, free rise to y=70 (no ceiling hit).
    const body = createAabbBody(60, 120, 20, 20);
    body.vy = -999;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vy).toBe(-WORLD.terminal);
    expect(body.y).toBe(70);
  });

  it('cannot tunnel through a ceiling at terminal rise speed', () => {
    const map = roomMap();
    // Ceiling-adjacent: y=55, vy=-999 → clamp -50, probe hits row 0, snap to y=49.
    const body = createAabbBody(60, 55, 20, 20);
    body.vy = -999;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vy).toBe(0);
    expect(body.y).toBe(WORLD.tile - 1);
  });

  it('does not escape further left when already past the map edge', () => {
    const map = roomMap();
    // Lead repro: body at x=-1 with vx=-50 must stabilize, not walk to -∞.
    // Snap clamps tilex to -1 → x stays at -1 (not -51, -101, …).
    const body = createAabbBody(-1, 100, 20, 20);

    for (let i = 0; i < 4; i += 1) {
      body.vx = -WORLD.tile;
      resolveAabbAgainstTiles(map, body, 1);
    }

    expect(body.vx).toBe(0);
    expect(body.x).toBe(-1);
  });

  it('does not escape further up when already past the map edge', () => {
    const map = roomMap();
    // Symmetric ceiling path: snap clamps tiley to -1 → y stays at -1.
    const body = createAabbBody(60, -1, 20, 20);

    for (let i = 0; i < 4; i += 1) {
      body.vy = -WORLD.tile;
      resolveAabbAgainstTiles(map, body, 1);
    }

    expect(body.vy).toBe(0);
    expect(body.y).toBe(-1);
  });

  it('rests on the floating platform in the test arena', () => {
    const map = createTestArena();
    // Platform is row 3 (y=150..200), cols 9–14 (x=450..750).
    // Drop a box onto it from above.
    const body = createAabbBody(500, 80, 40, 40);
    body.vy = 0;

    for (let i = 0; i < 30; i += 1) {
      body.vy += WORLD.gravity;
      resolveAabbAgainstTiles(map, body, 1);
    }

    expect(body.onGround).toBe(true);
    expect(body.y + body.h).toBe(3 * WORLD.tile - 1); // 149
    // Still over the platform span.
    expect(body.x).toBeGreaterThanOrEqual(9 * WORLD.tile);
    expect(body.x + body.w).toBeLessThanOrEqual(15 * WORLD.tile);
  });

  it('falls through the pit and lands on the bottom floor', () => {
    const map = createTestArena();
    // Pit spans cols 7–14 at rows 12–13; bottom solid floor is row 14 (y=700).
    const body = createAabbBody(500, 500, 40, 40); // over the pit
    expect(map.cells[12]![10]).toBe(0); // confirm we're above empty pit

    for (let i = 0; i < 80; i += 1) {
      body.vy += WORLD.gravity;
      resolveAabbAgainstTiles(map, body, 1);
    }

    expect(body.onGround).toBe(true);
    // Bottom floor row 14 → top at 700; body bottom at 699.
    expect(body.y + body.h).toBe(14 * WORLD.tile - 1);
    expect(map.cells[14]![10]).toBe(TILE_SOLID);
  });

  it('scales displacement by timeStep (bullet-time seam)', () => {
    const map = roomMap();
    const full = createAabbBody(60, 60, 20, 20);
    full.vx = 4;
    const half = createAabbBody(60, 60, 20, 20);
    half.vx = 4;

    resolveAabbAgainstTiles(map, full, 1);
    resolveAabbAgainstTiles(map, half, 0.5);

    expect(full.x - 60).toBe(4);
    expect(half.x - 60).toBe(2);
    expect(half.x - 60).toBe((full.x - 60) / 2);
  });

  it('snaps against a ceiling and zeroes vy', () => {
    const map = roomMap();
    // Ceiling is row 0 (y=0..50). Jump upward into it.
    const body = createAabbBody(60, 55, 20, 20);
    body.vy = -20;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vy).toBe(0);
    // Original: (tiley+1)*tile - 1 → 49 when tiley=0.
    expect(body.y).toBe(WORLD.tile - 1);
  });

  it('clamps |vx| to tile size before resolving', () => {
    const map = roomMap();
    // From x=60, unclamped -999 would tunnel past the left wall; clamp to -50
    // still reaches col 0 and snaps.
    const body = createAabbBody(60, 100, 20, 20);
    body.vx = -999;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vx).toBe(0);
    expect(body.x).toBe(WORLD.tile - 1);
  });

  it('clamps positive vx to tile size before resolving', () => {
    const map = roomMap();
    // From (60,100) with vx=999 → clamp to 50, free move to x=110 (no wall hit).
    const body = createAabbBody(60, 100, 20, 20);
    body.vx = 999;

    resolveAabbAgainstTiles(map, body, 1);

    expect(body.vx).toBe(WORLD.tile);
    expect(body.x).toBe(110);
  });
});
