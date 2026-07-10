/**
 * Thin DOM panel for master volume + mute (issue #26).
 * Lives outside Phaser so real `<input>` controls work; logic stays in AudioManager.
 */

import type { AudioManager } from './audioManager';

export type AudioHudOptions = {
  audio: AudioManager;
  parent?: HTMLElement;
};

export class AudioHud {
  private readonly root: HTMLDivElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly muteInput: HTMLInputElement;
  private readonly status: HTMLSpanElement;
  private readonly audio: AudioManager;

  constructor(options: AudioHudOptions) {
    this.audio = options.audio;
    const parent = options.parent ?? document.body;

    this.root = document.createElement('div');
    this.root.dataset.audioHud = 'true';
    Object.assign(this.root.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
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
    title.textContent = 'Audio (master)';
    title.style.fontWeight = 'bold';
    this.root.appendChild(title);

    const volRow = document.createElement('label');
    volRow.style.display = 'flex';
    volRow.style.alignItems = 'center';
    volRow.style.gap = '8px';
    volRow.appendChild(document.createTextNode('Vol'));
    this.volumeInput = document.createElement('input');
    this.volumeInput.type = 'range';
    this.volumeInput.min = '0';
    this.volumeInput.max = '1';
    this.volumeInput.step = '0.05';
    this.volumeInput.value = String(this.audio.getMasterVolume());
    this.volumeInput.style.flex = '1';
    this.volumeInput.addEventListener('input', () => {
      this.audio.setMasterVolume(Number(this.volumeInput.value));
      this.refreshStatus();
    });
    volRow.appendChild(this.volumeInput);
    this.root.appendChild(volRow);

    const muteRow = document.createElement('label');
    muteRow.style.display = 'flex';
    muteRow.style.alignItems = 'center';
    muteRow.style.gap = '8px';
    this.muteInput = document.createElement('input');
    this.muteInput.type = 'checkbox';
    this.muteInput.checked = this.audio.isMuted();
    this.muteInput.addEventListener('change', () => {
      this.audio.setMuted(this.muteInput.checked);
      this.refreshStatus();
    });
    muteRow.appendChild(this.muteInput);
    muteRow.appendChild(document.createTextNode('Mute'));
    this.root.appendChild(muteRow);

    this.status = document.createElement('span');
    this.status.style.opacity = '0.85';
    this.root.appendChild(this.status);

    const hint = document.createElement('div');
    hint.style.opacity = '0.7';
    hint.style.fontSize = '11px';
    hint.textContent = 'Click canvas → test SFX';
    this.root.appendChild(hint);

    parent.appendChild(this.root);
    this.refreshStatus();
  }

  refreshStatus(): void {
    const unlocked = this.audio.isUnlocked() ? 'unlocked' : 'locked';
    const gain = this.audio.effectiveMasterGain().toFixed(2);
    this.status.textContent = `${unlocked} · gain ${gain}`;
  }

  destroy(): void {
    this.root.remove();
  }
}
