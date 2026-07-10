/**
 * Plays queued {@link GameAudioEvent}s and owns looping music / flame hold
 * (issue #27). Phaser-free — scenes call {@link drainAndPlay} after each sim
 * update and {@link startMusic} once the run begins.
 */

import {
  AUDIO_FLAME_HOLD_ID,
  AUDIO_MUSIC_ID,
  AUDIO_MUSIC_VOLUME,
} from '../config/audio';
import type { AudioManager, PlayHandle } from './audioManager';
import {
  soundForAudioEvent,
  weaponFireIsHold,
  type GameAudioEvent,
} from './eventMap';
import type { SoundId } from './catalog';

export type GameSfxOptions = {
  audio: AudioManager;
};

/**
 * Binds sim audio events to {@link AudioManager}. Tracks the music loop and
 * FlameThrower hold loop so they are not restarted every frame.
 */
export class GameSfx {
  private readonly audio: AudioManager;
  private musicHandle: PlayHandle | null = null;
  private flameHandle: PlayHandle | null = null;
  private flameWanted = false;

  constructor(options: GameSfxOptions) {
    this.audio = options.audio;
  }

  /** True while the music BufferSource is still marked playing. */
  isMusicPlaying(): boolean {
    return this.musicHandle !== null;
  }

  /** True while the flame hold loop is active. */
  isFlameHoldPlaying(): boolean {
    return this.flameHandle !== null;
  }

  /**
   * Start (or restart) seamless looping music at Flash in-game volume.
   * Idempotent while the previous loop is still active.
   */
  startMusic(): PlayHandle | null {
    if (this.musicHandle) {
      return this.musicHandle;
    }
    this.musicHandle = this.audio.play(AUDIO_MUSIC_ID, {
      loop: true,
      volume: AUDIO_MUSIC_VOLUME,
    });
    return this.musicHandle;
  }

  stopMusic(): void {
    this.musicHandle?.stop();
    this.musicHandle = null;
  }

  /**
   * Play every queued event. Hold-weapon fire keeps the flame loop up for the
   * frame; if no hold fire arrives, the flame loop is stopped (Flash volume 0).
   */
  drainAndPlay(events: readonly GameAudioEvent[]): SoundId[] {
    this.flameWanted = false;
    const played: SoundId[] = [];

    for (const event of events) {
      if (event.type === 'weaponFire' && weaponFireIsHold(event.weaponIndex)) {
        this.flameWanted = true;
        this.ensureFlameHold();
        played.push(AUDIO_FLAME_HOLD_ID);
        continue;
      }
      const id = soundForAudioEvent(event);
      if (id === null) {
        continue;
      }
      if (this.audio.play(id)) {
        played.push(id);
      }
    }

    if (!this.flameWanted) {
      this.stopFlameHold();
    }

    return played;
  }

  destroy(): void {
    this.stopMusic();
    this.stopFlameHold();
  }

  private ensureFlameHold(): void {
    if (this.flameHandle) {
      return;
    }
    this.flameHandle = this.audio.play(AUDIO_FLAME_HOLD_ID, { loop: true });
  }

  private stopFlameHold(): void {
    this.flameHandle?.stop();
    this.flameHandle = null;
  }
}
