/**
 * Toggleable debug overlay + physics tuning panel (issue #8).
 *
 * Plain DOM module — no Phaser dependency. GameScene only feeds live state
 * each frame and wires the End toggle key (#107). Editing an input calls
 * {@link setTunable} so the next sim tick uses the new constant.
 */

import {
  TUNABLE_KEYS,
  TUNABLE_LABELS,
  applyTunablesFromSearch,
  getTunable,
  parseDebugOverlayVisible,
  resetTunables,
  setTunable,
  type TunableKey,
} from '../config/physicsTuning';
import { PLAYER } from '../config/constants';

/** Snapshot the overlay displays each frame (filled by GameScene). */
export type DebugOverlaySnapshot = {
  simRate: number;
  simHzTarget: number;
  timeStep: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  onGround: boolean;
  ducking: boolean;
  jump: boolean;
  jump2: boolean;
  jumpUp: number;
  boostCharge: number;
  boostChargeMax: number;
  hjump: boolean;
  /** Active weapon name (#14). */
  weaponName: string;
  /** Active weapon arsenal index (#14). */
  weaponIndex: number;
  /** Active weapon ammo readout — `∞` or remaining count (#14). */
  weaponAmmoHud: string;
  /** Active weapon reload HUD — `ready` or `n/reload` while charging (#11/#14). */
  mgReloadHud: string;
  /** Lifetime shot counter for the active weapon (#11). */
  mgShots: number;
  bulletsActive: number;
  bulletsCapacity: number;
  bulletsFired: number;
  bulletsRecycled: number;
};

export type DebugOverlayOptions = {
  /** Parent element (defaults to `document.body`). */
  parent?: HTMLElement;
  /** Initial visibility (defaults to true). */
  visible?: boolean;
  /** Query string / URLSearchParams applied once at mount. */
  search?: string | URLSearchParams;
};

const PANEL_ID = 'ha2-debug-overlay';

/** Parse a tunable `<input type="number">` value; blank means no change. */
function parseTunableInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Format one status line for the live readout (also used by unit tests).
 */
export function formatDebugStatus(s: DebugOverlaySnapshot): string {
  const grounded = s.onGround ? 'grounded' : 'air';
  const duck = s.ducking ? ' duck' : '';
  const j = `j${s.jump ? 1 : 0}${s.jump2 ? 2 : ''}`;
  const hj = s.hjump ? ' hj' : '';
  return (
    `sim ${s.simRate.toFixed(1)}/${s.simHzTarget}  ` +
    `ts=${s.timeStep.toFixed(2)}  ` +
    `vx=${s.vx.toFixed(0)} vy=${s.vy.toFixed(1)}  ` +
    `(${s.x.toFixed(0)},${s.y.toFixed(0)})  ` +
    `${grounded}${duck}  ${j} up=${s.jumpUp}  ` +
    `boost=${s.boostCharge}/${s.boostChargeMax}${hj}  ` +
    `gun=${s.weaponIndex}:${s.weaponName} ammo=${s.weaponAmmoHud}  ` +
    `rl ${s.mgReloadHud} shots=${s.mgShots}  ` +
    `pool ${s.bulletsActive}/${s.bulletsCapacity} ` +
    `fired ${s.bulletsFired} rc ${s.bulletsRecycled}`
  );
}

/**
 * On-screen debug panel: live player/sim readout + editable physics constants.
 * Toggle with {@link setVisible} / {@link toggle} for clean demos.
 */
export class DebugOverlay {
  readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly inputs = new Map<TunableKey, HTMLInputElement>();
  private _visible: boolean;

