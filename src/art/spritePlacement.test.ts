import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { getSpriteDef } from './catalog';
import { playerSpritePlacement } from './spritePlacement';

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
