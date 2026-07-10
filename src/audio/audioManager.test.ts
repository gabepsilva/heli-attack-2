import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_DEFAULT_MASTER_VOLUME,
  AUDIO_MAX_ACTIVE_VOICES,
  AUDIO_POOL_SIZE,
  AUDIO_TEST_SFX_ID,
} from '../config/audio';
import {
  AudioManager,
  type AudioBufferSourceLike,
  type AudioContextLike,
  type GainNodeLike,
} from './audioManager';
import { SOUND_IDS, soundUrls } from './catalog';

const AUDIO_DIR = dirname(fileURLToPath(import.meta.url));

type MockGain = GainNodeLike & { connectedTo: unknown[] };
type MockSource = AudioBufferSourceLike & {
  started: boolean;
  stopped: boolean;
  connectedTo: unknown[];
};

function createMockContext(): {
  ctx: AudioContextLike;
  sources: MockSource[];
  masterGains: MockGain[];
} {
  const sources: MockSource[] = [];
  const masterGains: MockGain[] = [];
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
      masterGains.push(gain);
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

  return { ctx, sources, masterGains };
}

function silentBuffer(): AudioBuffer {
  return {
    duration: 0.1,
    length: 4410,
    numberOfChannels: 1,
    sampleRate: 44100,
  } as unknown as AudioBuffer;
}

describe('audio catalog / constants (issue #26)', () => {
  it('ships multi-format URLs (ogg, webm, mp3 fallback) for every catalog id', () => {
    expect(SOUND_IDS).toContain(AUDIO_TEST_SFX_ID);
    const urls = soundUrls(AUDIO_TEST_SFX_ID);
    expect(urls).toEqual([
      'audio/hjump.ogg',
      'audio/hjump.webm',
      'audio/hjump.mp3',
    ]);
  });

  it('defaults master volume to 1 and pools overlapping voices', () => {
    expect(AUDIO_DEFAULT_MASTER_VOLUME).toBe(1);
    expect(AUDIO_POOL_SIZE).toBe(4);
    expect(AUDIO_MAX_ACTIVE_VOICES).toBe(16);
  });
});

describe('play surface without AudioHud (issue #107)', () => {
  it('removes the AudioHud DOM panel module from the play surface (AC)', () => {
    expect(existsSync(resolve(AUDIO_DIR, 'audioHud.ts'))).toBe(false);
  });

  it('keeps AudioManager SFX/music controls without a volume panel (AC)', async () => {
    const { ctx, sources, masterGains } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());
    await audio.unlock();

    // Playback still works with no AudioHud wiring.
    expect(audio.play(AUDIO_TEST_SFX_ID)).not.toBeNull();
    expect(sources).toHaveLength(1);

    // Master volume / mute remain API-driven (no DOM panel required).
    audio.setMasterVolume(0.5);
    expect(masterGains[0]!.gain.value).toBe(0.5);
    audio.setMuted(true);
    expect(audio.effectiveMasterGain()).toBe(0);
    audio.setMuted(false);
    expect(audio.effectiveMasterGain()).toBe(0.5);
  });
});

