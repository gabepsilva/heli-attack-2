/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAYER, WORLD, resetPhysicsConstants } from '../config/constants';
import {
  DebugOverlay,
  emptyDebugSnapshot,
  formatDebugStatus,
} from './debugOverlay';

describe('DebugOverlay (issue #8)', () => {
  beforeEach(() => {
    resetPhysicsConstants();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetPhysicsConstants();
    document.body.innerHTML = '';
  });

  it('formats live velocity/state/charge/sim-fps for the status line', () => {
    const line = formatDebugStatus(
      emptyDebugSnapshot({
        simRate: 30.0,
        simHzTarget: 30,
        timeStep: 1,
        vx: 5,
        vy: -7.5,
        x: 100,
        y: 200,
        onGround: false,
        ducking: false,
        jump: true,
        jump2: true,
        jumpUp: 3,
        boostCharge: 75,
        boostChargeMax: 150,
        hjump: true,
        mgReloadHud: '3/5',
        mgShots: 12,
        bulletsActive: 4,
        bulletsCapacity: 64,
        bulletsFired: 12,
        bulletsRecycled: 8,
      }),
    );
    expect(line).toContain('sim 30.0/30');
    expect(line).toContain('ts=1.00');
    expect(line).toContain('vx=5');
    expect(line).toContain('vy=-7.5');
    expect(line).toContain('air');
    expect(line).toContain('j12');
    expect(line).toContain('up=3');
    expect(line).toContain('boost=75/150');
    expect(line).toContain('hj');
    expect(line).toContain('MG 3/5 shots=12');
    expect(line).toContain('pool 4/64 fired 12 rc 8');
  });

  it('mounts visible by default and toggles off for clean demos (AC)', () => {
    const overlay = new DebugOverlay({ parent: document.body });
    expect(overlay.visible).toBe(true);
    expect(overlay.root.style.display).toBe('block');
    expect(overlay.root.getAttribute('aria-hidden')).toBe('false');

    overlay.toggle();
    expect(overlay.visible).toBe(false);
    expect(overlay.root.style.display).toBe('none');
    expect(overlay.root.getAttribute('aria-hidden')).toBe('true');

    overlay.setVisible(true);
    expect(overlay.visible).toBe(true);
    expect(overlay.root.style.display).toBe('block');

    overlay.destroy();
    expect(document.getElementById('ha2-debug-overlay')).toBeNull();
  });

  it('honors ?debug=0 so demos start with the overlay hidden', () => {
    const overlay = new DebugOverlay({
      parent: document.body,
      search: '?debug=0',
    });
    expect(overlay.visible).toBe(false);
    expect(overlay.root.style.display).toBe('none');
    overlay.destroy();
  });

  it('ignores cleared or blank inputs so constants are not set to 0', () => {
    const overlay = new DebugOverlay({ parent: document.body });
    const gravityInput = overlay.root.querySelector(
      '[data-tunable="gravity"]',
    ) as HTMLInputElement;
    expect(WORLD.gravity).toBe(1);

    gravityInput.value = '';
    gravityInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(WORLD.gravity).toBe(1);

    gravityInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(WORLD.gravity).toBe(1);
    expect(gravityInput.value).toBe('1');

    overlay.destroy();
  });

  it('editing an input mutates live constants with no reload (AC)', () => {
    const overlay = new DebugOverlay({ parent: document.body });
    const gravityInput = overlay.root.querySelector(
      '[data-tunable="gravity"]',
    ) as HTMLInputElement;
    expect(gravityInput).toBeTruthy();
    expect(WORLD.gravity).toBe(1);

    gravityInput.value = '4';
    gravityInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(WORLD.gravity).toBe(4);

    const jumpInput = overlay.root.querySelector(
      '[data-tunable="jumpVel"]',
    ) as HTMLInputElement;
    jumpInput.value = '-16';
    jumpInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(PLAYER.jumpVel).toBe(-16);

    overlay.destroy();
  });

  it('Reset to spec restores defaults and refreshes inputs', () => {
    const overlay = new DebugOverlay({ parent: document.body });
    WORLD.gravity = 9;
    PLAYER.walkCap = 99;

    const reset = overlay.root.querySelector(
      '[data-testid="debug-reset"]',
    ) as HTMLButtonElement;
    reset.click();

    expect(WORLD.gravity).toBe(1);
    expect(PLAYER.walkCap).toBe(5);
    const gravityInput = overlay.root.querySelector(
      '[data-tunable="gravity"]',
    ) as HTMLInputElement;
    expect(gravityInput.value).toBe('1');
    overlay.destroy();
  });

  it('applies query-param tunables at mount', () => {
    const overlay = new DebugOverlay({
      parent: document.body,
      search: '?gravity=3&walkAccel=2',
    });
    expect(WORLD.gravity).toBe(3);
    expect(PLAYER.walkAccel).toBe(2);
    const gravityInput = overlay.root.querySelector(
      '[data-tunable="gravity"]',
    ) as HTMLInputElement;
    expect(gravityInput.value).toBe('3');
    overlay.destroy();
  });

  it('update refreshes the status element from a snapshot', () => {
    const overlay = new DebugOverlay({ parent: document.body });
    overlay.update(
      emptyDebugSnapshot({
        simRate: 29.5,
        vx: -5,
        onGround: true,
        boostCharge: 150,
        boostChargeMax: 150,
      }),
    );
    const status = overlay.root.querySelector(
      '[data-testid="debug-status"]',
    ) as HTMLElement;
    expect(status.textContent).toContain('sim 29.5/30');
    expect(status.textContent).toContain('grounded');
    expect(status.textContent).toContain('vx=-5');
    overlay.destroy();
  });
});
