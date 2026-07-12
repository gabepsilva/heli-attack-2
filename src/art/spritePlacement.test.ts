import { describe, expect, it } from 'vitest';
import { TILE_ART_SIZE } from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import { gameDrawSize, getSpriteDef } from './catalog';
import {
  TILE_ART_OFFSET,
  chuteOpenDisplaySize,
  explosionAgeScale,
  playerSpritePlacement,
  railBeamAlpha,
  scaledDisplaySize,
  tilePlacement,
} from './spritePlacement';

describe('sprite placement', () => {
  it('anchors player on AABB bottom-center at Flash original draw size', () => {
    const body = { x: 100, y: 200, w: PLAYER.boxW, h: PLAYER.boxH };
    const def = getSpriteDef('player_idle');
    const p = playerSpritePlacement(body, def);

    expect(PLAYER.boxW).toBe(10);
    expect(PLAYER.boxH).toBe(42);
    expect(p).toEqual({
      x: 100 + 5,
      y: 200 + 42,
      displayW: 24,
      displayH: 49,
      originX: 0.5,
      originY: 1,
    });
  });
});

describe('ground tile placement (Flash drawMap parity)', () => {
  it('centers the 52px tile art on the 50px cell — the 1px Flash bleed', () => {
    expect(TILE_ART_SIZE).toBe(52);
    expect(WORLD.tile).toBe(50);
    // Flash: temp._x = x * tileWidth - 1, temp._y = y * tileHeight - 1.
    expect(TILE_ART_OFFSET).toBe(-1);
    expect(tilePlacement(0, 0, 0, 0)).toEqual({
      x: -1,
      y: -1,
      displayW: 52,
      displayH: 52,
      originX: 0,
      originY: 0,
    });
    expect(tilePlacement(3, 2, 100, 40)).toMatchObject({
      x: 100 + 3 * 50 - 1,
      y: 40 + 2 * 50 - 1,
    });
  });

  it('overlaps neighbouring tiles so no seam can open at fractional scales', () => {
    const left = tilePlacement(4, 7, 0, 0);
    const right = tilePlacement(5, 7, 0, 0);
    const below = tilePlacement(4, 8, 0, 0);

    // Each tile covers its whole cell...
    expect(left.x).toBeLessThan(4 * WORLD.tile);
    expect(left.x + left.displayW).toBeGreaterThan(5 * WORLD.tile);
    // ...and shares a 2px band with each neighbour.
    expect(left.x + left.displayW - right.x).toBe(2);
    expect(left.y + left.displayH - below.y).toBe(2);
  });
});

describe('atlas display sizing (#34 lead review — setScale must not wipe setDisplaySize)', () => {
  it('locks gun game draw size to GUN / catalog (29×16), not native 116×64 texture', () => {
    const gun = gameDrawSize(getSpriteDef('weapon_machinegun'));
    expect(gun).toEqual({ w: 29, h: 16 });
    // Native atlas frame is 4× — display must stay at Flash game units.
    expect(getSpriteDef('weapon_machinegun').originalW * 4).toBe(116);
  });

  it('grows explosion from catalog 120×120 base to 2.5× at end of life', () => {
    const base = gameDrawSize(getSpriteDef('explosion'));
    expect(base).toEqual({ w: 120, h: 120 });
    expect(explosionAgeScale(0, 20)).toBe(1);
    expect(explosionAgeScale(20, 20)).toBe(2.5);
    expect(scaledDisplaySize(base.w, base.h, explosionAgeScale(0, 20))).toEqual(
      { w: 120, h: 120 },
    );
    expect(
      scaledDisplaySize(base.w, base.h, explosionAgeScale(20, 20)),
    ).toEqual({ w: 300, h: 300 });
    // Mid-life: age 10 / 20 → scale 1.75 → 210×210
    expect(
      scaledDisplaySize(base.w, base.h, explosionAgeScale(10, 20)),
    ).toEqual({ w: 210, h: 210 });
  });

  it('flashes the rail beam at full alpha once, then fades it to zero', () => {
    // The sim steps before the scene draws, so a beam is age 1 when first seen.
    const linger = 3;
    expect(railBeamAlpha(1, linger)).toBe(1);
    expect(railBeamAlpha(2, linger)).toBe(0.5);
    expect(railBeamAlpha(3, linger)).toBe(0);
    // Never inverts or overshoots, whatever the caller passes.
    expect(railBeamAlpha(99, linger)).toBe(0);
    expect(railBeamAlpha(0, linger)).toBe(1);
    expect(railBeamAlpha(5, 1)).toBe(1);
    expect(railBeamAlpha(5, 0)).toBe(1);
  });

  it('opens the chute with height leading width, clamped at the full canopy', () => {
    const base = gameDrawSize(getSpriteDef('player_chute'));
    expect(base).toEqual({ w: 126, h: 126 });
    // Half open: width tracks openness, height runs ahead by the bulge.
    expect(chuteOpenDisplaySize(base, 0.5, 0.15)).toEqual({
      w: 63,
      h: 126 * 0.65,
    });
    // Fully open: the bulge cannot push height past the canopy size.
    expect(chuteOpenDisplaySize(base, 1, 0.15)).toEqual({ w: 126, h: 126 });
  });
});
