import { describe, expect, it } from 'vitest';
import { CAMERA, PLAYER } from '../config/constants';
import {
  centerCameraScroll,
  clampCameraScroll,
  followCameraScroll,
  type CameraTarget,
} from './followCamera';

/** Flash's own window (sw × sh) — the rules are stated in these numbers. */
const VIEW = { w: 450, h: 320 } as const;
/** Level1: 35 × 15 tiles of 50 px. */
const LEVEL = { w: 1750, h: 750 } as const;

function target(over: Partial<CameraTarget> = {}): CameraTarget {
  return {
    x: 800,
    y: 400,
    w: PLAYER.boxW,
    h: PLAYER.boxH,
    vx: 0,
    vy: 0,
    ...over,
  };
}

describe('followCamera — Flash heroAction scroll rules', () => {
  it('holds still while the player stands (no xchange / ychange)', () => {
    const scroll = { x: 600, y: 200 };
    expect(followCameraScroll(scroll, target(), VIEW, LEVEL)).toEqual(scroll);
  });

  it('pins the leading edge to the view centre when walking right', () => {
    const player = target({ vx: 5 });
    const next = followCameraScroll({ x: 0, y: 0 }, player, VIEW, LEVEL);
    // Flash: world._x = -(_x+width) + sw/2 + width → the box's left edge lands
    // on the horizontal centre of the view.
    expect(player.x - next.x).toBe(VIEW.w / 2);
  });

  it('pins the leading edge to the view centre when walking left', () => {
    const player = target({ x: 300, vx: -5 });
    const next = followCameraScroll({ x: 600, y: 0 }, player, VIEW, LEVEL);
    // Mirror image: the box's right edge lands on the centre.
    expect(player.x + player.w - next.x).toBe(VIEW.w / 2);
  });

  it('gives the trailing edge one player box of slack on a turn-around', () => {
    // Walking right pins the left edge to centre; the first left steps are
    // free until the right edge reaches the centre — a boxW-wide deadzone.
    const start = followCameraScroll(
      { x: 0, y: 0 },
      target({ vx: 5 }),
      VIEW,
      LEVEL,
    );
    const nudged = followCameraScroll(
      start,
      target({ x: 800 - PLAYER.boxW + 1, vx: -1 }),
      VIEW,
      LEVEL,
    );
    expect(nudged.x).toBe(start.x);

    const past = followCameraScroll(
      start,
      target({ x: 800 - PLAYER.boxW - 1, vx: -1 }),
      VIEW,
      LEVEL,
    );
    expect(past.x).toBeLessThan(start.x);
  });

  it('lets the player jump and fall inside the middle vertical band', () => {
    const scroll = { x: 600, y: 200 };
    const bandTop = scroll.y + VIEW.h * CAMERA.deadzoneTopFrac;
    const bandBottom = scroll.y + VIEW.h * CAMERA.deadzoneBottomFrac;

    // Rising, box top still below the band's top line.
    const rising = target({ y: bandTop + 1, vy: -8 });
    expect(followCameraScroll(scroll, rising, VIEW, LEVEL).y).toBe(scroll.y);

    // Falling, box bottom still above the band's bottom line.
    const falling = target({ y: bandBottom - PLAYER.boxH - 1, vy: 8 });
    expect(followCameraScroll(scroll, falling, VIEW, LEVEL).y).toBe(scroll.y);
  });

  it('follows a jump that leaves the top of the band (Flash sh/4)', () => {
    const scroll = { x: 600, y: 300 };
    const player = target({ y: 320, vy: -8 });
    const next = followCameraScroll(scroll, player, VIEW, LEVEL);
    expect(player.y - next.y).toBe(VIEW.h * CAMERA.deadzoneTopFrac);
  });

  it('follows a fall that leaves the bottom of the band (Flash sh - sh/4)', () => {
    const scroll = { x: 600, y: 0 };
    const player = target({ y: 300, vy: 8 });
    const next = followCameraScroll(scroll, player, VIEW, LEVEL);
    expect(player.y + player.h - next.y).toBe(
      VIEW.h * CAMERA.deadzoneBottomFrac,
    );
  });

  it('never scrolls past the map (Flash scrollMap hold)', () => {
    // Walking left at the map's left edge.
    const atLeft = followCameraScroll(
      { x: 0, y: 0 },
      target({ x: 20, vx: -5 }),
      VIEW,
      LEVEL,
    );
    expect(atLeft).toEqual({ x: 0, y: 0 });

    // Walking right at the map's right edge.
    const atRight = followCameraScroll(
      { x: LEVEL.w - VIEW.w, y: 0 },
      target({ x: LEVEL.w - 30, vx: 5 }),
      VIEW,
      LEVEL,
    );
    expect(atRight.x).toBe(LEVEL.w - VIEW.w);

    // Falling onto the floor.
    const atFloor = followCameraScroll(
      { x: 0, y: LEVEL.h - VIEW.h },
      target({ y: LEVEL.h - PLAYER.boxH, vy: 8 }),
      VIEW,
      LEVEL,
    );
    expect(atFloor.y).toBe(LEVEL.h - VIEW.h);
  });

  it('pins a map smaller than the view to its origin', () => {
    expect(
      clampCameraScroll({ x: 40, y: 40 }, VIEW, { w: 100, h: 100 }),
    ).toEqual({ x: 0, y: 0 });
  });

  it('centres on the player for the spawn snap (Flash heroDie)', () => {
    const player = target({ x: 800, y: 400 });
    const scroll = centerCameraScroll(player, VIEW, LEVEL);
    expect(scroll.x + VIEW.w / 2).toBe(player.x + player.w / 2);
    expect(scroll.y + VIEW.h / 2).toBe(player.y + player.h / 2);
  });

  it('clamps the spawn snap at the level1 start corner', () => {
    // Flash spawns the hero at tile-centre x with y = -50 (parachute drop), so
    // the centred scroll clamps to the map origin and he falls into view.
    const scroll = centerCameraScroll(target({ x: 20, y: -50 }), VIEW, LEVEL);
    expect(scroll).toEqual({ x: 0, y: 0 });
  });
});
