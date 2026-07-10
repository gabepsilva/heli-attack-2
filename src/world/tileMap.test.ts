import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/constants';
import { hitCheck } from './hitCheck';
import {
  TILE_EMPTY,
  TILE_SOLID,
  createTileMap,
  getTile,
  isSolidTile,
} from './tileMap';

describe('tileMap', () => {
  it('locks tile size to the spec value of 50', () => {
    const map = createTileMap([
      [0, 1],
      [1, 0],
    ]);
    expect(map.tileSize).toBe(50);
    expect(map.tileSize).toBe(WORLD.tile);
    expect(map.width).toBe(2);
    expect(map.height).toBe(2);
  });

  it('rejects a non-spec tile size', () => {
    expect(() => createTileMap([[0]], 32)).toThrow(/WORLD\.tile/);
  });

  it('rejects empty or jagged grids', () => {
    expect(() => createTileMap([])).toThrow(/at least one row/);
    expect(() => createTileMap([[]])).toThrow(/at least one column/);
    expect(() => createTileMap([[0, 1], [0]])).toThrow(/width/);
  });

  it('treats out-of-bounds as solid so bodies cannot leave the map', () => {
    const map = createTileMap([[TILE_EMPTY]]);
    expect(getTile(map, -1, 0)).toBe(TILE_SOLID);
    expect(getTile(map, 0, -1)).toBe(TILE_SOLID);
    expect(getTile(map, 1, 0)).toBe(TILE_SOLID);
    expect(isSolidTile(map, -1, 0)).toBe(true);
    expect(isSolidTile(map, 0, 0)).toBe(false);
  });
});

describe('hitCheck (Flash port)', () => {
  // 3×3: solid ring, empty center
  const map = createTileMap([
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ]);

  it('returns 1 on first solid match when equal=1 hold=0 (X-style probe)', () => {
    // Probe the right column (all solid) — early-out returns 1.
    expect(hitCheck(map, 0, 2, 2, 2, 1, 1, 0)).toBe(1);
  });

  it('counts all matching solids when hold=1 (X resolve uses this)', () => {
    // Full right column: 3 solids == type 1.
    expect(hitCheck(map, 0, 2, 2, 2, 1, 1, 1)).toBe(3);
    // Center column: only top+bottom solid → 2.
    expect(hitCheck(map, 0, 1, 2, 1, 1, 1, 1)).toBe(2);
  });

  it('detects non-empty cells with type=0 equal=0 (Y resolve)', () => {
    // Bottom row is all solid → hit.
    expect(hitCheck(map, 2, 0, 2, 2, 0)).toBe(1);
    // Center cell alone is empty → no hit.
    expect(hitCheck(map, 1, 1, 1, 1, 0)).toBe(0);
  });

  it('ignores cells outside the collidable [0, 100) range', () => {
    const special = createTileMap([[100], [0]]);
    expect(hitCheck(special, 0, 0, 0, 0, 1, 1, 1)).toBe(0);
    expect(hitCheck(special, 1, 0, 1, 0, 0)).toBe(0);
  });
});
