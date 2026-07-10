/**
 * @vitest-environment happy-dom
 *
 * Camera-feel intensity HUD — issue #36.
 * Asserts the toggle cycles Off/Low/Medium/High and writes through to GameCameraFeel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraFeelHud } from './cameraFeelHud';
import type { GameCameraFeel } from './gameCameraFeel';
import type { CameraFeelIntensity } from '../config/cameraFeel';

function stubCameraFeel(initial: CameraFeelIntensity = 'medium'): {
  feel: GameCameraFeel;
  setIntensity: ReturnType<typeof vi.fn>;
  getIntensity: () => CameraFeelIntensity;
} {
  let intensity = initial;
  const setIntensity = vi.fn((next: CameraFeelIntensity) => {
    intensity = next;
  });
  const feel = {
    getIntensity: () => intensity,
    setIntensity,
  } as unknown as GameCameraFeel;
  return {
    feel,
    setIntensity,
    getIntensity: () => intensity,
  };
}

describe('CameraFeelHud (#36)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts a Juice select that toggles intensity (AC: effects can be toggled)', () => {
    const { feel, setIntensity, getIntensity } = stubCameraFeel('medium');
    const hud = new CameraFeelHud({
      cameraFeel: feel,
      parent: document.body,
    });

    const root = document.querySelector('[data-camera-feel-hud="true"]');
    expect(root).not.toBeNull();
    const select = root!.querySelector('select');
    expect(select).not.toBeNull();
    expect(select!.value).toBe('medium');
    expect([...select!.options].map((o) => o.value)).toEqual([
      'off',
      'low',
      'medium',
      'high',
    ]);

    select!.value = 'off';
    select!.dispatchEvent(new Event('change'));
    expect(setIntensity).toHaveBeenCalledWith('off');
    expect(getIntensity()).toBe('off');

    const cycle = root!.querySelector('button');
    expect(cycle).not.toBeNull();
    // After Off, cycle → Low.
    cycle!.click();
    expect(setIntensity).toHaveBeenCalledWith('low');
    expect(getIntensity()).toBe('low');

    hud.destroy();
    expect(document.querySelector('[data-camera-feel-hud="true"]')).toBeNull();
  });
});
