import { describe, expect, it } from 'vitest';
import { BG_TILE_FRAME_IDS, bgTileFrameForCell } from '../art/catalog';
import { BG_LAYER_SCROLL_FACTOR, bgFrameAt, createBgLayer } from './bgLayer';
import { LEVEL1_BG_FRAMES, LEVEL1_COLS, createLevel1BgLayer } from './level1';
import { TILE_FRAME_NONE } from './tileMap';

describe('bgLayer — Flash bglayer1 parallax foliage', () => {
  it('drifts at half the world scroll speed (Flash bglayer1._x -= sdx / 2)', () => {
    expect(BG_LAYER_SCROLL_FACTOR).toBe(0.5);
  });

  it('repeats horizontally so a narrow layer covers a wide level', () => {
    const layer = createBgLayer([
      [1, 0, 2],
      [0, 2, 0],
    ]);
    expect(layer.cols).toBe(3);
    expect(layer.rows).toBe(2);

    expect(bgFrameAt(layer, 0, 0)).toBe(1);
    expect(bgFrameAt(layer, 2, 0)).toBe(2);
    // Past the right edge the pattern starts over...
    expect(bgFrameAt(layer, 3, 0)).toBe(1);
    expect(bgFrameAt(layer, 5, 0)).toBe(2);
    // ...and negative columns wrap the same way (camera panning left).
    expect(bgFrameAt(layer, -1, 0)).toBe(2);
    expect(bgFrameAt(layer, -3, 0)).toBe(1);
  });

  it('reads rows outside the layer as blank', () => {
    const layer = createBgLayer([[1]]);
    expect(bgFrameAt(layer, 0, -1)).toBe(TILE_FRAME_NONE);
    expect(bgFrameAt(layer, 0, 1)).toBe(TILE_FRAME_NONE);
  });

  it('rejects empty or jagged grids', () => {
    expect(() => createBgLayer([])).toThrow(/at least one row/);
    expect(() => createBgLayer([[]])).toThrow(/at least one column/);
    expect(() => createBgLayer([[0, 1], [0]])).toThrow(/width/);
  });
});

describe('level 1 foliage layer (decompiled bglayer1_1)', () => {
  const layer = createLevel1BgLayer();

  it('is the decompiled 20×15 grid, narrower than the 35-col level', () => {
    expect(layer.cols).toBe(20);
    expect(layer.rows).toBe(15);
    expect(layer.cols).toBeLessThan(LEVEL1_COLS);
    expect(LEVEL1_BG_FRAMES[14]).toEqual([
      2, 1, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 0, 1, 2,
    ]);
    // Trunks (2) grow up into crowns (1) on the rows above.
    expect(LEVEL1_BG_FRAMES[13]![0]).toBe(2);
    expect(LEVEL1_BG_FRAMES[12]![0]).toBe(1);
  });

  it('tiles a seamless 10-column pattern — why Flash wraps at half width', () => {
    for (let row = 0; row < layer.rows; row += 1) {
      expect(LEVEL1_BG_FRAMES[row]!.slice(0, 10)).toEqual(
        LEVEL1_BG_FRAMES[row]!.slice(10, 20),
      );
    }
  });

  it('resolves every foliage frame to a real bg tileset sprite', () => {
    expect(BG_TILE_FRAME_IDS).toEqual(['bg_tile_01', 'bg_tile_02']);
    for (let row = 0; row < layer.rows; row += 1) {
      for (let col = 0; col < LEVEL1_COLS; col += 1) {
        const frame = bgFrameAt(layer, col, row);
        const sprite = bgTileFrameForCell(frame);
        if (frame === TILE_FRAME_NONE) {
          expect(sprite).toBeNull();
        } else {
          expect(sprite, `${col},${row}`).toBe(BG_TILE_FRAME_IDS[frame - 1]);
        }
      }
    }
  });

  it('keeps the foliage decorative — it never adds collision', () => {
    // bglayer1 is drawn with realmap = 0; the level's collision grid is the
    // only source of solids, so foliage columns stay walkable.
    expect(bgFrameAt(layer, 0, 14)).toBeGreaterThan(0);
    expect(createLevel1BgLayer()).not.toHaveProperty('cells');
  });
});
