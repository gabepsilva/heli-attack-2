import { PLAYER, WORLD } from '../config/constants';
import { createBgLayer, type BgLayer } from './bgLayer';
import {
  TILE_EMPTY,
  TILE_SOLID,
  createTileMap,
  type TileFrameGrid,
  type TileGrid,
  type TileMap,
} from './tileMap';

/**
 * Original HA2 playfield from the first `map1` assignment in
 * `reference/spec/heli2-decompiled-actionscript.txt` (the second `map1 =`
 * overwrites it with a tiny stub — we keep the full 35×15 layout).
 *
 * Cells are the Flash pairs `[collision, frame]` verbatim:
 * - `collision` — `0` = empty, `1` = solid, `32` = spawn marker (cleared to
 *   empty at load, exactly like Flash `assignents`).
 * - `frame` — tileset frame, drawn as `tiles.gotoAndStop(frame + 1)`. `0` draws
 *   nothing; `1..10` pick grass caps / dirt / bushes (see {@link TILE_FRAME_IDS}).
 *
 * Legend: `#` = solid, `.` = empty, `S` = spawn (empty after load)
 *
 * ```
 * ...................................
 * ...................................  (rows 0–10: open sky)
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

/** Flash spawn marker: the cell whose collision slot is `32`. */
export const LEVEL1_SPAWN_COLLISION = 32;

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

/** One decompiled map cell: `[collision, tileset frame]`. */
type FlashCell = readonly [collision: number, frame: number];

const SKY_ROW: readonly FlashCell[] = Array.from(
  { length: LEVEL1_COLS },
  () => [0, 0] as const,
);

/**
 * Row-major `map1` ported cell-for-cell from the decompiled ActionScript.
 * Locked by unit tests against the exact collision / frame pattern.
 */
// prettier-ignore
const LEVEL1_MAP: readonly (readonly FlashCell[])[] = [
  // rows 0–10: open sky
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  SKY_ROW,
  // row 11: right-edge ledge tip
  [
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3],
  ],
  // row 12: mid platforms
  [
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 1],
    [1, 4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 1], [1, 8],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 5],
  ],
  // row 13: lower platforms + spawn marker (col 0)
  [
    [32, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 1], [1, 4], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 5], [1, 2],
    [1, 6], [1, 4], [0, 0], [0, 0], [0, 0], [1, 3], [1, 5], [1, 10], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 3], [1, 5], [1, 2],
  ],
  // row 14: continuous ground
  [
    [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 5], [1, 2], [1, 6], [1, 1],
    [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 5], [1, 2], [1, 2],
    [1, 2], [1, 6], [1, 1], [1, 1], [1, 1], [1, 5], [1, 2], [1, 6], [1, 1],
    [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 5], [1, 2], [1, 2],
  ],
];

/** Collision grid — spawn markers load as empty (Flash `assignents`). */
export const LEVEL1_CELLS: TileGrid = LEVEL1_MAP.map((row) =>
  row.map(([collision]) =>
    collision === LEVEL1_SPAWN_COLLISION ? TILE_EMPTY : collision,
  ),
);

/** Visual grid — the tileset frame per cell. */
export const LEVEL1_FRAMES: TileFrameGrid = LEVEL1_MAP.map((row) =>
  row.map(([, frame]) => frame),
);

/** Build the original playfield. Pure data — no Phaser. */
export function createLevel1(): TileMap {
  return createTileMap(LEVEL1_CELLS, WORLD.tile, LEVEL1_FRAMES);
}

/**
 * Decompiled `bglayer1_1` — the parallax foliage grid (ferns / palm trunks)
 * drawn behind the level. 20 columns against the level's 35: Flash repeats it,
 * and the pattern itself is two copies of a 10-column run, which is why the
 * original can wrap at half its width without a visible seam.
 */
// prettier-ignore
export const LEVEL1_BG_FRAMES: TileFrameGrid = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [2, 1, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 0, 1, 2],
];

/** Build the level's parallax foliage layer. Pure data — no Phaser. */
export function createLevel1BgLayer(): BgLayer {
  return createBgLayer(LEVEL1_BG_FRAMES);
}

/** Convenience: true if the level cell is solid (for placeholder rendering). */
export function isLevelSolid(map: TileMap, col: number, row: number): boolean {
  return map.cells[row]![col] === TILE_SOLID;
}
