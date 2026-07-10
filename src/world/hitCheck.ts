import { getTile, type TileMap } from './tileMap';

/**
 * Port of the original Flash `hitCheck(mapa, cy, cx, cy2, cx2, type, equal, hold)`.
 *
 * Scans the inclusive tile rectangle `[cx..cx2] × [cy..cy2]` for cells in the
 * collidable range `[0, 100)`. With `equal=1`, counts cells `== type`; with
 * `equal=0` (default), counts cells `!= type`. When `hold=0` (default), returns
 * `1` on the first match; when `hold=1`, returns the full count.
 *
 * Callers (X resolve) use `type=1, equal=1, hold=1` to count solid tiles;
 * Y resolve uses `type=0, equal=0` to detect any non-empty cell.
 */
export function hitCheck(
  map: TileMap,
  cy: number,
  cx: number,
  cy2: number,
  cx2: number,
  type = 1,
  equal = 0,
  hold = 0,
): number {
  let count = 0;

  for (let y = cy; y <= cy2; y += 1) {
    for (let x = cx; x <= cx2; x += 1) {
      const cell = getTile(map, x, y);
      if (cell < 0 || cell >= 100) {
        continue;
      }
      const matches = equal ? cell === type : cell !== type;
      if (!matches) {
        continue;
      }
      count += 1;
      if (!hold) {
        return 1;
      }
    }
  }

  return count;
}
