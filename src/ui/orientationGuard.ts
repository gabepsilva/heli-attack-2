/**
 * Portrait orientation guard — issue #30.
 *
 * DOM overlay outside Phaser so it covers the FIT canvas and fullscreen
 * chrome. Shown when the viewport is taller than wide; hidden in landscape.
 */

import {
  isPortraitViewport,
  ORIENTATION_GUARD_HINT,
  ORIENTATION_GUARD_MESSAGE,
} from '../config/touch';

export type OrientationGuardOptions = {
  parent?: HTMLElement;
  /** Defaults to `window.innerWidth` / `innerHeight`. */
  getViewport?: () => { width: number; height: number };
};

export type OrientationGuardHandle = {
  root: HTMLDivElement;
  /** Re-evaluate portrait vs landscape and update visibility. */
  refresh: () => void;
  /** True when the rotate overlay is currently shown. */
  isVisible: () => boolean;
  destroy: () => void;
};

/**
 * Whether the guard should be visible for the given viewport.
 * Acceptance criterion: portrait shows the overlay.
 */
export function shouldShowOrientationGuard(viewport: {
  width: number;
  height: number;
}): boolean {
  return isPortraitViewport(viewport.width, viewport.height);
}

/**
 * Mount a full-viewport "Rotate your device" overlay. Call {@link refresh}
 * on resize / orientationchange (also wired automatically).
 */
export function mountOrientationGuard(
  options: OrientationGuardOptions = {},
): OrientationGuardHandle {
  const parent = options.parent ?? document.body;
  const getViewport =
    options.getViewport ??
    (() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

  const root = document.createElement('div');
  root.dataset.orientationGuard = 'true';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', ORIENTATION_GUARD_MESSAGE);
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '100',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    background: 'rgba(8, 12, 20, 0.96)',
    color: '#f5f5f5',
    fontFamily: 'Arial, Helvetica, sans-serif',
    textAlign: 'center',
    padding: '24px',
    touchAction: 'none',
    userSelect: 'none',
  });

  const title = document.createElement('div');
  title.dataset.orientationTitle = 'true';
  title.textContent = ORIENTATION_GUARD_MESSAGE;
  Object.assign(title.style, {
    fontSize: '28px',
    fontWeight: 'bold',
    letterSpacing: '0.02em',
  });

  const hint = document.createElement('div');
  hint.dataset.orientationHint = 'true';
  hint.textContent = ORIENTATION_GUARD_HINT;
  Object.assign(hint.style, {
    fontSize: '16px',
    color: '#9ab',
  });

  root.append(title, hint);

  let visible = false;
  const refresh = (): void => {
    visible = shouldShowOrientationGuard(getViewport());
    root.style.display = visible ? 'flex' : 'none';
  };

  const onResize = (): void => {
    refresh();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  refresh();
  parent.appendChild(root);

  return {
    root,
    refresh,
    isVisible: () => visible,
    destroy: () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      root.remove();
    },
  };
}
