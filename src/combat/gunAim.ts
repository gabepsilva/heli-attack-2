/**
 * Mouse aiming & gun rotation — plain math matching HA2 Flash `heroAction`.
 * Phaser only feeds mouse coords and draws the result.
 *
 * Flash source (decompiled):
 *   gunrotation = 360 - atan2(gunX - mouseX, gunY - mouseY) * 180/PI - 90
 *   gun._rotation += dif/2 * timeStep   (shortest-path wrap)
 *   gun._yscale = (|rotation| > 90) ? -100 : 100
 *   muzzle = gun.barrell.localToGlobal(...)
 */

import { GUN } from '../config/constants';
import { DEFAULT_HELD_GUN, type HeldGun } from './heldGun';
import type { AabbBody } from '../world/aabbBody';

export type Vec2 = Readonly<{ x: number; y: number }>;

export type GunAimState = {
  /** Current gun rotation in degrees (Flash / Phaser angle, 0 = +X). */
  rotationDeg: number;
  /** True when the gun is flipped on Y (aiming into the left half-plane). */
  flipY: boolean;
};

/** Fresh aim state (gun pointing right). */
export function createGunAimState(): GunAimState {
  return { rotationDeg: 0, flipY: false };
}

/**
 * Target aim angle in degrees from gun pivot → mouse.
 * Matches Flash `360 - atan2(gx-mx, gy-my)*180/PI - 90` (0 = right, 90 = down).
 */
export function aimAngleDeg(
  gunX: number,
  gunY: number,
  mouseX: number,
  mouseY: number,
): number {
  return 360 - (Math.atan2(gunX - mouseX, gunY - mouseY) * 180) / Math.PI - 90;
}

/** Wrap degrees into (-180, 180]. */
export function normalizeAngleDeg(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/**
 * Shortest signed delta from `fromDeg` to `toDeg` in (-180, 180], matching
 * Flash `dif>179 ? -360+dif : dif<-179 ? 360+dif : dif`.
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  const from = ((fromDeg % 360) + 360) % 360;
  const to = ((toDeg % 360) + 360) % 360;
  let dif = to - from;
  if (dif > 179) {
    dif = -360 + dif;
  } else if (dif < -179) {
    dif = 360 + dif;
  }
  return dif;
}

/**
 * One sim-frame of gun turn toward the target (Flash `dif/2*timeStep`).
 * Returns the new rotation in degrees (not normalized — continuous like Flash).
 */
export function stepGunRotation(
  currentDeg: number,
  targetDeg: number,
  timeStep: number,
  turnDivisor: number = GUN.turnDivisor,
): number {
  const dif = shortestAngleDelta(currentDeg, targetDeg);
  return currentDeg + (dif / turnDivisor) * timeStep;
}

/**
 * Flash `gun._yscale = -100` when rotation is past ±90° (left half-plane).
 * Keeps the barrel sprite right-side-up while aiming left.
 */
export function gunNeedsFlipY(rotationDeg: number): boolean {
  const r = normalizeAngleDeg(rotationDeg);
  return r > 90 || r < -90;
}

/** World-space gun grip/pivot from the player collision AABB. */
export function gunPivotFromBody(
  body: Readonly<Pick<AabbBody, 'x' | 'y'>>,
  attachX: number = GUN.attachX,
  attachY: number = GUN.attachY,
): Vec2 {
  return { x: body.x + attachX, y: body.y + attachY };
}

/**
 * World-space muzzle tip for the current gun pose.
 * Local muzzle is along the barrel (+X), measured from the grip; aiming left
 * mirrors the gun about the barrel, so the local Y flips with it.
 */
export function muzzleWorld(
  gunX: number,
  gunY: number,
  rotationDeg: number,
  localX: number = DEFAULT_HELD_GUN.muzzle.x,
  localY: number = DEFAULT_HELD_GUN.muzzle.y,
  flipY: boolean = false,
): Vec2 {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ly = flipY ? -localY : localY;
  return {
    x: gunX + cos * localX - sin * ly,
    y: gunY + sin * localX + cos * ly,
  };
}

/**
 * Advance aim state one sim tick toward the mouse (arena / world space).
 * Returns the updated state and the muzzle point for that pose.
 */
export function updateGunAim(
  state: GunAimState,
  body: Readonly<Pick<AabbBody, 'x' | 'y' | 'w' | 'h'>>,
  mouse: Vec2,
  timeStep: number,
  heldGun: HeldGun = DEFAULT_HELD_GUN,
): { state: GunAimState; pivot: Vec2; muzzle: Vec2; targetDeg: number } {
  const pivot = gunPivotFromBody(body);
  const targetDeg = aimAngleDeg(pivot.x, pivot.y, mouse.x, mouse.y);
  const rotationDeg = stepGunRotation(state.rotationDeg, targetDeg, timeStep);
  const flipY = gunNeedsFlipY(rotationDeg);
  const next: GunAimState = { rotationDeg, flipY };
  const muzzle = muzzleWorld(
    pivot.x,
    pivot.y,
    rotationDeg,
    heldGun.muzzle.x,
    heldGun.muzzle.y,
    flipY,
  );
  return { state: next, pivot, muzzle, targetDeg };
}
