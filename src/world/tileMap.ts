import { WORLD } from '../config/constants';

/** Empty / air cell — no collision. */
export const TILE_EMPTY = 0;

/** Solid collision cell (floor, wall, platform). */
export const TILE_SOLID = 1;

/** Visual frame of an empty cell — Flash `tiles` frame 1 is blank. */
export const TILE_FRAME_NONE = 0;

/**
 * Row-major tile grid. `cells[row][col]` holds a collision type in `[0, 100)`
 * matching the original Flash map cell `[0]` slot (0 = empty, 1 = solid).
 */
export type TileGrid = readonly (readonly number[])[];

/**
 * Row-major visual grid — the Flash map cell `[1]` slot. `0` draws nothing;
 * `1..10` select a tileset frame (see {@link TILE_FRAME_IDS}).
 */
export type TileFrameGrid = readonly (readonly number[])[];

export interface TileMap {
  readonly width: number;
  readonly height: number;
  /** Pixel size of one tile edge — always {@link WORLD.tile} (50). */
  readonly tileSize: number;
  /** Collision grid (what the sim reads). */
  readonly cells: TileGrid;
  /** Visual grid (what the renderer draws) — parallel to {@link cells}. */
  readonly frames: TileFrameGrid;
}

/**
 * Build a TileMap, validating a rectangular grid and locking tile size to spec.
 * Levels ported from Flash pass their own `frames` (the map cell `[1]` slot);
 * hand-authored collision-only maps fall back to the plain-ground frame so any
 * map stays renderable.
 */
export function createTileMap(
  cells: TileGrid,
  tileSize: number = WORLD.tile,
  frames: TileFrameGrid = defaultFrames(cells),
): TileMap {
  if (cells.length === 0) {
    throw new Error('TileMap must have at least one row');
  }
  const height = cells.length;
  const width = cells[0]!.length;
  if (width === 0) {
    throw new Error('TileMap rows must have at least one column');
  }
  for (let y = 0; y < height; y += 1) {
    if (cells[y]!.length !== width) {
      throw new Error(`TileMap row ${y} width ${cells[y]!.length} != ${width}`);
    }
  }
  if (frames.length !== height || frames.some((row) => row.length !== width)) {
    throw new Error(`TileMap frame grid must be ${width}×${height}`);
  }
  if (tileSize !== WORLD.tile) {
    throw new Error(
      `tileSize must be WORLD.tile (${WORLD.tile}), got ${tileSize}`,
    );
  }
  return { width, height, tileSize, cells, frames };
}

/**
 * Collision type at tile (col, row). Out-of-bounds reads as solid so bodies
 * cannot leave the map (mirrors the original's explicit edge checks).
 */
export function getTile(map: TileMap, col: number, row: number): number {
  if (row < 0 || row >= map.height || col < 0 || col >= map.width) {
    return TILE_SOLID;
  }
  return map.cells[row]![col]!;
}

export function isSolidTile(map: TileMap, col: number, row: number): boolean {
  const cell = getTile(map, col, row);
  return cell !== TILE_EMPTY && cell >= 0 && cell < 100;
}

/** Visual frame at (col, row); {@link TILE_FRAME_NONE} outside the map. */
export function getTileFrame(map: TileMap, col: number, row: number): number {
  if (row < 0 || row >= map.height || col < 0 || col >= map.width) {
    return TILE_FRAME_NONE;
  }
  return map.frames[row]![col]!;
}

/** Solid cells draw the plain-ground frame when a level ships no visual grid. */
function defaultFrames(cells: TileGrid): TileFrameGrid {
  return cells.map((row) =>
    row.map((cell) => (cell === TILE_EMPTY ? TILE_FRAME_NONE : 1)),
  );
}
