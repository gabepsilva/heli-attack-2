import { describe, expect, it } from 'vitest';
import { PLAYER, WORLD } from '../config/constants';
import { createAabbBody } from './aabbBody';
import {
  LEVEL1_COLS,
  LEVEL1_HEIGHT_PX,
  LEVEL1_PLAYER_SPAWN,
  LEVEL1_ROWS,
  LEVEL1_SPAWN_COL,
  LEVEL1_SPAWN_ROW,
  LEVEL1_WIDTH_PX,
  createLevel1,
  isLevelSolid,
} from './level1';
import { resolveAabbAgainstTiles } from './tileResolve';
import {
  TILE_EMPTY,
  TILE_FRAME_NONE,
  TILE_SOLID,
  getTileFrame,
} from './tileMap';
import { TILE_FRAME_IDS, tileFrameForCell } from '../art/catalog';
import { Player } from '../player/player';

describe('createLevel1 — original HA2 map1 layout (#41)', () => {
  const map = createLevel1();

  it('is a 35×15 grid of 50px tiles (1750×750 px)', () => {
    expect(map.width).toBe(LEVEL1_COLS);
    expect(map.height).toBe(LEVEL1_ROWS);
    expect(map.width).toBe(35);
    expect(map.height).toBe(15);
    expect(map.tileSize).toBe(WORLD.tile);
    expect(map.tileSize).toBe(50);
    expect(LEVEL1_WIDTH_PX).toBe(35 * 50);
    expect(LEVEL1_HEIGHT_PX).toBe(15 * 50);
    expect(LEVEL1_WIDTH_PX).toBe(1750);
    expect(LEVEL1_HEIGHT_PX).toBe(750);
  });

  it('has a continuous solid ground row matching decompiled map1 row 14', () => {
    for (let x = 0; x < map.width; x += 1) {
      expect(map.cells[14]![x]).toBe(TILE_SOLID);
    }
  });

  it('keeps rows 0–10 entirely empty (open sky)', () => {
    for (let y = 0; y <= 10; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        expect(map.cells[y]![x]).toBe(TILE_EMPTY);
      }
    }
  });

  it('matches decompiled platform solids on rows 11–13 exactly', () => {
    // Row 11: only the far-right ledge tip (col 34).
    for (let x = 0; x < 34; x += 1) {
      expect(map.cells[11]![x]).toBe(TILE_EMPTY);
    }
    expect(map.cells[11]![34]).toBe(TILE_SOLID);

    // Row 12: ### at 16–18, ### at 24–26, ## at 33–34.
    const row12Solid = new Set([16, 17, 18, 24, 25, 26, 33, 34]);
    for (let x = 0; x < map.width; x += 1) {
      expect(map.cells[12]![x]).toBe(
        row12Solid.has(x) ? TILE_SOLID : TILE_EMPTY,
      );
    }

    // Row 13: ### at 5–7, ##### at 15–19, ### at 23–25, ### at 32–34.
    // Spawn marker [32,0] at (0,13) is empty after load.
    const row13Solid = new Set([
      5, 6, 7, 15, 16, 17, 18, 19, 23, 24, 25, 32, 33, 34,
    ]);
    for (let x = 0; x < map.width; x += 1) {
      expect(map.cells[13]![x]).toBe(
        row13Solid.has(x) ? TILE_SOLID : TILE_EMPTY,
      );
    }
    expect(map.cells[LEVEL1_SPAWN_ROW]![LEVEL1_SPAWN_COL]).toBe(TILE_EMPTY);
  });

  it('carries the decompiled tileset frame of every cell (map1 slot [1])', () => {
    // Empty cells (incl. the spawn marker) draw nothing.
    expect(map.frames[0]!.every((frame) => frame === TILE_FRAME_NONE)).toBe(
      true,
    );
    expect(map.frames[LEVEL1_SPAWN_ROW]![LEVEL1_SPAWN_COL]).toBe(
      TILE_FRAME_NONE,
    );

    // Ground row 14 verbatim: grass caps, buried dirt under the ledges, and
    // the bush pairs (5 / 6) that flank each ledge base.
    expect(map.frames[14]).toEqual([
      1, 1, 1, 1, 1, 5, 2, 6, 1, 1, 1, 1, 1, 1, 1, 5, 2, 2, 2, 6, 1, 1, 1, 5, 2,
      6, 1, 1, 1, 1, 1, 1, 5, 2, 2,
    ]);

    // Ledge tops: left end cap (3), grass (1), right end cap (4).
    expect([5, 6, 7].map((col) => map.frames[13]![col])).toEqual([3, 1, 4]);
    // The right-hand ledge ends in the rocky overhang corner (8).
    expect(map.frames[12]![26]).toBe(8);
    expect(map.frames[11]![34]).toBe(3);

    // Every solid cell draws something; no solid cell is left blank.
    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (isLevelSolid(map, col, row)) {
          expect(getTileFrame(map, col, row), `${col},${row}`).toBeGreaterThan(
            0,
          );
        }
      }
    }
  });

  it('resolves every level frame to a real tileset sprite', () => {
    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        const frame = getTileFrame(map, col, row);
        const sprite = tileFrameForCell(frame);
        if (frame === TILE_FRAME_NONE) {
          expect(sprite).toBeNull();
        } else {
          expect(sprite, `${col},${row}`).toBe(TILE_FRAME_IDS[frame - 1]);
        }
      }
    }
  });

  it('places the player spawn at original tile-center X on the spawn column', () => {
    expect(LEVEL1_SPAWN_COL).toBe(0);
    expect(LEVEL1_SPAWN_ROW).toBe(13);
    // Original: player._x = x*tileWidth + tileWidth/2 (center of col 0).
    expect(LEVEL1_PLAYER_SPAWN.x).toBe(
      LEVEL1_SPAWN_COL * WORLD.tile + WORLD.tile / 2 - PLAYER.boxW / 2,
    );
    expect(LEVEL1_PLAYER_SPAWN.x).toBe(20);
    expect(LEVEL1_PLAYER_SPAWN.y).toBe(-50);
  });

  it('isLevelSolid mirrors TILE_SOLID cells for placeholder rendering', () => {
    expect(isLevelSolid(map, 0, 14)).toBe(true);
    expect(isLevelSolid(map, LEVEL1_SPAWN_COL, LEVEL1_SPAWN_ROW)).toBe(false);
    expect(isLevelSolid(map, 16, 12)).toBe(true);
  });

  it('supports floor collision: a body settles on the ground row', () => {
    // Over open ground (col 2), drop onto row 14.
    const body = createAabbBody(100, 200, 40, 40);
    for (let i = 0; i < 120; i += 1) {
      body.vy += WORLD.gravity;
      resolveAabbAgainstTiles(map, body, 1);
    }
    expect(body.onGround).toBe(true);
    expect(body.vy).toBe(0);
    expect(body.y + body.h).toBe(14 * WORLD.tile - 1);
  });

  it('supports platform collision: a body rests on the left mid platform', () => {
    // Platform tops at row 13, cols 5–7 (y = 650).
    const body = createAabbBody(5 * WORLD.tile + 10, 500, 20, 20);
    for (let i = 0; i < 80; i += 1) {
      body.vy += WORLD.gravity;
      resolveAabbAgainstTiles(map, body, 1);
    }
    expect(body.onGround).toBe(true);
    expect(body.y + body.h).toBe(13 * WORLD.tile - 1);
    expect(body.x).toBeGreaterThanOrEqual(5 * WORLD.tile);
    expect(body.x + body.w).toBeLessThanOrEqual(8 * WORLD.tile);
  });

  it('lets the player walk on the ground after spawning (movement AC)', () => {
    // In-bounds drop (parachute intro is covered separately); settle then walk.
    const player = new Player(LEVEL1_PLAYER_SPAWN.x, 200);
    for (let i = 0; i < 120; i += 1) {
      player.step(map, 1);
    }
    expect(player.body.onGround).toBe(true);
    expect(player.body.y + player.body.h).toBe(14 * WORLD.tile - 1);

    player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    const ramp: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      player.step(map, 1);
      ramp.push(player.body.vx);
    }
    expect(ramp).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(player.body.vx).toBe(PLAYER.walkCap);
    expect(player.body.onGround).toBe(true);
    expect(player.body.x).toBeGreaterThan(LEVEL1_PLAYER_SPAWN.x);
  });
});
