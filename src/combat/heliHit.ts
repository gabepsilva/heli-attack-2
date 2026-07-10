/**
 * Pixel-accurate heli hit test — mirrors Flash `enemy.hit.hitTest(bulletX, bulletY, 1)`.
 * Mask is baked from the atlas `heli` frame alpha channel (see heliHitMask.generated.ts).
 */

import {
  HELI_HIT_MASK_B64,
  HELI_HIT_MASK_H,
  HELI_HIT_MASK_W,
} from './heliHitMask.generated';

/** Decoded 1-bit mask row-major (1 = opaque / hittable). */
let decodedMask: Uint8Array | null = null;

function getMask(): Uint8Array {
  if (decodedMask) {
    return decodedMask;
  }
  const binary = atob(HELI_HIT_MASK_B64);
  decodedMask = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    decodedMask[i] = binary.charCodeAt(i);
  }
  return decodedMask;
}

/** Reset cached mask (tests only). */
export function resetHeliHitMaskCache(): void {
  decodedMask = null;
}

function maskBit(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= HELI_HIT_MASK_W || y >= HELI_HIT_MASK_H) {
    return false;
  }
  const bytesPerRow = Math.ceil(HELI_HIT_MASK_W / 8);
  const byteIndex = y * bytesPerRow + (x >> 3);
  const bitOffset = 7 - (x & 7);
  const mask = getMask();
  return ((mask[byteIndex]! >> bitOffset) & 1) === 1;
}

export type HeliHitTarget = Readonly<{
  /** Heli center in arena/world space (Flash `_x`, `_y`). */
  x: number;
  y: number;
  spriteW: number;
  spriteH: number;
}>;

/**
 * Flash hitTest: bullet point vs heli `hit` clip alpha.
 * Local space: top-left of the 212×106 sprite box centered on `(x, y)`.
 */
export function bulletHitsHeli(
  bulletX: number,
  bulletY: number,
  heli: HeliHitTarget,
): boolean {
  const left = heli.x - heli.spriteW / 2;
  const top = heli.y - heli.spriteH / 2;
  const localX = Math.floor(bulletX - left);
  const localY = Math.floor(bulletY - top);
  return maskBit(localX, localY);
}

export const HELI_HIT_MASK_SIZE = {
  w: HELI_HIT_MASK_W,
  h: HELI_HIT_MASK_H,
} as const;
