/**
 * Flash-parity scrolling camera (#116 follow-up).
 *
 * The original ran a small `sw`×`sh` window over a much larger map and moved
 * the `world` clip under it, so the level scrolled around the hero instead of
 * sitting on screen whole. From `heroAction` in
 * `reference/spec/heli2-actionscript.txt`:
 *
 * ```
 * if (xchange>0 && (_x+width)-(-world._x) > sw/2+width) world._x = -(_x+width)+sw/2+width;
 * if (xchange<0 && (_x)-(-world._x) < sw/2-width)       world._x = -(_x)+sw/2-width;
 * if (ychange>0 && (_y+height)-(-world._y) > sh-sh/4)   world._y = -(_y+height)+sh-sh/4;
 * if (ychange<0 && (_y)-(-world._y) < sh/4)             world._y = -(_y)+sh/4;
 * ```
 *
 * `-world._x` is the window's left edge in world px — that is what
 * {@link CameraScroll} holds. Read as a deadzone the rules are:
 *
 * - **Horizontal**: the camera only moves while the player is walking, and only
 *   far enough to pin the *leading* edge of the player box to the middle of the
 *   view. The trailing edge gives one player-box of slack, so a turn-around
 *   costs {@link PlayerConstants.boxW} px before the view starts back.
 * - **Vertical**: the player box stays inside the middle half of the view
 *   ({@link CAMERA.deadzoneTopFrac}..{@link CAMERA.deadzoneBottomFrac}). Jumps
 *   and falls inside that band do not move the camera at all.
 *
 * `scrollMap(..., hold = 1)` then clamps the window to the map, which is
 * {@link clampCameraScroll}. No smoothing anywhere: Flash snaps the clip on the
 * same frame the player moves, and so do we.
 */

import { CAMERA } from '../config/constants';

/** Top-left of the visible window in world px (Flash `-world._x` / `-world._y`). */
export interface CameraScroll {
  x: number;
  y: number;
}

/** Size of the visible window in world px (Flash `sw` × `sh`). */
export interface CameraViewSize {
  w: number;
  h: number;
}

/** Size of the scrollable map in world px (Flash `map` × `tileWidth`). */
export interface CameraLevelSize {
  w: number;
  h: number;
}

/**
 * What the camera reads off the player: the collision box (Flash `_x`, `_y`,
 * `width`, `height` — `_x`/`_y` are the box's **top-left**) plus this frame's
 * motion. Flash tests `xchange`/`ychange`; velocity carries the same sign, and
 * an {@link AabbBody} satisfies this shape as-is.
 */
export interface CameraTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Flash `scrollMap(..., hold = 1)` — the window never leaves the map. A map
 * smaller than the view pins to its origin rather than centring, same as Flash.
 */
export function clampCameraScroll(
  scroll: CameraScroll,
  view: CameraViewSize,
  level: CameraLevelSize,
): CameraScroll {
  return {
    x: clamp(scroll.x, 0, Math.max(0, level.w - view.w)),
    y: clamp(scroll.y, 0, Math.max(0, level.h - view.h)),
  };
}

/**
 * Put the player in the middle of the view — Flash `heroDie`
 * (`world._x = -(this._x)+sw/2`). Used to seed the scroll on spawn so the first
 * frame is not a jump-cut from the map origin.
 */
export function centerCameraScroll(
  target: CameraTarget,
  view: CameraViewSize,
  level: CameraLevelSize,
): CameraScroll {
  return clampCameraScroll(
    {
      x: target.x + target.w / 2 - view.w / 2,
      y: target.y + target.h / 2 - view.h / 2,
    },
    view,
    level,
  );
}

/** One frame of Flash `heroAction` scrolling. See the module doc for the rules. */
export function followCameraScroll(
  scroll: CameraScroll,
  target: CameraTarget,
  view: CameraViewSize,
  level: CameraLevelSize,
): CameraScroll {
  let { x, y } = scroll;
  const halfW = view.w / 2;
  const right = target.x + target.w;
  const bottom = target.y + target.h;

  if (target.vx > 0 && right - x > halfW + target.w) {
    x = right - halfW - target.w;
  }
  if (target.vx < 0 && target.x - x < halfW - target.w) {
    x = target.x - halfW + target.w;
  }

  const bandTop = view.h * CAMERA.deadzoneTopFrac;
  const bandBottom = view.h * CAMERA.deadzoneBottomFrac;
  if (target.vy > 0 && bottom - y > bandBottom) {
    y = bottom - bandBottom;
  }
  if (target.vy < 0 && target.y - y < bandTop) {
    y = target.y - bandTop;
  }

  return clampCameraScroll({ x, y }, view, level);
}
