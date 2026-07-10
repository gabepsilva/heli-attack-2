/**
 * Web Audio {@link AudioManager}: SFX pooling, master volume, mute, and
 * browser autoplay-unlock on first user gesture (issue #26).
 *
 * Phaser-free so unit tests can inject a mock context / buffers. Scenes stay
 * thin — they call unlock / play / setMasterVolume only.
 */

import {
  AUDIO_DEFAULT_MASTER_VOLUME,
  AUDIO_MAX_ACTIVE_VOICES,
  AUDIO_POOL_SIZE,
} from '../config/audio';
import { SOUND_IDS, soundUrls, type SoundId } from './catalog';

/** Minimal AudioContext surface used by the manager (real or mock). */
export type AudioContextLike = {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): AudioBufferSourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
};

export type GainNodeLike = {
  gain: { value: number };
  connect(dest: unknown): void;
};

export type AudioBufferSourceLike = {
  buffer: AudioBuffer | null;
  /** When true, the buffer repeats until stopped (music / flame hold). */
  loop: boolean;
  onended: ((ev?: Event) => void) | null;
  connect(dest: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
};

export type AudioManagerOptions = {
  /** Injected context factory (tests). Defaults to `new AudioContext()`. */
  createContext?: () => AudioContextLike;
  /** Override fetch for loading encoded audio bytes. */
  fetch?: (url: string) => Promise<Response>;
  poolSize?: number;
  maxActiveVoices?: number;
  defaultMasterVolume?: number;
};

export type PlayOptions = {
  /** Per-play multiplier (0–1), still gated by master volume + mute. */
  volume?: number;
  /**
   * Seamless buffer loop (Flash `start(0, 9999999)`). Music and FlameThrower
   * hold use this; one-shot SFX leave it false. Looping voices are exempt
   * from global voice-steal so music cannot be evicted mid-run.
   */
  loop?: boolean;
  /** Fired when the voice ends (stop, steal, or natural finish). */
  onEnded?: () => void;
};

type Voice = {
  id: SoundId;
  source: AudioBufferSourceLike;
  gain: GainNodeLike;
  startedAt: number;
  playing: boolean;
  /** Looping voices (music / flame hold) are never stolen for the pool cap. */
  loop: boolean;
};

export type PlayHandle = {
  soundId: SoundId;
  stop: () => void;
  /** Live voice gain (0–1), still gated by master × mute. */
  setVolume: (volume: number) => void;
  /** False after stop / natural end / steal. */
  isPlaying: () => boolean;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function defaultCreateContext(): AudioContextLike {
  const AC =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) {
    throw new Error('Web Audio API is not available in this environment');
  }
  return new AC() as unknown as AudioContextLike;
}

/**
 * Owns one AudioContext, a master gain, decoded buffers, and a voice pool so
 * overlapping SFX play concurrently instead of cutting each other off.
 */
export class AudioManager {
  private readonly createContext: () => AudioContextLike;
  private readonly fetchImpl: (url: string) => Promise<Response>;
  private readonly poolSize: number;
  private readonly maxActiveVoices: number;

  private ctx: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private unlocked = false;
  private muted = false;
  private masterVolume: number;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly active: Voice[] = [];
  private gestureCleanup: (() => void) | null = null;

  constructor(options: AudioManagerOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateContext;
    this.fetchImpl = options.fetch ?? ((url) => globalThis.fetch(url));
    this.poolSize = options.poolSize ?? AUDIO_POOL_SIZE;
    this.maxActiveVoices = options.maxActiveVoices ?? AUDIO_MAX_ACTIVE_VOICES;
    this.masterVolume = clamp01(
      options.defaultMasterVolume ?? AUDIO_DEFAULT_MASTER_VOLUME,
    );
  }

  /** True after a successful user-gesture unlock (context running). */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Master × mute gate applied to every voice (acceptance: attenuate / silence). */
  effectiveMasterGain(): number {
    return this.muted ? 0 : this.masterVolume;
  }

  /** How many BufferSources are currently playing (tests / debug). */
  getActiveVoiceCount(): number {
    return this.active.filter((v) => v.playing).length;
  }

  /**
   * Resume the AudioContext. Must run inside a user-gesture handler on the web.
   * Idempotent once unlocked.
   */
  async unlock(): Promise<void> {
    this.ensureGraph();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }
    // Successful gesture + resume is enough; mocks may not flip state to "running".
    this.unlocked = true;
    this.applyMasterGain();
  }

  /**
   * Attach one-shot pointer/key listeners that call {@link unlock}.
   * Returns a disposer. Safe to call multiple times (replaces prior binding).
   */
  attachUnlockGesture(target: EventTarget = globalThis.document): () => void {
    this.gestureCleanup?.();
    const onGesture = (): void => {
      void this.unlock();
      cleanup();
    };
    const cleanup = (): void => {
      target.removeEventListener('pointerdown', onGesture);
      target.removeEventListener('keydown', onGesture);
      if (this.gestureCleanup === cleanup) {
        this.gestureCleanup = null;
      }
    };
    target.addEventListener('pointerdown', onGesture);
    target.addEventListener('keydown', onGesture);
    this.gestureCleanup = cleanup;
    return cleanup;
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clamp01(value);
    this.applyMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  /** Register a pre-decoded buffer (unit tests / offline inject). */
  registerBuffer(id: SoundId, buffer: AudioBuffer): void {
    this.buffers.set(id, buffer);
  }

  hasBuffer(id: SoundId): boolean {
    return this.buffers.has(id);
  }

  /**
   * Fetch + decode the first working URL for `id` (ogg → webm → mp3).
   */
  async load(id: SoundId, urls: string[] = soundUrls(id)): Promise<void> {
    if (this.buffers.has(id)) {
      return;
    }
    this.ensureGraph();
    let lastError: unknown;
    for (const url of urls) {
      try {
        const res = await this.fetchImpl(url);
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status} for ${url}`);
          continue;
        }
        const data = await res.arrayBuffer();
        const buffer = await this.ctx!.decodeAudioData(data.slice(0));
        this.buffers.set(id, buffer);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `Failed to load sound "${id}" from [${urls.join(', ')}]: ${String(lastError)}`,
    );
  }

  /** Load every catalog id (or a subset). */
  async loadAll(ids: readonly SoundId[] = SOUND_IDS): Promise<void> {
    await Promise.all(ids.map((id) => this.load(id)));
  }

  /**
   * Play a loaded sound. Returns null if locked, missing buffer, or muted-only
   * gate is not the issue — mute still "plays" at gain 0 so overlap logic stays
   * testable; callers that need audible output should check {@link isUnlocked}.
   *
   * Overlapping calls allocate distinct voices up to {@link AUDIO_POOL_SIZE}
   * per id / {@link AUDIO_MAX_ACTIVE_VOICES} globally (oldest non-looping
   * stolen). Looping voices are never stolen.
   */
  play(id: SoundId, options: PlayOptions = {}): PlayHandle | null {
    if (!this.unlocked) {
      return null;
    }
    const buffer = this.buffers.get(id);
    if (!buffer) {
      return null;
    }
    this.ensureGraph();

    const loop = options.loop === true;

    while (this.getActiveVoiceCount() >= this.maxActiveVoices) {
      const victim = this.oldestStealableVoice();
      if (!victim) {
        // Cap is full of protected loops — refuse another one-shot rather than
        // killing music / flame hold.
        if (!loop) {
          return null;
        }
        break;
      }
      this.stopVoice(victim);
    }

    const sameIdActive = this.active.filter((v) => v.playing && v.id === id);
    if (sameIdActive.length >= this.poolSize) {
      const stealable = sameIdActive.filter((v) => !v.loop);
      if (stealable.length > 0) {
        this.stopVoice(
          stealable.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b)),
        );
      } else if (!loop) {
        return null;
      }
    }

    const source = this.ctx!.createBufferSource();
    const gain = this.ctx!.createGain();
    const playVol = clamp01(options.volume ?? 1);
    gain.gain.value = playVol;
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    gain.connect(this.masterGain!);

    const voice: Voice = {
      id,
      source,
      gain,
      startedAt: this.ctx!.currentTime,
      playing: true,
      loop,
    };
    const endedCallback = options.onEnded;
    let finished = false;
    const finish = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      voice.playing = false;
      const idx = this.active.indexOf(voice);
      if (idx >= 0) {
        this.active.splice(idx, 1);
      }
      endedCallback?.();
    };
    source.onended = () => {
      finish();
    };
    this.active.push(voice);
    source.start(0);

    return {
      soundId: id,
      stop: () => this.stopVoice(voice),
      setVolume: (volume: number) => {
        if (voice.playing) {
          voice.gain.gain.value = clamp01(volume);
        }
      },
      isPlaying: () => voice.playing,
    };
  }

  stopAll(): void {
    for (const voice of [...this.active]) {
      this.stopVoice(voice);
    }
  }

  /** Tear down gesture listeners and stop voices (scene shutdown). */
  destroy(): void {
    this.gestureCleanup?.();
    this.gestureCleanup = null;
    this.stopAll();
    this.unlocked = false;
  }

  private ensureGraph(): void {
    if (this.ctx) {
      return;
    }
    this.ctx = this.createContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (!this.masterGain) {
      return;
    }
    this.masterGain.gain.value = this.effectiveMasterGain();
  }

  private oldestStealableVoice(): Voice | undefined {
    let oldest: Voice | undefined;
    for (const voice of this.active) {
      if (!voice.playing || voice.loop) {
        continue;
      }
      if (!oldest || voice.startedAt < oldest.startedAt) {
        oldest = voice;
      }
    }
    return oldest;
  }

  private stopVoice(voice: Voice): void {
    if (!voice.playing) {
      return;
    }
    // Mark inactive before stop so a re-entrant onended is a no-op via finish().
    voice.playing = false;
    try {
      voice.source.stop(0);
    } catch {
      // already stopped
    }
    // Real AudioContext fires onended async; mocks may fire inside stop().
    // Always run the assigned handler so cleanup + onEnded stay deterministic.
    voice.source.onended?.(new Event('ended'));
  }
}
