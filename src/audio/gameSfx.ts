/**
 * Plays queued {@link GameAudioEvent}s and owns looping music / flame hold
 * (issue #27). Phaser-free — scenes call {@link drainAndPlay} after each sim
 * update and {@link startMusic} once the run begins.
 *
 * FlameThrower mirrors Flash: `sflame` loops for the whole run at volume 0,
 * and hold-fire frames raise it to 1 (never restart the BufferSource).
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

export type DrainAndPlayOptions = {
  /**
   * How many sim ticks advanced this render frame. Empty drains with
   * `simTicks === 0` must not mute the flame hold (high-Hz displays often
   * bank zero steps between fixed 30 Hz ticks).
   */
  simTicks: number;
};

/**
 * Binds sim audio events to {@link AudioManager}. Tracks the music loop and
 * FlameThrower hold loop so they are not restarted every frame.
 */
export class GameSfx {
  private readonly audio: AudioManager;
  private musicHandle: PlayHandle | null = null;
  private flameHandle: PlayHandle | null = null;

  constructor(options: GameSfxOptions) {
    this.audio = options.audio;
  }

  /** True while the music BufferSource is still actively playing. */
  isMusicPlaying(): boolean {
    return this.musicHandle?.isPlaying() === true;
  }

  /** True while the flame hold BufferSource is still actively playing. */
  isFlameHoldPlaying(): boolean {
    return this.flameHandle?.isPlaying() === true;
  }

  /**
   * Start (or restart) seamless looping music at Flash in-game volume.
   * Also arms the silent flame hold loop (Flash `sflame.start` + volume 0).
   * Idempotent while the previous loop is still active.
   */
  startMusic(): PlayHandle | null {
    if (this.musicHandle?.isPlaying()) {
      return this.musicHandle;
    }
    this.musicHandle = this.audio.play(AUDIO_MUSIC_ID, {
      loop: true,
      volume: AUDIO_MUSIC_VOLUME,
      onEnded: () => {
        this.musicHandle = null;
      },
    });
    this.ensureFlameHoldSilent();
    return this.musicHandle;
  }

  stopMusic(): void {
    this.musicHandle?.stop();
    this.musicHandle = null;
  }

  /**
   * Play every queued event. Hold-weapon fire raises the flame loop gain;
   * a sim frame with no hold fire mutes it (Flash volume 0). Zero-tick
   * render frames leave the flame gain untouched.
   */
  drainAndPlay(
    events: readonly GameAudioEvent[],
    options: DrainAndPlayOptions,
  ): SoundId[] {
    let flameWanted = false;
    const played: SoundId[] = [];

    for (const event of events) {
      if (event.type === 'weaponFire' && weaponFireIsHold(event.weaponIndex)) {
        flameWanted = true;
        if (this.ensureFlameHoldSilent()) {
          this.flameHandle?.setVolume(1);
          played.push(AUDIO_FLAME_HOLD_ID);
        }
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

    if (options.simTicks > 0 && !flameWanted) {
      this.flameHandle?.setVolume(0);
    }

    return played;
  }

  destroy(): void {
    this.stopMusic();
    this.stopFlameHold();
  }

  /**
   * Ensure the flame BufferSource is looping (volume left as-is, or 0 on
   * first create). Returns false when the bus cannot start it.
   */
  private ensureFlameHoldSilent(): boolean {
    if (this.flameHandle?.isPlaying()) {
      return true;
    }
    this.flameHandle = this.audio.play(AUDIO_FLAME_HOLD_ID, {
      loop: true,
      volume: 0,
      onEnded: () => {
        this.flameHandle = null;
      },
    });
    return this.flameHandle !== null;
  }

  private stopFlameHold(): void {
    this.flameHandle?.stop();
    this.flameHandle = null;
  }
}
