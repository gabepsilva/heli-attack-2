import { WORLD } from '../config/constants';

/** Empty / air cell — no collision. */
export const TILE_EMPTY = 0;

/** Solid collision cell (floor, wall, platform). */
export const TILE_SOLID = 1;

/**
 * Row-major tile grid. `cells[row][col]` holds a collision type in `[0, 100)`
 * matching the original Flash map cell `[0]` slot (0 = empty, 1 = solid).
 */
export type TileGrid = readonly (readonly number[])[];

export interface TileMap {
  readonly width: number;
  readonly height: number;
  /** Pixel size of one tile edge — always {@link WORLD.tile} (50). */
  readonly tileSize: number;
  readonly cells: TileGrid;
}

/** Build a TileMap, validating a rectangular grid and locking tile size to spec. */
export function createTileMap(
  cells: TileGrid,
  tileSize: number = WORLD.tile,
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
  if (tileSize !== WORLD.tile) {
    throw new Error(
      `tileSize must be WORLD.tile (${WORLD.tile}), got ${tileSize}`,
    );
  }
  return { width, height, tileSize, cells };
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
