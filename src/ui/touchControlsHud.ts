/**
 * On-screen touch controls HUD — issue #30.
 *
 * DOM overlay (outside Phaser) so real touch targets work under FIT scaling
 * and fullscreen. Left: move joystick. Right: aim/fire stick + jump / boost /
 * slow-mo / weapon-switch buttons. Shown only on touch-primary landscape.
 */

import {
  readTouchDeviceEnv,
  shouldShowTouchControls,
  TOUCH_UI,
  type TouchDeviceEnv,
} from '../config/touch';
import type { TouchControlSample } from '../input/touchControls';

export type TouchControlsHudOptions = {
  parent?: HTMLElement;
  /** Injected for tests; defaults to {@link readTouchDeviceEnv}. */
  env?: TouchDeviceEnv;
  getViewport?: () => { width: number; height: number };
};

export type TouchControlsHudHandle = {
  root: HTMLDivElement;
  /** Current stick / button sample for the intent sampler. */
  getSample: (allowFire: boolean) => TouchControlSample;
  /** Re-evaluate visibility (touch device + landscape). */
  refresh: () => void;
  isVisible: () => boolean;
  destroy: () => void;
};

/** Last mounted HUD — GameScene samples this each frame when visible. */
let mountedHud: TouchControlsHudHandle | null = null;

/** Active on-screen touch controls, or `null` before mount / after destroy. */
export function getMountedTouchControlsHud(): TouchControlsHudHandle | null {
  return mountedHud;
}

type StickState = { x: number; y: number; pointerId: number | null };

function clampStick(
  dx: number,
  dy: number,
  maxRadius: number,
): {
  x: number;
  y: number;
} {
  const len = Math.hypot(dx, dy);
  if (len <= maxRadius || len === 0) {
    return { x: dx / maxRadius, y: dy / maxRadius };
  }
  return { x: dx / len, y: dy / len };
}

function stylePad(el: HTMLElement, size: number): void {
  Object.assign(el.style, {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: '2px solid rgba(157, 178, 191, 0.55)',
    background: 'rgba(8, 16, 28, 0.35)',
    touchAction: 'none',
    userSelect: 'none',
  });
}

function styleKnob(el: HTMLElement, size: number): void {
  Object.assign(el.style, {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: 'rgba(220, 230, 240, 0.55)',
    border: '1px solid rgba(245, 245, 245, 0.7)',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  });
}

function styleButton(el: HTMLElement, size: number): void {
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: '2px solid rgba(157, 178, 191, 0.7)',
    background: 'rgba(8, 16, 28, 0.55)',
    color: '#dce6f0',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    cursor: 'pointer',
  });
}

/**
 * Mount virtual joystick + aim/fire + action buttons.
 * Returns a handle GameScene samples each frame into {@link sampleTouchIntent}.
 */
