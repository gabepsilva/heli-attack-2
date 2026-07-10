/**
 * Thin DOM panel for camera-feel intensity (issue #36).
 * Lives outside Phaser next to the audio HUD; preference persists via
 * {@link saveCameraFeelIntensity}.
 */

import {
  CAMERA_FEEL_INTENSITIES,
  nextCameraFeelIntensity,
  type CameraFeelIntensity,
} from '../config/cameraFeel';
import type { GameCameraFeel } from './gameCameraFeel';

export type CameraFeelHudOptions = {
  cameraFeel: GameCameraFeel;
  parent?: HTMLElement;
};

const LABELS: Record<CameraFeelIntensity, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export class CameraFeelHud {
  private readonly root: HTMLDivElement;
  private readonly select: HTMLSelectElement;
  private readonly status: HTMLSpanElement;
  private readonly cameraFeel: GameCameraFeel;

  constructor(options: CameraFeelHudOptions) {
    this.cameraFeel = options.cameraFeel;
    const parent = options.parent ?? document.body;

    this.root = document.createElement('div');
    this.root.dataset.cameraFeelHud = 'true';
    Object.assign(this.root.style, {
      position: 'fixed',
      right: '12px',
      bottom: '118px',
      zIndex: '20',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '10px 12px',
      background: 'rgba(8, 16, 28, 0.88)',
      color: '#dce6f0',
      fontFamily: 'monospace',
      fontSize: '13px',
      border: '1px solid #3d5a80',
      minWidth: '200px',
    });

    const title = document.createElement('div');
    title.textContent = 'Camera feel';
    title.style.fontWeight = 'bold';
    this.root.appendChild(title);

    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.appendChild(document.createTextNode('Juice'));

    this.select = document.createElement('select');
    this.select.setAttribute('aria-label', 'Camera feel intensity');
    for (const value of CAMERA_FEEL_INTENSITIES) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = LABELS[value];
      this.select.appendChild(opt);
    }
    this.select.value = this.cameraFeel.getIntensity();
    this.select.addEventListener('change', () => {
      this.cameraFeel.setIntensity(this.select.value as CameraFeelIntensity);
      this.refreshStatus();
    });
    row.appendChild(this.select);
    this.root.appendChild(row);

    const cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.textContent = 'Cycle intensity';
    Object.assign(cycleBtn.style, {
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '4px 8px',
      background: '#1b2838',
      color: '#dce6f0',
      border: '1px solid #3d5a80',
    });
    cycleBtn.addEventListener('click', () => {
      const next = nextCameraFeelIntensity(this.cameraFeel.getIntensity());
      this.cameraFeel.setIntensity(next);
      this.select.value = next;
      this.refreshStatus();
    });
    this.root.appendChild(cycleBtn);

    this.status = document.createElement('span');
    this.status.style.opacity = '0.85';
    this.root.appendChild(this.status);

    const hint = document.createElement('div');
    hint.style.opacity = '0.7';
    hint.style.fontSize = '11px';
    hint.textContent = 'Shake · flash · vignette · lead';
    this.root.appendChild(hint);

    parent.appendChild(this.root);
    this.refreshStatus();
  }

  refreshStatus(): void {
    const intensity = this.cameraFeel.getIntensity();
    this.status.textContent =
      intensity === 'off' ? 'effects off' : `${LABELS[intensity]} juice`;
  }

  destroy(): void {
    this.root.remove();
  }
}
