import { WORLD } from '../config/constants';
import { TILE_EMPTY, TILE_SOLID, createTileMap, type TileMap } from './tileMap';

const E = TILE_EMPTY;
const S = TILE_SOLID;

/**
 * Hand-authored 24×16 test arena (1200×800 px at {@link WORLD.tile}).
 *
 * Features called out by issue #4:
 * - Floor with a **pit** in the middle
 * - Left / right **walls**
 * - A **floating platform**
 * - Ceiling so upward motion also collides
 *
 * Legend: `#` = solid, `.` = empty
 *
 * ```
 * ########################
 * #......................#
 * #......................#
 * #........######........#
 * #......................#
 * #......................#
 * #......................#
 * #......................#
 * #......................#
 * #......................#
 * #......................#
 * #......................#
 * ######..........########
 * ######..........########
 * ########################
 * ########################
 * ```
 */
export const TEST_ARENA_COLS = 24;
export const TEST_ARENA_ROWS = 16;

/** Pixel size of the arena (cols/rows × tile). */
export const TEST_ARENA_WIDTH_PX = TEST_ARENA_COLS * WORLD.tile;
export const TEST_ARENA_HEIGHT_PX = TEST_ARENA_ROWS * WORLD.tile;

/**
 * Build the static test level. Pure data — no Phaser.
 * Layout is locked by unit tests so the pit / platform / walls stay intentional.
 */
export function createTestArena(): TileMap {
  const rows: number[][] = [];

  for (let y = 0; y < TEST_ARENA_ROWS; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < TEST_ARENA_COLS; x += 1) {
      row.push(cellAt(x, y));
    }
    rows.push(row);
  }

  return createTileMap(rows);
}

function cellAt(x: number, y: number): number {
  // Outer shell: top, bottom, left, right walls.
  if (
    y === 0 ||
    y >= TEST_ARENA_ROWS - 2 ||
    x === 0 ||
    x === TEST_ARENA_COLS - 1
  ) {
    return S;
  }

  // Thick floor band (rows 12–13) with a pit spanning cols 7–14 inclusive.
  if (y === 12 || y === 13) {
    if (x >= 7 && x <= 14) {
      return E; // pit
    }
    return S;
  }

  // Floating platform: row 3, cols 9–14.
  if (y === 3 && x >= 9 && x <= 14) {
    return S;
  }

  return E;
}

/** Convenience: true if the arena cell is solid (for rendering). */
export function isArenaSolid(map: TileMap, col: number, row: number): boolean {
  return map.cells[row]![col] === TILE_SOLID;
}
