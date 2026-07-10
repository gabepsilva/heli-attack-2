/**
 * Hard 33 ms player-hurt flash — on then off, never a fade.
 */

import { describe, expect, it, vi } from 'vitest';
import { HURT_FLASH } from '../config/constants';
import { HurtFlash } from './hurtFlash';

function stubScene(): {
  scene: { add: { rectangle: ReturnType<typeof vi.fn> } };
  setVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  const setVisible = vi.fn().mockReturnThis();
  const destroy = vi.fn();
  const rectangle = {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible,
    destroy,
  };
  const scene = {
    add: {
      rectangle: vi.fn(() => rectangle),
    },
  };
  return { scene, setVisible, destroy };
}

describe('HurtFlash', () => {
  it('uses a hard one-frame duration (33 ms), not a fade', () => {
    expect(HURT_FLASH.durationMs).toBe(33);
    expect(HURT_FLASH.durationMs).toBe(Math.round(1000 / 30));
    expect(HURT_FLASH.red).toBe(150);
    expect(HURT_FLASH.green).toBe(0);
    expect(HURT_FLASH.blue).toBe(0);
  });

  it('shows fully opaque then snaps off after durationMs', () => {
    const { scene, setVisible, destroy } = stubScene();
    const flash = new HurtFlash({ scene: scene as never });

    expect(flash.isActive()).toBe(false);
    expect(setVisible).toHaveBeenCalledWith(false);

    flash.trigger();
    expect(flash.isActive()).toBe(true);
    expect(setVisible).toHaveBeenLastCalledWith(true);

    // Still on mid-flash — no alpha fade, just remaining time.
    flash.update(16);
    expect(flash.isActive()).toBe(true);
    expect(setVisible).toHaveBeenLastCalledWith(true);

    // Expires exactly at duration — snaps off.
    flash.update(HURT_FLASH.durationMs - 16);
    expect(flash.isActive()).toBe(false);
    expect(setVisible).toHaveBeenLastCalledWith(false);

    flash.destroy();
    expect(destroy).toHaveBeenCalled();
  });

  it('restarts the full duration on a second trigger', () => {
    const { scene } = stubScene();
    const flash = new HurtFlash({ scene: scene as never });
    flash.trigger();
    flash.update(20);
    flash.trigger();
    flash.update(20);
    expect(flash.isActive()).toBe(true);
    flash.update(HURT_FLASH.durationMs);
    expect(flash.isActive()).toBe(false);
  });
});
