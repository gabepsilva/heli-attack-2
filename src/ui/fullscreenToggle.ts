/**
 * Fullscreen toggle via the F key (issue #28).
 *
 * Bound at the document level so it works from the menu and in-play.
 * Keyboard events satisfy the Fullscreen API user-gesture requirement.
 */

export type FullscreenScaleApi = {
  isFullscreen: () => boolean;
  startFullscreen: () => void;
  stopFullscreen: () => void;
};

export type FullscreenKeyOptions = {
  scale: FullscreenScaleApi;
  /** Target for the keydown listener (defaults to `document`). */
  target?: Document | HTMLElement;
};

/** True when `event` is a plain F press (no Ctrl / Alt / Meta). */
export function isFullscreenToggleKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) {
    return false;
  }
  return event.key === 'f' || event.key === 'F';
}

/** Enter or exit fullscreen based on the current scale state. */
export function toggleFullscreen(scale: FullscreenScaleApi): void {
  if (scale.isFullscreen()) {
    scale.stopFullscreen();
  } else {
    scale.startFullscreen();
  }
}

/**
 * Bind F to toggle fullscreen. Returns an unbind handle.
 */
export function bindFullscreenKey(options: FullscreenKeyOptions): {
  destroy: () => void;
} {
  const target = options.target ?? document;
  const { scale } = options;

  const onKeyDown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (!isFullscreenToggleKey(keyEvent)) {
      return;
    }
    keyEvent.preventDefault();
    toggleFullscreen(scale);
  };

  target.addEventListener('keydown', onKeyDown);

  return {
    destroy: () => {
      target.removeEventListener('keydown', onKeyDown);
    },
  };
}
