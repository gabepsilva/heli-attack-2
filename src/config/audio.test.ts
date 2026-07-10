import { describe, expect, it } from 'vitest';
import {
  AUDIO_DEFAULT_MASTER_VOLUME,
  AUDIO_MAX_ACTIVE_VOICES,
  AUDIO_MUSIC_ID,
  AUDIO_MUSIC_VOLUME,
  AUDIO_POOL_SIZE,
  AUDIO_TEST_SFX_ID,
} from './audio';

describe('audio config (issues #26 / #27)', () => {
  it('exposes master-volume defaults and pool sizes from the ticket scope', () => {
    expect(AUDIO_DEFAULT_MASTER_VOLUME).toBe(1);
    expect(AUDIO_POOL_SIZE).toBe(4);
    expect(AUDIO_MAX_ACTIVE_VOICES).toBe(16);
    expect(AUDIO_TEST_SFX_ID).toBe('hjump');
  });

  it('seeds music loop id and Flash in-game volume (setVolume 50 → 0.5)', () => {
    expect(AUDIO_MUSIC_ID).toBe('music');
    expect(AUDIO_MUSIC_VOLUME).toBe(0.5);
  });
});
