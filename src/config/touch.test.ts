/**
 * Touch / orientation config — unit tests for issue #30.
 * Pins deadzone, aim range, portrait detection, and when chrome is shown.
 */

import { describe, expect, it } from 'vitest';
import {
  isPortraitViewport,
  isTouchPrimaryDevice,
  ORIENTATION_GUARD_HINT,
  ORIENTATION_GUARD_MESSAGE,
  readTouchDeviceEnv,
  shouldShowTouchControls,
  TOUCH_AIM_RANGE_PX,
  TOUCH_DEADZONE,
  TOUCH_UI,
} from './touch';

describe('touch config (issue #30)', () => {
  it('locks sampler thresholds and UI sizes', () => {
    expect(TOUCH_DEADZONE).toBe(0.25);
    expect(TOUCH_AIM_RANGE_PX).toBe(400);
    expect(TOUCH_UI.stickSizePx).toBe(120);
    expect(TOUCH_UI.knobSizePx).toBe(56);
    expect(TOUCH_UI.buttonSizePx).toBe(64);
    expect(TOUCH_UI.edgeInsetPx).toBe(24);
    expect(TOUCH_UI.buttonGapPx).toBe(12);
  });

  it('pins the portrait rotate-prompt copy (AC: portrait shows overlay)', () => {
    expect(ORIENTATION_GUARD_MESSAGE).toBe('Rotate your device');
    expect(ORIENTATION_GUARD_HINT).toBe('Landscape required to play');
  });

  it('isPortraitViewport is true only when height > width', () => {
    expect(isPortraitViewport(390, 844)).toBe(true);
    expect(isPortraitViewport(844, 390)).toBe(false);
    expect(isPortraitViewport(800, 800)).toBe(false);
  });

  it('isTouchPrimaryDevice requires touch points and a coarse pointer', () => {
    expect(
      isTouchPrimaryDevice({ maxTouchPoints: 5, coarsePointer: true }),
    ).toBe(true);
    expect(
      isTouchPrimaryDevice({ maxTouchPoints: 0, coarsePointer: true }),
    ).toBe(false);
    expect(
      isTouchPrimaryDevice({ maxTouchPoints: 10, coarsePointer: false }),
    ).toBe(false);
  });

  it('shouldShowTouchControls only on touch-primary landscape (AC)', () => {
    const phone = { maxTouchPoints: 5, coarsePointer: true };
    expect(shouldShowTouchControls(phone, { width: 844, height: 390 })).toBe(
      true,
    );
    expect(shouldShowTouchControls(phone, { width: 390, height: 844 })).toBe(
      false,
    );
    expect(
      shouldShowTouchControls(
        { maxTouchPoints: 0, coarsePointer: false },
        { width: 844, height: 390 },
      ),
    ).toBe(false);
  });

  it('readTouchDeviceEnv maps navigator + matchMedia into the env snapshot', () => {
    const env = readTouchDeviceEnv({ maxTouchPoints: 2 }, (query) => ({
      matches: query === '(pointer: coarse)',
    }));
    expect(env).toEqual({ maxTouchPoints: 2, coarsePointer: true });

    const desktop = readTouchDeviceEnv({ maxTouchPoints: 0 }, () => ({
      matches: false,
    }));
    expect(desktop).toEqual({ maxTouchPoints: 0, coarsePointer: false });
  });
});
