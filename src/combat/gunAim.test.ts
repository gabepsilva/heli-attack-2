import { describe, expect, it } from 'vitest';
import { GUN, PLAYER } from '../config/constants';
import { DEFAULT_HELD_GUN, heldGunFor } from './heldGun';
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

const MG_MUZZLE = DEFAULT_HELD_GUN.muzzle;

describe('gunAim (issue #9 — mouse aiming & gun rotation)', () => {
  it('holds the gun at the hand — a fixed mount, not a per-weapon offset', () => {
    // GUN describes the *hand*. Size, grip and muzzle belong to the weapon.
    expect(GUN.attachX).toBe(4.2);
    expect(GUN.attachY).toBe(20);
    // Roughly centred on the 10×42 collision box: a chest mount.
    expect(GUN.attachX).toBeLessThan(PLAYER.boxW);
    expect(GUN.attachY).toBeLessThan(PLAYER.boxH);
    expect(GUN.turnDivisor).toBe(2);
    expect(GUN).not.toHaveProperty('spriteW');
    expect(GUN).not.toHaveProperty('muzzleLocalX');
  });

  it('fires each weapon from its own barrel, not the machine gun’s', () => {
    // A 21px held mine and a 57px railgun cannot share a muzzle offset.
    const mg = heldGunFor(0).muzzle;
    const rail = heldGunFor(11).muzzle;
    const mine = heldGunFor(9).muzzle;
    expect(rail.x).toBeGreaterThan(mg.x);
    expect(mine.x).toBeLessThan(mg.x);
    // The barrel always sits above the grip.
    for (let i = 0; i < 13; i += 1) {
      expect(heldGunFor(i).muzzle.y, `weapon ${i}`).toBeLessThan(0);
    }
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
    const { x: lx, y: ly } = MG_MUZZLE;
    const reach = Math.hypot(lx, ly);

    // The barrel tip is rigidly attached to the grip: it swings around it at a
    // constant reach, whatever the aim.
    for (const deg of [0, 45, 90, 135, 180, -45, -90, -135]) {
      const m = muzzleWorld(gunX, gunY, deg);
      expect(Math.hypot(m.x - gunX, m.y - gunY), `${deg}°`).toBeCloseTo(
        reach,
        10,
      );
    }

    // Aiming right, the tip leads the grip and rides above it.
    const right = muzzleWorld(gunX, gunY, 0);
    expect(right.x).toBeCloseTo(gunX + lx, 10);
    expect(right.y).toBeCloseTo(gunY + ly, 10);
    expect(right.y).toBeLessThan(gunY);

    // Aiming straight down, the barrel points down and the tip's offset swings
    // to the side rather than staying above the hand.
    const down = muzzleWorld(gunX, gunY, 90);
    expect(down.y).toBeCloseTo(gunY + lx, 10);
    expect(down.x).toBeCloseTo(gunX - ly, 10);

    // Aiming left, Flash mirrors the gun (`_yscale = -100`) so the barrel stays
    // above the hand instead of hanging under it.
    const leftFlipped = muzzleWorld(gunX, gunY, 180, lx, ly, true);
    expect(leftFlipped.x).toBeCloseTo(gunX - lx, 10);
    expect(leftFlipped.y).toBeCloseTo(gunY + ly, 10);
    expect(leftFlipped.y).toBeLessThan(gunY);

    // Without the mirror it would — that is the bug the flip exists to avoid.
    const leftUnflipped = muzzleWorld(gunX, gunY, 180, lx, ly, false);
    expect(leftUnflipped.y).toBeGreaterThan(gunY);
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
    expect(muzzle.x).toBeCloseTo(pivot.x + MG_MUZZLE.x, 5);
    expect(muzzle.y).toBeCloseTo(pivot.y + MG_MUZZLE.y, 5);

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
      MG_MUZZLE.x,
      MG_MUZZLE.y,
      state.flipY,
    );
    expect(leftMuzzle.x).toBeCloseTo(pivot.x - MG_MUZZLE.x, 5);
    // Mirroring the gun keeps the barrel above the hand, not below it.
    expect(leftMuzzle.y).toBeCloseTo(pivot.y + MG_MUZZLE.y, 5);
  });
});
