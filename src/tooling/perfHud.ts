/**
 * Thin DOM panel for live FPS / frame budget / pool occupancy (issue #37).
 * Lives outside Phaser next to the debug overlay.
 */

import { PERF } from '../config/perf';
import {
  formatPerfStatus,
  type PerfMonitor,
  type PerfStats,
} from './perfMonitor';

export type PerfHudOptions = {
  monitor: PerfMonitor;
  parent?: HTMLElement;
  /** Initial visibility (defaults to {@link PERF.defaultHudVisible}). */
  visible?: boolean;
};

/**
 * On-screen perf HUD: FPS, frame ms, 60/30 budget pass, pool counters.
 * Toggle with {@link setVisible} / {@link toggle} (GameScene binds F3; also
 * End with the rest of debug info — #107).
 */
export class PerfHud {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLPreElement;
  private readonly monitor: PerfMonitor;
  private _visible: boolean;

  constructor(options: PerfHudOptions) {
    this.monitor = options.monitor;
    this._visible = options.visible ?? PERF.defaultHudVisible;
    const parent = options.parent ?? document.body;

    this.root = document.createElement('div');
    this.root.dataset.perfHud = 'true';
    this.root.setAttribute('data-testid', 'perf-hud');
    Object.assign(this.root.style, {
      position: 'fixed',
      left: '12px',
      top: '12px',
      zIndex: '20',
      display: this._visible ? 'flex' : 'none',
      flexDirection: 'column',
      gap: '4px',
      padding: '8px 10px',
      background: 'rgba(8, 16, 28, 0.88)',
      color: '#dce6f0',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12px',
      lineHeight: '1.4',
      border: '1px solid #3d5a80',
      minWidth: '280px',
      pointerEvents: 'none',
    });

    const title = document.createElement('div');
    title.textContent = 'Perf  (F3 toggle)';
    title.style.fontWeight = 'bold';
    title.style.color = '#90be6d';
    this.root.appendChild(title);

    this.status = document.createElement('pre');
    this.status.setAttribute('data-testid', 'perf-status');
    Object.assign(this.status.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      color: '#cde',
      fontSize: '11px',
    });
    this.root.appendChild(this.status);

    const hint = document.createElement('div');
    hint.style.opacity = '0.7';
    hint.style.fontSize = '10px';
    hint.textContent = `targets ${PERF.desktopTargetFps}fps desktop · ≥${PERF.mobileTargetFps}fps mobile`;
    this.root.appendChild(hint);

    parent.appendChild(this.root);
    this.refresh();
  }

  get visible(): boolean {
    return this._visible;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.root.style.display = visible ? 'flex' : 'none';
    this.root.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  toggle(): void {
    this.setVisible(!this._visible);
  }

  /** Pull the latest monitor snapshot into the DOM. */
  refresh(): PerfStats {
    const stats = this.monitor.snapshot();
    this.status.textContent = formatPerfStatus(stats);
    return stats;
  }

  destroy(): void {
    this.root.remove();
  }
}
