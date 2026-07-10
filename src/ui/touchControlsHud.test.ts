/**
 * @vitest-environment happy-dom
 *
 * Touch controls HUD — issue #30.
 * Asserts visibility rules and that sticks/buttons feed the sample shape.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TOUCH_DEADZONE } from '../config/touch';
import {
  getMountedTouchControlsHud,
  mountTouchControlsHud,
} from './touchControlsHud';

describe('mountTouchControlsHud (issue #30)', () => {
  let viewport = { width: 844, height: 390 };

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-container"></div>';
    viewport = { width: 844, height: 390 };
  });

  afterEach(() => {
    getMountedTouchControlsHud()?.destroy();
    document.body.innerHTML = '';
  });

  it('shows on touch-primary landscape and hides in portrait / desktop', () => {
    const container = document.getElementById('game-container')!;
    const phone = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 5, coarsePointer: true },
      getViewport: () => viewport,
    });

    expect(phone.isVisible()).toBe(true);
    expect(phone.root.style.display).toBe('block');
    expect(phone.root.querySelector('[data-touch-move]')).not.toBeNull();
    expect(phone.root.querySelector('[data-touch-aim]')).not.toBeNull();
    expect(
      phone.root.querySelector('[data-touch-button="jump"]'),
    ).not.toBeNull();
    expect(
      phone.root.querySelector('[data-touch-button="boost"]'),
    ).not.toBeNull();
    expect(
      phone.root.querySelector('[data-touch-button="nextWeapon"]'),
    ).not.toBeNull();

    viewport = { width: 390, height: 844 };
    phone.refresh();
    expect(phone.isVisible()).toBe(false);

    phone.destroy();
    expect(container.contains(phone.root)).toBe(false);

    const desktop = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 0, coarsePointer: false },
      getViewport: () => ({ width: 844, height: 390 }),
    });
    expect(desktop.isVisible()).toBe(false);
    desktop.destroy();
  });

  it('getSample reports idle sticks and drains weapon edges after read', () => {
    const container = document.getElementById('game-container')!;
    const hud = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 5, coarsePointer: true },
      getViewport: () => viewport,
    });

    const idle = hud.getSample(true);
    expect(idle.moveX).toBe(0);
    expect(idle.moveY).toBe(0);
    expect(idle.aimStickX).toBe(0);
    expect(idle.aimStickY).toBe(0);
    expect(idle.jump).toBe(false);
    expect(idle.boost).toBe(false);
    expect(idle.bulletTime).toBe(false);
    expect(idle.prevWeapon).toBe(false);
    expect(idle.nextWeapon).toBe(false);
    expect(idle.allowFire).toBe(true);

    const nextBtn = hud.root.querySelector(
      '[data-touch-button="nextWeapon"]',
    ) as HTMLButtonElement;
    nextBtn.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
    );
    const edged = hud.getSample(true);
    expect(edged.nextWeapon).toBe(true);
    // Drained — second read is clear.
    expect(hud.getSample(true).nextWeapon).toBe(false);

    hud.destroy();
  });

  it('hold buttons set jump/boost/slow flags while pressed', () => {
    const container = document.getElementById('game-container')!;
    const hud = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 5, coarsePointer: true },
      getViewport: () => viewport,
    });

    const jump = hud.root.querySelector(
      '[data-touch-button="jump"]',
    ) as HTMLButtonElement;
    jump.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }),
    );
    expect(hud.getSample(true).jump).toBe(true);

    jump.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerId: 2 }),
    );
    expect(hud.getSample(true).jump).toBe(false);

    // allowFire is passed through for the aim/fire sampler gate.
    expect(hud.getSample(false).allowFire).toBe(false);

    hud.destroy();
  });

  it('move stick pointer drag updates normalized moveX beyond the deadzone', () => {
    const container = document.getElementById('game-container')!;
    const hud = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 5, coarsePointer: true },
      getViewport: () => viewport,
    });

    const pad = hud.root.querySelector('[data-touch-move]') as HTMLElement;
    // happy-dom may not layout; stub geometry so drag math is deterministic.
    pad.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 120,
      bottom: 120,
      width: 120,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    pad.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        clientX: 120,
        clientY: 60,
      }),
    );
    const dragged = hud.getSample(true);
    expect(dragged.moveX).toBeGreaterThanOrEqual(TOUCH_DEADZONE);
    expect(dragged.moveY).toBe(0);

    pad.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }),
    );
    expect(hud.getSample(true).moveX).toBe(0);

    hud.destroy();
  });

  it('exposes the mounted handle for GameScene sampling', () => {
    const container = document.getElementById('game-container')!;
    expect(getMountedTouchControlsHud()).toBeNull();

    const hud = mountTouchControlsHud({
      parent: container,
      env: { maxTouchPoints: 5, coarsePointer: true },
      getViewport: () => viewport,
    });
    expect(getMountedTouchControlsHud()).toBe(hud);

    hud.destroy();
    expect(getMountedTouchControlsHud()).toBeNull();
  });
});
