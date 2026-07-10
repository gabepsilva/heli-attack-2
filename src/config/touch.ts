/**
 * Touch-control & orientation constants — issue #30.
 *
 * Virtual joystick / aim-stick / button layout lives in the DOM HUD; these
 * values are the pure-logic thresholds the sampler and orientation guard use.
 */

/** Stick magnitude (0–1) below this is treated as released. */
export const TOUCH_DEADZONE = 0.25;

/**
 * Arena-space aim distance (px) from the player center when the aim stick is
 * at full deflection. Large enough to aim across the visible arena.
 */
export const TOUCH_AIM_RANGE_PX = 400;

/** Virtual control base sizes (CSS px) for the on-screen HUD. */
export const TOUCH_UI = {
  /** Outer ring diameter for move / aim sticks. */
  stickSizePx: 120,
  /** Knob diameter inside each stick. */
  knobSizePx: 56,
  /** Action button diameter (jump / boost / slow-mo / switch). */
  buttonSizePx: 64,
  /** Inset from the safe edges of the viewport. */
  edgeInsetPx: 24,
  /** Gap between stacked action buttons. */
  buttonGapPx: 12,
} as const;

/**
 * Copy shown on the portrait orientation guard.
 * Acceptance: portrait shows this overlay.
 */
export const ORIENTATION_GUARD_MESSAGE = 'Rotate your device';

export const ORIENTATION_GUARD_HINT = 'Landscape required to play';

/**
 * Environment snapshot used to decide whether touch chrome should appear.
 * Injected in tests; production reads from `navigator` / `matchMedia`.
 */
export type TouchDeviceEnv = {
  maxTouchPoints: number;
  /** `matchMedia('(pointer: coarse)').matches` — phones/tablets, not touch laptops. */
  coarsePointer: boolean;
};

/**
 * True for primary-touch devices (phone / tablet). Touch laptops with fine
 * pointers stay on keyboard/mouse chrome.
 */
export function isTouchPrimaryDevice(env: TouchDeviceEnv): boolean {
  return env.maxTouchPoints > 0 && env.coarsePointer;
}

/** Portrait when the viewport is taller than it is wide. */
export function isPortraitViewport(width: number, height: number): boolean {
  return height > width;
}

/**
 * On-screen controls are shown only on touch-primary devices in landscape.
 * Portrait uses the rotate overlay instead (controls hidden underneath).
 */
export function shouldShowTouchControls(
  env: TouchDeviceEnv,
  viewport: { width: number; height: number },
): boolean {
  return (
    isTouchPrimaryDevice(env) &&
    !isPortraitViewport(viewport.width, viewport.height)
  );
}

/** Read the live browser environment for touch / pointer capability. */
export function readTouchDeviceEnv(
  nav: Pick<Navigator, 'maxTouchPoints'> = navigator,
  matchMediaFn: (query: string) => { matches: boolean } = (q) =>
    window.matchMedia(q),
): TouchDeviceEnv {
  return {
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    coarsePointer: matchMediaFn('(pointer: coarse)').matches,
  };
}
