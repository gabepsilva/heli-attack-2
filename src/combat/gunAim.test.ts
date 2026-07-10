import { describe, expect, it } from 'vitest';
import { GUN, PLAYER } from '../config/constants';
import {
  aimAngleDeg,
  createGunAimState,
  gunNeedsFlipY,
  gunPivotFromBody,
  muzzleWorld,
  normalizeAngleDeg,
  shortestAngleDelta,
  stepGunRotation,
  updateGunAim,
} from './gunAim';

describe('gunAim (issue #9 — mouse aiming & gun rotation)', () => {
  it('locks GUN constants to catalog machine-gun size, grip pivot, and Flash turn rate', () => {
    expect(GUN.spriteW).toBe(29);
    expect(GUN.spriteH).toBe(16);
    expect(GUN.pivotX).toBe(0.2);
    expect(GUN.pivotY).toBe(0.5);
    expect(GUN.muzzleLocalX).toBeCloseTo((1 - 0.2) * 29, 10);
    expect(GUN.muzzleLocalX).toBeCloseTo(23.2, 10);
    expect(GUN.muzzleLocalY).toBe(0);
    expect(GUN.turnDivisor).toBe(2);
    expect(GUN.attachX).toBe(PLAYER.boxW / 2);
    expect(GUN.attachX).toBe(5);
    expect(GUN.attachY).toBe(16);
  });

  it('aims accurately all the way around (cardinals + diagonals)', () => {
    const cases: Array<[number, number, number]> = [
      [100, 0, 0], // right
      [0, 100, 90], // down
      [-100, 0, 180], // left (Flash returns 180; normalize → ±180)
      [0, -100, -90], // up
      [100, 100, 45],
      [-100, 100, 135],
      [-100, -100, -135],
      [100, -100, -45],
    ];

    for (const [mx, my, expected] of cases) {
      const raw = aimAngleDeg(0, 0, mx, my);
      expect(normalizeAngleDeg(raw)).toBeCloseTo(expected, 10);
    }
  });

  it('shortest-path wrap matches Flash (±179 boundary)', () => {
    expect(shortestAngleDelta(170, -170)).toBeCloseTo(20, 10);
    expect(shortestAngleDelta(-170, 170)).toBeCloseTo(-20, 10);
    expect(shortestAngleDelta(0, 90)).toBe(90);
    expect(shortestAngleDelta(0, -90)).toBe(-90);
  });

  it('turns at Flash rate dif/2 per frame (timeStep=1)', () => {
    // 90° target from 0 → first frame moves 45°
    expect(stepGunRotation(0, 90, 1)).toBeCloseTo(45, 10);
    expect(stepGunRotation(0, 90, 0.5)).toBeCloseTo(22.5, 10);
    // After enough frames it settles on target
    let r = 0;
    for (let i = 0; i < 40; i += 1) {
      r = stepGunRotation(r, 90, 1);
    }
    expect(normalizeAngleDeg(r)).toBeCloseTo(90, 5);
  });

  it('flips Y when aiming into the left half-plane (|rot| > 90)', () => {
    expect(gunNeedsFlipY(0)).toBe(false);
    expect(gunNeedsFlipY(90)).toBe(false);
    expect(gunNeedsFlipY(-90)).toBe(false);
    expect(gunNeedsFlipY(91)).toBe(true);
    expect(gunNeedsFlipY(-91)).toBe(true);
    expect(gunNeedsFlipY(180)).toBe(true);
    expect(gunNeedsFlipY(-180)).toBe(true);
  });

  it('places the muzzle at the barrel tip for any angle', () => {
    const gunX = 50;
    const gunY = 100;
    const L = GUN.muzzleLocalX;

    const right = muzzleWorld(gunX, gunY, 0);
    expect(right.x).toBeCloseTo(gunX + L, 10);
    expect(right.y).toBeCloseTo(gunY, 10);

    const down = muzzleWorld(gunX, gunY, 90);
    expect(down.x).toBeCloseTo(gunX, 10);
    expect(down.y).toBeCloseTo(gunY + L, 10);

    const left = muzzleWorld(gunX, gunY, 180);
    expect(left.x).toBeCloseTo(gunX - L, 10);
    expect(left.y).toBeCloseTo(gunY, 10);

    const up = muzzleWorld(gunX, gunY, -90);
    expect(up.x).toBeCloseTo(gunX, 10);
    expect(up.y).toBeCloseTo(gunY - L, 10);

    // Diagonal 45°: tip is L along the unit vector (√2/2, √2/2)
    const diag = muzzleWorld(gunX, gunY, 45);
    const c = Math.SQRT1_2;
    expect(diag.x).toBeCloseTo(gunX + L * c, 10);
    expect(diag.y).toBeCloseTo(gunY + L * c, 10);

    // Y=0 local muzzle is invariant under flipY
    const flipped = muzzleWorld(gunX, gunY, 180, L, 0, true);
    expect(flipped.x).toBeCloseTo(left.x, 10);
    expect(flipped.y).toBeCloseTo(left.y, 10);
  });

  it('updateGunAim tracks the cursor and exposes a barrel-aligned muzzle', () => {
    const body = { x: 100, y: 200, w: PLAYER.boxW, h: PLAYER.boxH };
    const pivot = gunPivotFromBody(body);
    expect(pivot).toEqual({
      x: 100 + GUN.attachX,
      y: 200 + GUN.attachY,
    });

    let state = createGunAimState();
    // Mouse far to the right of the grip
    const mouse = { x: pivot.x + 200, y: pivot.y };
    for (let i = 0; i < 40; i += 1) {
      const result = updateGunAim(state, body, mouse, 1);
      state = result.state;
    }

    expect(normalizeAngleDeg(state.rotationDeg)).toBeCloseTo(0, 5);
    expect(state.flipY).toBe(false);

    const { muzzle } = updateGunAim(state, body, mouse, 1);
    expect(muzzle.x).toBeCloseTo(pivot.x + GUN.muzzleLocalX, 5);
    expect(muzzle.y).toBeCloseTo(pivot.y, 5);

    // Aim left — settles near ±180 and flips
    const leftMouse = { x: pivot.x - 200, y: pivot.y };
    for (let i = 0; i < 40; i += 1) {
      const result = updateGunAim(state, body, leftMouse, 1);
      state = result.state;
    }
    expect(Math.abs(normalizeAngleDeg(state.rotationDeg))).toBeCloseTo(180, 5);
    expect(state.flipY).toBe(true);

    const leftMuzzle = muzzleWorld(
      pivot.x,
      pivot.y,
      state.rotationDeg,
      GUN.muzzleLocalX,
      GUN.muzzleLocalY,
      state.flipY,
    );
    expect(leftMuzzle.x).toBeCloseTo(pivot.x - GUN.muzzleLocalX, 5);
    expect(leftMuzzle.y).toBeCloseTo(pivot.y, 5);
  });
});
