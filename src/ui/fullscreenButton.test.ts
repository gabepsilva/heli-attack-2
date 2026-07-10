/**
 * @vitest-environment happy-dom
 *
 * Fullscreen button — issue #28.
 * Asserts mount parent (must be inside the fullscreen target) and toggle wiring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fullscreenButtonLabel,
  mountFullscreenButton,
} from './fullscreenButton';

describe('fullscreenButtonLabel', () => {
  it('toggles copy for enter vs exit', () => {
    expect(fullscreenButtonLabel(false)).toBe('Fullscreen');
    expect(fullscreenButtonLabel(true)).toBe('Exit Fullscreen');
  });
});

describe('mountFullscreenButton (issue #28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends the button as a child of the given parent (fullscreen target)', () => {
    const container = document.getElementById('game-container');
    expect(container).not.toBeNull();

    const scale = {
      isFullscreen: () => false,
      startFullscreen: vi.fn(),
      stopFullscreen: vi.fn(),
    };

    const { root, destroy } = mountFullscreenButton({
      parent: container!,
      scale,
    });

    expect(root.parentElement).toBe(container);
    expect(container!.contains(root)).toBe(true);
    expect(document.body.contains(root)).toBe(true);
    // Not a direct child of body — sibling of the container would vanish in FS.
    expect(root.parentElement).not.toBe(document.body);
    expect(root.textContent).toBe('Fullscreen');

    destroy();
    expect(container!.contains(root)).toBe(false);
  });

  it('calls startFullscreen / stopFullscreen from the button click', () => {
    const container = document.getElementById('game-container')!;
    let fullscreen = false;
    const scale = {
      isFullscreen: () => fullscreen,
      startFullscreen: vi.fn(() => {
        fullscreen = true;
      }),
      stopFullscreen: vi.fn(() => {
        fullscreen = false;
      }),
    };

    const { root, refresh, destroy } = mountFullscreenButton({
      parent: container,
      scale,
    });

    root.click();
    expect(scale.startFullscreen).toHaveBeenCalledTimes(1);
    expect(scale.stopFullscreen).not.toHaveBeenCalled();

    refresh();
    expect(root.textContent).toBe('Exit Fullscreen');

    root.click();
    expect(scale.stopFullscreen).toHaveBeenCalledTimes(1);

    refresh();
    expect(root.textContent).toBe('Fullscreen');

    destroy();
  });

  it('refreshes the label on fullscreenchange', () => {
    const container = document.getElementById('game-container')!;
    let fullscreen = false;
    const scale = {
      isFullscreen: () => fullscreen,
      startFullscreen: vi.fn(),
      stopFullscreen: vi.fn(),
    };

    const { root, destroy } = mountFullscreenButton({
      parent: container,
      scale,
    });

    expect(root.textContent).toBe('Fullscreen');
    fullscreen = true;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(root.textContent).toBe('Exit Fullscreen');

    destroy();
  });
});
