import { PLAYER, WORLD } from '../config/constants';
import { TILE_SOLID, createTileMap, type TileMap } from './tileMap';

/**
 * Original HA2 playfield from the first `map1` assignment in
 * `reference/spec/heli2-decompiled-actionscript.txt` (the second `map1 =`
 * overwrites it with a tiny stub — we keep the full 35×15 layout).
 *
 * Each decompiled cell is `[collision, visualFrame]`. Collision `0` / `32`
 * (spawn marker, cleared to empty at runtime) → {@link TILE_EMPTY}; any other
 * collision id → {@link TILE_SOLID}. Visual frames are deferred to #34.
 *
 * Legend: `#` = solid, `.` = empty, `S` = spawn (empty after load)
 *
 * ```
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ...................................
 * ..................................#
 * ................###.....###......##
 * S....###.......#####...###......###
 * ###################################
 * ```
 */
export const LEVEL1_COLS = 35;
export const LEVEL1_ROWS = 15;

/** Pixel size of the level (cols/rows × tile). */
export const LEVEL1_WIDTH_PX = LEVEL1_COLS * WORLD.tile;
export const LEVEL1_HEIGHT_PX = LEVEL1_ROWS * WORLD.tile;

/**
 * Decompiled spawn marker was `map[13][0] == 32`. Original places the hero at
 * tile-center X and drops from `y = -50` on a parachute (`heroStart`).
 */
export const LEVEL1_SPAWN_COL = 0;
export const LEVEL1_SPAWN_ROW = 13;

/** Player body top-left matching original tile-center X + parachute spawn Y. */
export const LEVEL1_PLAYER_SPAWN = {
  x: LEVEL1_SPAWN_COL * WORLD.tile + WORLD.tile / 2 - PLAYER.boxW / 2,
  /** Flash `player._y = -50`. */
  y: -50,
} as const;

/**
 * Row-major collision grid ported from decompiled `map1` (collision slot only).
 * Locked by unit tests against the exact solid / empty pattern.
 */
const LEVEL1_CELLS: readonly (readonly number[])[] = [
  // rows 0–10: open sky
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  // row 11: right-edge ledge tip
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
  ],
  // row 12: mid platforms
  [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1,
    1, 1, 0, 0, 0, 0, 0, 0, 1, 1,
  ],
  // row 13: lower platforms + spawn column 0 (empty)
  [
    0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1,
    1, 0, 0, 0, 0, 0, 0, 1, 1, 1,
  ],
  // row 14: continuous ground
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
];

/** Build the original playfield. Pure data — no Phaser. */
export function createLevel1(): TileMap {
  return createTileMap(LEVEL1_CELLS);
}

/** Convenience: true if the level cell is solid (for placeholder rendering). */
export function isLevelSolid(map: TileMap, col: number, row: number): boolean {
  return map.cells[row]![col] === TILE_SOLID;
}
