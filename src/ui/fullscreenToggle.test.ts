/**
 * Fullscreen F-key toggle — issue #28.
 *
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from 'vitest';
import {
  bindFullscreenKey,
  isFullscreenToggleKey,
  toggleFullscreen,
  type FullscreenScaleApi,
} from './fullscreenToggle';

function keyEvent(
  key: string,
  mods: Partial<
    Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey' | 'repeat'>
  > = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    altKey: mods.altKey ?? false,
    metaKey: mods.metaKey ?? false,
    repeat: mods.repeat ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('isFullscreenToggleKey', () => {
  it('matches plain F / f and rejects modifiers / repeats', () => {
    expect(isFullscreenToggleKey(keyEvent('f'))).toBe(true);
    expect(isFullscreenToggleKey(keyEvent('F'))).toBe(true);
    expect(isFullscreenToggleKey(keyEvent('f', { ctrlKey: true }))).toBe(false);
    expect(isFullscreenToggleKey(keyEvent('f', { altKey: true }))).toBe(false);
    expect(isFullscreenToggleKey(keyEvent('f', { metaKey: true }))).toBe(false);
    expect(isFullscreenToggleKey(keyEvent('f', { repeat: true }))).toBe(false);
    expect(isFullscreenToggleKey(keyEvent('g'))).toBe(false);
  });
});

describe('toggleFullscreen / bindFullscreenKey (issue #28)', () => {
  it('starts and stops fullscreen from the current state', () => {
    let fullscreen = false;
    const scale: FullscreenScaleApi = {
      isFullscreen: () => fullscreen,
      startFullscreen: vi.fn(() => {
        fullscreen = true;
      }),
      stopFullscreen: vi.fn(() => {
        fullscreen = false;
      }),
    };

    toggleFullscreen(scale);
    expect(scale.startFullscreen).toHaveBeenCalledTimes(1);
    expect(scale.stopFullscreen).not.toHaveBeenCalled();

    toggleFullscreen(scale);
    expect(scale.stopFullscreen).toHaveBeenCalledTimes(1);
  });

  it('toggles on F keydown and ignores other keys', () => {
    const target = document.createElement('div');
    let fullscreen = false;
    const scale: FullscreenScaleApi = {
      isFullscreen: () => fullscreen,
      startFullscreen: vi.fn(() => {
        fullscreen = true;
      }),
      stopFullscreen: vi.fn(() => {
        fullscreen = false;
      }),
    };

    const { destroy } = bindFullscreenKey({ scale, target });

    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', bubbles: true }),
    );
    expect(scale.startFullscreen).not.toHaveBeenCalled();

    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', bubbles: true }),
    );
    expect(scale.startFullscreen).toHaveBeenCalledTimes(1);

    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F', bubbles: true }),
    );
    expect(scale.stopFullscreen).toHaveBeenCalledTimes(1);

    destroy();
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', bubbles: true }),
    );
    expect(scale.startFullscreen).toHaveBeenCalledTimes(1);
  });
});