  constructor(options: DebugOverlayOptions = {}) {
    const search = options.search ?? '';
    if (search !== '') {
      applyTunablesFromSearch(search);
    }

    this._visible =
      options.visible ??
      (search !== '' ? parseDebugOverlayVisible(search) : true);

    const doc = options.parent?.ownerDocument ?? document;
    const existing = doc.getElementById(PANEL_ID);
    existing?.remove();

    this.root = doc.createElement('div');
    this.root.id = PANEL_ID;
    this.root.setAttribute('data-testid', 'debug-overlay');
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: '10000',
      width: '280px',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
      padding: '12px 14px',
      background: 'rgba(8, 16, 28, 0.92)',
      color: '#e8e8e8',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12px',
      lineHeight: '1.45',
      border: '1px solid #3d5a80',
      borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      pointerEvents: 'auto',
    } as CSSStyleDeclaration);

    const title = doc.createElement('div');
    title.textContent = 'Physics debug  (End toggle)';
    Object.assign(title.style, {
      fontWeight: '700',
      marginBottom: '8px',
      color: '#90be6d',
      letterSpacing: '0.02em',
    } as CSSStyleDeclaration);
    this.root.appendChild(title);

    this.statusEl = doc.createElement('pre');
    this.statusEl.setAttribute('data-testid', 'debug-status');
    Object.assign(this.statusEl.style, {
      margin: '0 0 10px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      color: '#cde',
      fontSize: '11px',
    } as CSSStyleDeclaration);
    this.root.appendChild(this.statusEl);

    const form = doc.createElement('div');
    form.setAttribute('data-testid', 'debug-tunables');
    for (const key of TUNABLE_KEYS) {
      form.appendChild(this.buildRow(doc, key));
    }
    this.root.appendChild(form);

    const resetBtn = doc.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset to spec';
    resetBtn.setAttribute('data-testid', 'debug-reset');
    Object.assign(resetBtn.style, {
      marginTop: '10px',
      width: '100%',
      padding: '6px 8px',
      cursor: 'pointer',
      background: '#1b263b',
      color: '#e8e8e8',
      border: '1px solid #3d5a80',
      borderRadius: '4px',
      fontFamily: 'inherit',
      fontSize: '12px',
    } as CSSStyleDeclaration);
    resetBtn.addEventListener('click', () => {
      resetTunables();
      this.syncInputsFromConstants();
    });
    this.root.appendChild(resetBtn);

    const parent = options.parent ?? doc.body;
    parent.appendChild(this.root);
    this.applyVisibility();
    this.syncInputsFromConstants();
  }

  get visible(): boolean {
    return this._visible;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.applyVisibility();
  }

  toggle(): void {
    this.setVisible(!this._visible);
  }

  /** Refresh the live status line from a sim snapshot. */
  update(snapshot: DebugOverlaySnapshot): void {
    this.statusEl.textContent = formatDebugStatus(snapshot);
  }

  /** Tear down the DOM node (scene shutdown / tests). */
  destroy(): void {
    this.root.remove();
  }

  /** Re-read WORLD/PLAYER into the form (after reset or external set). */
  syncInputsFromConstants(): void {
    for (const key of TUNABLE_KEYS) {
      const input = this.inputs.get(key);
      if (input?.isConnected) {
        input.value = String(getTunable(key));
      }
    }
  }

  private buildRow(doc: Document, key: TunableKey): HTMLElement {
    const row = doc.createElement('label');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      marginBottom: '4px',
    } as CSSStyleDeclaration);

    const name = doc.createElement('span');
    name.textContent = TUNABLE_LABELS[key];
    name.style.flex = '1';
    row.appendChild(name);

    const input = doc.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.setAttribute('data-tunable', key);
    input.setAttribute('data-testid', `tunable-${key}`);
    Object.assign(input.style, {
      width: '88px',
      padding: '2px 4px',
      background: '#0d1b2a',
      color: '#f5f5f5',
      border: '1px solid #3d5a80',
      borderRadius: '3px',
      fontFamily: 'inherit',
      fontSize: '12px',
    } as CSSStyleDeclaration);
    input.value = String(getTunable(key));
    input.addEventListener('change', () => {
      const value = parseTunableInput(input.value);
      if (value === null) {
        input.value = String(getTunable(key));
        return;
      }
      setTunable(key, value);
      // Reflect any truncation (integer keys).
      input.value = String(getTunable(key));
    });
    // Live edit on input as well so dragging steppers feel immediate.
    input.addEventListener('input', () => {
      const value = parseTunableInput(input.value);
      if (value === null) {
        return;
      }
      setTunable(key, value);
    });
    this.inputs.set(key, input);
    row.appendChild(input);
    return row;
  }

  private applyVisibility(): void {
    this.root.style.display = this._visible ? 'block' : 'none';
    this.root.setAttribute('aria-hidden', this._visible ? 'false' : 'true');
  }
}

/** Convenience: build a snapshot field defaults from PLAYER for tests. */
export function emptyDebugSnapshot(
  partial: Partial<DebugOverlaySnapshot> = {},
): DebugOverlaySnapshot {
  return {
    simRate: 0,
    simHzTarget: 30,
    timeStep: 1,
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
    onGround: false,
    ducking: false,
    jump: false,
    jump2: false,
    jumpUp: 0,
    boostCharge: PLAYER.boostChargeFrames,
    boostChargeMax: PLAYER.boostChargeFrames,
    hjump: false,
    weaponName: 'MachineGun',
    weaponIndex: 0,
    weaponAmmoHud: '∞',
    mgReloadHud: 'ready',
    mgShots: 0,
    bulletsActive: 0,
    bulletsCapacity: 0,
    bulletsFired: 0,
    bulletsRecycled: 0,
    ...partial,
  };
}