export function mountTouchControlsHud(
  options: TouchControlsHudOptions = {},
): TouchControlsHudHandle {
  const parent = options.parent ?? document.body;
  const getViewport =
    options.getViewport ??
    (() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  const env = options.env ?? readTouchDeviceEnv();

  const root = document.createElement('div');
  root.dataset.touchControls = 'true';
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '40',
    pointerEvents: 'none',
    display: 'none',
    touchAction: 'none',
  });

  const { stickSizePx, knobSizePx, buttonSizePx, edgeInsetPx, buttonGapPx } =
    TOUCH_UI;
  const stickRadius = stickSizePx / 2;

  // —— Move stick (bottom-left) ——
  const movePad = document.createElement('div');
  movePad.dataset.touchMove = 'true';
  stylePad(movePad, stickSizePx);
  Object.assign(movePad.style, {
    left: `${edgeInsetPx}px`,
    bottom: `${edgeInsetPx}px`,
    pointerEvents: 'auto',
  });
  const moveKnob = document.createElement('div');
  styleKnob(moveKnob, knobSizePx);
  movePad.appendChild(moveKnob);

  // —— Aim stick (bottom-right) ——
  const aimPad = document.createElement('div');
  aimPad.dataset.touchAim = 'true';
  stylePad(aimPad, stickSizePx);
  Object.assign(aimPad.style, {
    right: `${edgeInsetPx}px`,
    bottom: `${edgeInsetPx}px`,
    pointerEvents: 'auto',
  });
  const aimKnob = document.createElement('div');
  styleKnob(aimKnob, knobSizePx);
  aimPad.appendChild(aimKnob);

  // —— Action buttons (above aim stick) ——
  const buttons = document.createElement('div');
  buttons.dataset.touchButtons = 'true';
  Object.assign(buttons.style, {
    position: 'absolute',
    right: `${edgeInsetPx}px`,
    bottom: `${edgeInsetPx + stickSizePx + buttonGapPx}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: `${buttonGapPx}px`,
    alignItems: 'flex-end',
    pointerEvents: 'auto',
  });

  const held = {
    jump: false,
    boost: false,
    bulletTime: false,
  };
  let prevWeaponEdge = false;
  let nextWeaponEdge = false;

  const makeHoldButton = (
    label: string,
    key: keyof typeof held,
    testId: string,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.touchButton = testId;
    styleButton(btn, buttonSizePx);
    const set = (down: boolean): void => {
      held[key] = down;
      btn.style.background = down
        ? 'rgba(61, 90, 128, 0.85)'
        : 'rgba(8, 16, 28, 0.55)';
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.setPointerCapture(e.pointerId);
      set(true);
    });
    const release = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      set(false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', () => set(false));
    return btn;
  };

  const makeEdgeButton = (
    label: string,
    onTap: () => void,
    testId: string,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.touchButton = testId;
    styleButton(btn, buttonSizePx);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTap();
      btn.style.background = 'rgba(61, 90, 128, 0.85)';
    });
    const release = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.background = 'rgba(8, 16, 28, 0.55)';
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    return btn;
  };

  buttons.append(
    makeHoldButton('JUMP', 'jump', 'jump'),
    makeHoldButton('BOOST', 'boost', 'boost'),
    makeHoldButton('SLOW', 'bulletTime', 'bulletTime'),
    makeEdgeButton(
      'PREV',
      () => {
        prevWeaponEdge = true;
      },
      'prevWeapon',
    ),
    makeEdgeButton(
      'NEXT',
      () => {
        nextWeaponEdge = true;
      },
      'nextWeapon',
    ),
  );

  const move: StickState = { x: 0, y: 0, pointerId: null };
  const aim: StickState = { x: 0, y: 0, pointerId: null };

  const bindStick = (
    pad: HTMLElement,
    knob: HTMLElement,
    state: StickState,
  ): void => {
    const syncKnob = (): void => {
      const px = state.x * stickRadius;
      const py = state.y * stickRadius;
      knob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    };
    const reset = (): void => {
      state.x = 0;
      state.y = 0;
      state.pointerId = null;
      syncKnob();
    };
    const updateFromEvent = (e: PointerEvent): void => {
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const clamped = clampStick(e.clientX - cx, e.clientY - cy, stickRadius);
      state.x = clamped.x;
      state.y = clamped.y;
      syncKnob();
    };

    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.pointerId !== null) {
        return;
      }
      state.pointerId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      updateFromEvent(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== state.pointerId) {
        return;
      }
      e.preventDefault();
      updateFromEvent(e);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== state.pointerId) {
        return;
      }
      e.preventDefault();
      reset();
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', () => {
      if (state.pointerId !== null) {
        reset();
      }
    });
  };

  bindStick(movePad, moveKnob, move);
  bindStick(aimPad, aimKnob, aim);

  root.append(movePad, aimPad, buttons);

  let visible = false;
  const refresh = (): void => {
    visible = shouldShowTouchControls(env, getViewport());
    root.style.display = visible ? 'block' : 'none';
  };

  const onResize = (): void => {
    refresh();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  refresh();
  parent.appendChild(root);

  const handle: TouchControlsHudHandle = {
    root,
    getSample: (allowFire: boolean): TouchControlSample => {
      const sample: TouchControlSample = {
        moveX: move.x,
        moveY: move.y,
        aimStickX: aim.x,
        aimStickY: aim.y,
        jump: held.jump,
        boost: held.boost,
        bulletTime: held.bulletTime,
        prevWeapon: prevWeaponEdge,
        nextWeapon: nextWeaponEdge,
        allowFire,
      };
      // Drain one-shot weapon edges after the frame reads them.
      prevWeaponEdge = false;
      nextWeaponEdge = false;
      return sample;
    },
    refresh,
    isVisible: () => visible,
    destroy: () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      root.remove();
      if (mountedHud === handle) {
        mountedHud = null;
      }
    },
  };
  mountedHud = handle;
  return handle;
}
