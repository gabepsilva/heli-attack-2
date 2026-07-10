/**
 * Axis-aligned body used by the tile resolver.
 * `(x, y)` is the **top-left** of the collision box (not the sprite center).
 */
export interface AabbBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** True after a downward collision snap this frame (resting on a floor). */
  onGround: boolean;
}

export function createAabbBody(
  x: number,
  y: number,
  w: number,
  h: number,
): AabbBody {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false };
}
