/**
 * Shelf bin-packer for atlas frames (pure, unit-tested).
 * `scripts/art/pack-atlas.mjs` imports this directly, so the packed atlas and
 * the tests that assert rects fit in bounds without overlap run the same code.
 */

export type PackInput = Readonly<{
  id: string;
  w: number;
  h: number;
}>;

export type PackedRect = Readonly<{
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}>;

export type PackResult = Readonly<{
  width: number;
  height: number;
  rects: readonly PackedRect[];
}>;

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) {
    p *= 2;
  }
  return p;
}

/**
 * Shelf-pack rectangles left-to-right, top-to-bottom.
 * Sorts by descending height for denser shelves. `padding` is empty space
 * between frames (not added to frame size).
 */
export function packRects(
  items: readonly PackInput[],
  padding: number,
  maxSize: number,
): PackResult {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const rects: PackedRect[] = [];

  let shelfY = padding;
  let shelfH = 0;
  let cursorX = padding;
  let usedW = 0;
  let usedH = 0;

  for (const item of sorted) {
    if (item.w + padding * 2 > maxSize || item.h + padding * 2 > maxSize) {
      throw new Error(
        `Frame "${item.id}" (${item.w}×${item.h}) exceeds atlas max ${maxSize} with padding`,
      );
    }

    if (cursorX + item.w + padding > maxSize) {
      shelfY += shelfH + padding;
      cursorX = padding;
      shelfH = 0;
    }

    if (shelfY + item.h + padding > maxSize) {
      throw new Error(
        `Atlas overflow packing "${item.id}" — increase max size or drop large frames`,
      );
    }

    rects.push({ id: item.id, x: cursorX, y: shelfY, w: item.w, h: item.h });
    cursorX += item.w + padding;
    shelfH = Math.max(shelfH, item.h);
    usedW = Math.max(usedW, cursorX);
    usedH = Math.max(usedH, shelfY + item.h + padding);
  }

  return {
    width: nextPowerOfTwo(Math.max(1, usedW)),
    height: nextPowerOfTwo(Math.max(1, usedH)),
    rects,
  };
}

/** True when no two rects overlap (padding gaps allowed). */
export function rectsOverlapFree(rects: readonly PackedRect[]): boolean {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i]!;
      const b = rects[j]!;
      const separate =
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y;
      if (!separate) {
        return false;
      }
    }
  }
  return true;
}
