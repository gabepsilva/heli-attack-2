/**
 * DOM fullscreen toggle for issue #28.
 *
 * Lives outside Phaser so a real `<button>` can satisfy the Fullscreen API
 * user-gesture requirement. Toggle calls Phaser Scale Manager enter/leave.
 */

import { fullscreenButtonLabel } from './responsiveScale';

export type FullscreenScaleApi = {
  isFullscreen: () => boolean;
  startFullscreen: () => void;
  stopFullscreen: () => void;
};

export type FullscreenButtonOptions = {
  scale: FullscreenScaleApi;
  parent?: HTMLElement;
};

/**
 * Mount a top-left fullscreen control. Returns a destroy handle.
 */
export function mountFullscreenButton(options: FullscreenButtonOptions): {
  root: HTMLButtonElement;
  destroy: () => void;
  refresh: () => void;
} {
  const parent = options.parent ?? document.body;
  const { scale } = options;

  const root = document.createElement('button');
  root.type = 'button';
  root.dataset.fullscreenButton = 'true';
  root.setAttribute('aria-label', 'Toggle fullscreen');
  Object.assign(root.style, {
    position: 'fixed',
    left: '12px',
    top: '12px',
    zIndex: '30',
    padding: '8px 12px',
    background: 'rgba(8, 16, 28, 0.88)',
    color: '#dce6f0',
    fontFamily: 'monospace',
    fontSize: '13px',
    border: '1px solid #3d5a80',
    cursor: 'pointer',
  });

  const refresh = (): void => {
    root.textContent = fullscreenButtonLabel(scale.isFullscreen());
  };

  root.addEventListener('click', () => {
    if (scale.isFullscreen()) {
      scale.stopFullscreen();
    } else {
      scale.startFullscreen();
    }
    // Label may update on the next fullscreenchange; refresh optimistically.
    refresh();
  });

  const onFsChange = (): void => {
    refresh();
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  refresh();
  parent.appendChild(root);

  return {
    root,
    refresh,
    destroy: () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      root.remove();
    },
  };
}
