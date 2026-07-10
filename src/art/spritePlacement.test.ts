import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { gameDrawSize, getSpriteDef } from './catalog';
import {
  explosionAgeScale,
  playerSpritePlacement,
  scaledDisplaySize,
} from './spritePlacement';

describe('sprite placement', () => {
  it('anchors player placeholder on AABB bottom-center with spec draw size', () => {
    const body = { x: 100, y: 200, w: PLAYER.boxW, h: PLAYER.boxH };
    const def = getSpriteDef('player_idle');
    const p = playerSpritePlacement(body, def);

    expect(PLAYER.boxW).toBe(10);
    expect(PLAYER.boxH).toBe(42);
    expect(p).toEqual({
      x: 100 + 5,
      y: 200 + 42,
      displayW: 48,
      displayH: 48,
      originX: 0.5,
      originY: 1,
    });
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
});
