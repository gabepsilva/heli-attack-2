/**
 * @vitest-environment happy-dom
 *
 * Orientation guard — issue #30.
 * Asserts portrait shows the rotate overlay and landscape hides it.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ORIENTATION_GUARD_HINT,
  ORIENTATION_GUARD_MESSAGE,
} from '../config/touch';
import {
  mountOrientationGuard,
  shouldShowOrientationGuard,
} from './orientationGuard';

describe('shouldShowOrientationGuard (issue #30)', () => {
  it('is true in portrait and false in landscape (AC: portrait shows overlay)', () => {
    expect(shouldShowOrientationGuard({ width: 390, height: 844 })).toBe(true);
    expect(shouldShowOrientationGuard({ width: 844, height: 390 })).toBe(false);
  });
});

describe('mountOrientationGuard (issue #30)', () => {
  let viewport = { width: 844, height: 390 };

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-container"></div>';
    viewport = { width: 844, height: 390 };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts with the pinned rotate copy and starts hidden in landscape', () => {
    const container = document.getElementById('game-container')!;
    const guard = mountOrientationGuard({
      parent: container,
      getViewport: () => viewport,
    });

    expect(guard.root.parentElement).toBe(container);
    expect(guard.isVisible()).toBe(false);
    expect(guard.root.style.display).toBe('none');
    expect(
      guard.root.querySelector('[data-orientation-title]')?.textContent,
    ).toBe(ORIENTATION_GUARD_MESSAGE);
    expect(
      guard.root.querySelector('[data-orientation-hint]')?.textContent,
    ).toBe(ORIENTATION_GUARD_HINT);

    guard.destroy();
    expect(container.contains(guard.root)).toBe(false);
  });

  it('shows the overlay when the viewport becomes portrait (AC)', () => {
    const container = document.getElementById('game-container')!;
    const guard = mountOrientationGuard({
      parent: container,
      getViewport: () => viewport,
    });

    expect(guard.isVisible()).toBe(false);

    viewport = { width: 390, height: 844 };
    guard.refresh();

    expect(guard.isVisible()).toBe(true);
    expect(guard.root.style.display).toBe('flex');
    expect(guard.root.getAttribute('aria-label')).toBe(
      ORIENTATION_GUARD_MESSAGE,
    );

    viewport = { width: 844, height: 390 };
    guard.refresh();
    expect(guard.isVisible()).toBe(false);

    guard.destroy();
  });

  it('refreshes on window resize to portrait', () => {
    const container = document.getElementById('game-container')!;
    const guard = mountOrientationGuard({
      parent: container,
      getViewport: () => viewport,
    });

    viewport = { width: 360, height: 740 };
    window.dispatchEvent(new Event('resize'));
    expect(guard.isVisible()).toBe(true);

    guard.destroy();
  });
});
