import { TILE_FRAME_NONE, type TileFrameGrid } from './tileMap';

/**
 * Decorative foliage layer behind the ground — Flash `bglayer1`, built by
 * `drawMap(bglayer1map, "bglayer1", 0, "bg", 0)`. The trailing `0` is
 * `realmap`, so it never becomes the collision map: cells carry a visual frame
 * only. It sits at depth 0, below the ground (`world`, depth 1) and above the
 * static sky plate.
 *
 * The layer is narrower than the level and repeats horizontally, which is how
 * Flash can scroll it forever from a fixed grid.
 */
export interface BgLayer {
  readonly cols: number;
  readonly rows: number;
  /** Visual frames into the `bg` tileset (0 = blank). */
  readonly frames: TileFrameGrid;
}

/**
 * Flash `bglayer1._x -= sdx / 2` — the layer drifts at half the world's
 * horizontal scroll speed, which reads as distance behind the ground now that
 * the camera follows the player. Applied as a scroll factor at draw time; the
 * vertical axis stays 1:1 so the foliage keeps its footing in the ground (Flash
 * drove `bglayer1._y` off the camera's height instead).
 */
export const BG_LAYER_SCROLL_FACTOR = 0.5;

/** Build a foliage layer, validating a rectangular frame grid. */
export function createBgLayer(frames: TileFrameGrid): BgLayer {
  if (frames.length === 0) {
    throw new Error('BgLayer must have at least one row');
  }
  const rows = frames.length;
  const cols = frames[0]!.length;
  if (cols === 0) {
    throw new Error('BgLayer rows must have at least one column');
  }
  for (let row = 0; row < rows; row += 1) {
    if (frames[row]!.length !== cols) {
      throw new Error(
        `BgLayer row ${row} width ${frames[row]!.length} != ${cols}`,
      );
    }
  }
  return { cols, rows, frames };
}

/**
 * Frame at (col, row), repeating horizontally so a narrow layer can cover a
 * wide level. Rows outside the layer are blank — the level is taller than the
 * foliage, not the other way round.
 */
export function bgFrameAt(layer: BgLayer, col: number, row: number): number {
  if (row < 0 || row >= layer.rows) {
    return TILE_FRAME_NONE;
  }
  const wrapped = ((col % layer.cols) + layer.cols) % layer.cols;
  return layer.frames[row]![wrapped]!;
}
