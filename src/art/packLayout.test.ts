import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ATLAS_MAX_SIZE,
  ATLAS_PADDING,
} from '../config/art';
import { SPRITE_DEFS, textureSize } from './catalog';
import { packRects, rectsOverlapFree } from './packLayout';

describe('atlas pack layout (issue #32)', () => {
  it('packs every catalog sprite within ATLAS_MAX_SIZE without overlap', () => {
    const inputs = SPRITE_DEFS.map((def) => {
      const { w, h } = textureSize(def);
      return { id: def.id, w, h };
    });

    const result = packRects(inputs, ATLAS_PADDING, ATLAS_MAX_SIZE);

    expect(result.rects).toHaveLength(SPRITE_DEFS.length);
    expect(result.width).toBeLessThanOrEqual(ATLAS_MAX_SIZE);
    expect(result.height).toBeLessThanOrEqual(ATLAS_MAX_SIZE);
    expect(result.width & (result.width - 1)).toBe(0); // power of two
    expect(result.height & (result.height - 1)).toBe(0);
    expect(rectsOverlapFree(result.rects)).toBe(true);

    for (const rect of result.rects) {
      const def = SPRITE_DEFS.find((s) => s.id === rect.id)!;
      const tex = textureSize(def);
      expect(rect.w).toBe(tex.w);
      expect(rect.h).toBe(tex.h);
      expect(rect.x).toBeGreaterThanOrEqual(ATLAS_PADDING);
      expect(rect.y).toBeGreaterThanOrEqual(ATLAS_PADDING);
      expect(rect.x + rect.w + ATLAS_PADDING).toBeLessThanOrEqual(result.width);
      expect(rect.y + rect.h + ATLAS_PADDING).toBeLessThanOrEqual(
        result.height,
      );
    }
  });

  it('uses world final 4× texture sizes when packing helis', () => {
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    const heli = textureSize(SPRITE_DEFS.find((s) => s.id === 'heli')!);
    expect(heli).toEqual({ w: 848, h: 424 });
  });

  it('throws when a single frame cannot fit', () => {
    expect(() =>
      packRects([{ id: 'huge', w: 5000, h: 10 }], 2, ATLAS_MAX_SIZE),
    ).toThrow(/exceeds atlas max/);
  });
});
