/**
 * Issue #27 — GameSfx binder: music loops at Flash volume; events play the
 * mapped catalog ids; flame hold stays a single gain-gated loop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_FLAME_HOLD_ID,
  AUDIO_MUSIC_ID,
  AUDIO_MUSIC_VOLUME,
  AUDIO_MAX_ACTIVE_VOICES,
} from '../config/audio';
import {
  AudioManager,
  type AudioBufferSourceLike,
  type AudioContextLike,
  type GainNodeLike,
} from './audioManager';
import { GameSfx } from './gameSfx';
import type { SoundId } from './catalog';

type MockGain = GainNodeLike & {
  connectedTo: unknown[];
  valueWrites: number[];
};
type MockSource = AudioBufferSourceLike & {
  started: boolean;
  stopped: boolean;
  connectedTo: unknown[];
};

function createMockContext(): {
  ctx: AudioContextLike;
  sources: MockSource[];
  gains: MockGain[];
} {
  const sources: MockSource[] = [];
  const gains: MockGain[] = [];
  let currentTime = 0;

  const ctx: AudioContextLike = {
    state: 'suspended',
    get currentTime() {
      return currentTime;
    },
    destination: { kind: 'destination' },
    resume() {
      ctx.state = 'running';
      return Promise.resolve();
    },
    createGain() {
      const gain: MockGain = {
        gain: {
          get value() {
            return (gain as unknown as { _v: number })._v ?? 1;
          },
          set value(v: number) {
            (gain as unknown as { _v: number })._v = v;
            gain.valueWrites.push(v);
          },
        },
        connectedTo: [],
        valueWrites: [],
        connect(dest: unknown) {
          gain.connectedTo.push(dest);
        },
      };
      (gain as unknown as { _v: number })._v = 1;
      gains.push(gain);
      return gain;
    },
    createBufferSource() {
      currentTime += 0.001;
      const source: MockSource = {
        buffer: null,
        loop: false,
        onended: null,
        started: false,
        stopped: false,
        connectedTo: [],
        connect(dest: unknown) {
          source.connectedTo.push(dest);
        },
        start() {
          source.started = true;
        },
        stop() {
          source.stopped = true;
          source.onended?.(new Event('ended'));
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData(data: ArrayBuffer) {
      return Promise.resolve({
        duration: 0.5,
        length: 22050,
        numberOfChannels: 1,
        sampleRate: 44100,
        byteLength: data.byteLength,
      } as unknown as AudioBuffer);
    },
  };

  return { ctx, sources, gains };
}

function silentBuffer(): AudioBuffer {
  return {
    duration: 0.1,
    length: 4410,
    numberOfChannels: 1,
    sampleRate: 44100,
  } as unknown as AudioBuffer;
}

function registerAll(audio: AudioManager, ids: readonly SoundId[]): void {
  for (const id of ids) {
    audio.registerBuffer(id, silentBuffer());
  }
}

describe('GameSfx (issue #27 — music loop + event playback)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts music once with loop=true at Flash volume 0.5 and arms silent flame', async () => {
    const { ctx, sources, gains } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    audio.registerBuffer(AUDIO_FLAME_HOLD_ID, silentBuffer());
    await audio.unlock();

    const sfx = new GameSfx({ audio });
    const first = sfx.startMusic();
    const second = sfx.startMusic();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(sfx.isMusicPlaying()).toBe(true);
    expect(sfx.isFlameHoldPlaying()).toBe(true);
    // music + flame = 2 looping sources
    expect(sources).toHaveLength(2);
    expect(sources[0]!.loop).toBe(true);
    expect(sources[1]!.loop).toBe(true);
    expect(AUDIO_MUSIC_VOLUME).toBe(0.5);
    // gains[0] = master; gains[1] = music voice; gains[2] = flame voice
    expect(gains[1]!.gain.value).toBe(AUDIO_MUSIC_VOLUME);
    expect(gains[2]!.gain.value).toBe(0);
  });

  it('plays the correct one-shot for weapon / hurt / hyper-jump / heliboom / powerup', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    registerAll(audio, [
      'gun',
      'shotgun',
      'hurt',
      'hjump',
      'heliboom',
      'sphealth',
      'spshotgun',
      'sptridamage',
      AUDIO_MUSIC_ID,
      AUDIO_FLAME_HOLD_ID,
    ]);
    await audio.unlock();
    const sfx = new GameSfx({ audio });

    const played = sfx.drainAndPlay(
      [
        { type: 'weaponFire', weaponIndex: 0 },
        { type: 'weaponFire', weaponIndex: 2 },
        { type: 'hurt' },
        { type: 'hyperJump' },
        { type: 'heliBoom' },
        { type: 'powerup', collect: { kind: 'health', amount: 20 } },
        {
          type: 'powerup',
          collect: { kind: 'weapon', amount: 14, weaponIndex: 2 },
        },
        { type: 'powerup', collect: { kind: 'state', amount: 1 } },
      ],
      { simTicks: 1 },
    );

    expect(played).toEqual([
      'gun',
      'shotgun',
      'hurt',
      'hjump',
      'heliboom',
      'sphealth',
      'spshotgun',
      'sptridamage',
    ]);
    expect(sources.every((s) => s.loop === false)).toBe(true);
  });

  it('keeps one flame loop and only gates gain — empty render frames do not restart', async () => {
    const { ctx, sources, gains } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    audio.registerBuffer(AUDIO_FLAME_HOLD_ID, silentBuffer());
    await audio.unlock();
    const sfx = new GameSfx({ audio });
    sfx.startMusic();
    expect(sources).toHaveLength(2);

    sfx.drainAndPlay([{ type: 'weaponFire', weaponIndex: 8 }], {
      simTicks: 1,
    });
    expect(sources).toHaveLength(2); // not restarted
    expect(gains[2]!.gain.value).toBe(1);

    // High-Hz display: zero sim ticks, empty drain — must NOT mute/restart.
    sfx.drainAndPlay([], { simTicks: 0 });
    expect(sources).toHaveLength(2);
    expect(sources[1]!.stopped).toBe(false);
    expect(gains[2]!.gain.value).toBe(1);

    // Another hold-fire sim tick — still one source.
    sfx.drainAndPlay([{ type: 'weaponFire', weaponIndex: 8 }], {
      simTicks: 1,
    });
    expect(sources).toHaveLength(2);

    // Sim advanced without hold fire → mute (Flash setVolume(0)).
    sfx.drainAndPlay([], { simTicks: 1 });
    expect(sources).toHaveLength(2);
    expect(sources[1]!.stopped).toBe(false);
    expect(gains[2]!.gain.value).toBe(0);
  });

  it('clears musicHandle when the loop ends so startMusic can restart', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    audio.registerBuffer(AUDIO_FLAME_HOLD_ID, silentBuffer());
    await audio.unlock();
    const sfx = new GameSfx({ audio });

    sfx.startMusic();
    expect(sfx.isMusicPlaying()).toBe(true);
    sfx.stopMusic();
    expect(sfx.isMusicPlaying()).toBe(false);
    expect(sources[0]!.stopped).toBe(true);

    sfx.startMusic();
    expect(sfx.isMusicPlaying()).toBe(true);
    // music restarted + flame still/re-armed
    expect(
      sources.filter((s) => s.loop && s.started && !s.stopped).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('does not steal looping music when the one-shot voice cap is full', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({
      createContext: () => ctx,
      maxActiveVoices: AUDIO_MAX_ACTIVE_VOICES,
    });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    audio.registerBuffer(AUDIO_FLAME_HOLD_ID, silentBuffer());
    audio.registerBuffer('gun', silentBuffer());
    await audio.unlock();
    const sfx = new GameSfx({ audio });
    sfx.startMusic();
    const musicSource = sources[0]!;

    // Fill the remaining voice slots with one-shots (cap 16; music+flame = 2).
    for (let i = 0; i < AUDIO_MAX_ACTIVE_VOICES; i += 1) {
      audio.play('gun');
    }

    expect(musicSource.stopped).toBe(false);
    expect(sfx.isMusicPlaying()).toBe(true);
    expect(sfx.isFlameHoldPlaying()).toBe(true);
  });
});
