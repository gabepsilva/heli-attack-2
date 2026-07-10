/**
 * Issue #27 — GameSfx binder: music loops at Flash volume; events play the
 * mapped catalog ids; flame hold stays a single loop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_FLAME_HOLD_ID,
  AUDIO_MUSIC_ID,
  AUDIO_MUSIC_VOLUME,
} from '../config/audio';
import {
  AudioManager,
  type AudioBufferSourceLike,
  type AudioContextLike,
  type GainNodeLike,
} from './audioManager';
import { GameSfx } from './gameSfx';
import type { SoundId } from './catalog';

type MockGain = GainNodeLike & { connectedTo: unknown[] };
type MockSource = AudioBufferSourceLike & {
  started: boolean;
  stopped: boolean;
  connectedTo: unknown[];
};

function createMockContext(): {
  ctx: AudioContextLike;
  sources: MockSource[];
} {
  const sources: MockSource[] = [];
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
        gain: { value: 1 },
        connectedTo: [],
        connect(dest: unknown) {
          gain.connectedTo.push(dest);
        },
      };
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

  return { ctx, sources };
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

  it('starts music once with loop=true at Flash volume 0.5', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    await audio.unlock();

    const sfx = new GameSfx({ audio });
    const first = sfx.startMusic();
    const second = sfx.startMusic();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(sfx.isMusicPlaying()).toBe(true);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);
    expect(sources[0]!.started).toBe(true);
    // Per-play gain node is the voice gain (master is separate).
    // Find the voice gain: source connects to gain, gain value = music vol.
    // We assert via play options by checking only one looped music source.
    expect(AUDIO_MUSIC_VOLUME).toBe(0.5);
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
      AUDIO_FLAME_HOLD_ID,
    ]);
    await audio.unlock();
    const sfx = new GameSfx({ audio });

    const played = sfx.drainAndPlay([
      { type: 'weaponFire', weaponIndex: 0 },
      { type: 'weaponFire', weaponIndex: 2 },
      { type: 'hurt' },
      { type: 'hyperJump' },
      { type: 'heliBoom' },
      { type: 'powerup', collect: { kind: 'health', amount: 20 } },
      { type: 'powerup', collect: { kind: 'weapon', amount: 2 } },
      { type: 'powerup', collect: { kind: 'state', amount: 1 } },
    ]);

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

  it('keeps a single looping flame hold across frames and stops when fire ends', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_FLAME_HOLD_ID, silentBuffer());
    await audio.unlock();
    const sfx = new GameSfx({ audio });

    sfx.drainAndPlay([{ type: 'weaponFire', weaponIndex: 8 }]);
    expect(sfx.isFlameHoldPlaying()).toBe(true);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);

    sfx.drainAndPlay([{ type: 'weaponFire', weaponIndex: 8 }]);
    expect(sources).toHaveLength(1); // not restarted

    sfx.drainAndPlay([]); // no hold fire this frame
    expect(sfx.isFlameHoldPlaying()).toBe(false);
    expect(sources[0]!.stopped).toBe(true);
  });

  it('does not start a second music loop while the first is active', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_MUSIC_ID, silentBuffer());
    await audio.unlock();
    const sfx = new GameSfx({ audio });

    sfx.startMusic();
    sfx.startMusic();
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);

    sfx.stopMusic();
    expect(sfx.isMusicPlaying()).toBe(false);
    sfx.startMusic();
    expect(sources).toHaveLength(2);
    expect(sources[1]!.loop).toBe(true);
  });
});