describe('AudioManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not play until unlocked by a user gesture (autoplay policy)', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());

    expect(audio.isUnlocked()).toBe(false);
    expect(audio.play(AUDIO_TEST_SFX_ID)).toBeNull();
    expect(sources).toHaveLength(0);

    await audio.unlock();
    expect(audio.isUnlocked()).toBe(true);
    expect(ctx.state).toBe('running');

    const handle = audio.play(AUDIO_TEST_SFX_ID);
    expect(handle).not.toBeNull();
    expect(handle!.soundId).toBe(AUDIO_TEST_SFX_ID);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.started).toBe(true);
  });

  it('unlocks via attachUnlockGesture on first pointerdown', async () => {
    const { ctx } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    const target = new EventTarget();
    audio.attachUnlockGesture(target);

    expect(audio.isUnlocked()).toBe(false);
    target.dispatchEvent(new Event('pointerdown'));
    // unlock is async — wait a tick
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.isUnlocked()).toBe(true);
  });

  it('master volume attenuates all audio; mute silences everything', async () => {
    const { ctx, masterGains } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    await audio.unlock();

    expect(masterGains).toHaveLength(1);
    const master = masterGains[0]!;
    expect(audio.getMasterVolume()).toBe(AUDIO_DEFAULT_MASTER_VOLUME);
    expect(audio.effectiveMasterGain()).toBe(1);
    expect(master.gain.value).toBe(1);

    audio.setMasterVolume(0.25);
    expect(audio.getMasterVolume()).toBe(0.25);
    expect(audio.effectiveMasterGain()).toBe(0.25);
    expect(master.gain.value).toBe(0.25);

    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    expect(audio.effectiveMasterGain()).toBe(0);
    expect(master.gain.value).toBe(0);

    // Volume change while muted stays silent until unmuted.
    audio.setMasterVolume(0.8);
    expect(audio.effectiveMasterGain()).toBe(0);
    expect(master.gain.value).toBe(0);

    audio.setMuted(false);
    expect(audio.effectiveMasterGain()).toBe(0.8);
    expect(master.gain.value).toBe(0.8);
  });

  it('clamps master volume to [0, 1]', async () => {
    const { ctx, masterGains } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    await audio.unlock();

    audio.setMasterVolume(2);
    expect(audio.getMasterVolume()).toBe(1);
    expect(masterGains[0]!.gain.value).toBe(1);

    audio.setMasterVolume(-0.5);
    expect(audio.getMasterVolume()).toBe(0);
    expect(masterGains[0]!.gain.value).toBe(0);
  });

  it('overlapping plays use distinct voices (no single-voice clip)', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({
      createContext: () => ctx,
      poolSize: AUDIO_POOL_SIZE,
    });
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());
    await audio.unlock();

    const handles = [
      audio.play(AUDIO_TEST_SFX_ID),
      audio.play(AUDIO_TEST_SFX_ID),
      audio.play(AUDIO_TEST_SFX_ID),
    ];
    expect(handles.every((h) => h !== null)).toBe(true);
    expect(audio.getActiveVoiceCount()).toBe(3);
    expect(sources).toHaveLength(3);
    expect(sources.every((s) => s.started && !s.stopped)).toBe(true);
    // Each voice connects through its own gain into the shared master.
    expect(new Set(sources.map((s) => s.connectedTo[0])).size).toBe(3);
  });

  it('steals the oldest same-id voice when the per-sound pool is full', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({
      createContext: () => ctx,
      poolSize: 2,
      maxActiveVoices: AUDIO_MAX_ACTIVE_VOICES,
    });
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());
    await audio.unlock();

    audio.play(AUDIO_TEST_SFX_ID);
    audio.play(AUDIO_TEST_SFX_ID);
    expect(audio.getActiveVoiceCount()).toBe(2);

    audio.play(AUDIO_TEST_SFX_ID);
    expect(audio.getActiveVoiceCount()).toBe(2);
    expect(sources[0]!.stopped).toBe(true);
    expect(sources[1]!.stopped).toBe(false);
    expect(sources[2]!.started).toBe(true);
  });

  it('loads the first working format URL (ogg → webm → mp3)', async () => {
    const { ctx } = createMockContext();
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('.ogg')) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      if (url.endsWith('.webm')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    const audio = new AudioManager({
      createContext: () => ctx,
      fetch: fetchMock,
    });
    await audio.unlock();
    await audio.load(AUDIO_TEST_SFX_ID);

    expect(audio.hasBuffer(AUDIO_TEST_SFX_ID)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('audio/hjump.ogg');
    expect(fetchMock).toHaveBeenCalledWith('audio/hjump.webm');
    expect(fetchMock).not.toHaveBeenCalledWith('audio/hjump.mp3');
  });

  it('rejects when every format URL fails to load', async () => {
    const { ctx } = createMockContext();
    const audio = new AudioManager({
      createContext: () => ctx,
      fetch: () => Promise.resolve({ ok: false, status: 500 } as Response),
    });
    await audio.unlock();
    await expect(audio.load(AUDIO_TEST_SFX_ID)).rejects.toThrow(
      /Failed to load/,
    );
  });

  it('stopAll and destroy halt active voices', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());
    await audio.unlock();
    audio.play(AUDIO_TEST_SFX_ID);
    audio.play(AUDIO_TEST_SFX_ID);
    expect(audio.getActiveVoiceCount()).toBe(2);

    audio.stopAll();
    expect(audio.getActiveVoiceCount()).toBe(0);
    expect(sources.every((s) => s.stopped)).toBe(true);

    audio.play(AUDIO_TEST_SFX_ID);
    expect(audio.getActiveVoiceCount()).toBe(1);
    audio.destroy();
    expect(audio.isUnlocked()).toBe(false);
    expect(audio.getActiveVoiceCount()).toBe(0);
    expect(audio.play(AUDIO_TEST_SFX_ID)).toBeNull();
  });

  it('returns null from play when the buffer is missing', async () => {
    const { ctx } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    await audio.unlock();
    expect(audio.play(AUDIO_TEST_SFX_ID)).toBeNull();
  });

  it('sets source.loop for seamless music-style playback (issue #27)', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.registerBuffer('music', silentBuffer());
    await audio.unlock();

    audio.play('music', { loop: true, volume: 0.5 });
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);
    expect(sources[0]!.started).toBe(true);
  });

  it('never steals looping voices when the global cap is full (issue #27)', async () => {
    const { ctx, sources } = createMockContext();
    const audio = new AudioManager({
      createContext: () => ctx,
      maxActiveVoices: 3,
    });
    audio.registerBuffer('music', silentBuffer());
    audio.registerBuffer(AUDIO_TEST_SFX_ID, silentBuffer());
    await audio.unlock();

    audio.play('music', { loop: true });
    const music = sources[0]!;
    audio.play(AUDIO_TEST_SFX_ID);
    audio.play(AUDIO_TEST_SFX_ID);
    expect(audio.getActiveVoiceCount()).toBe(3);

    // Cap full — next one-shot steals an older one-shot, not music.
    audio.play(AUDIO_TEST_SFX_ID);
    expect(music.stopped).toBe(false);
    expect(audio.getActiveVoiceCount()).toBe(3);
  });
});
