import { describe, expect, it } from 'vitest';
import {
  AUDIO_DEFAULT_MASTER_VOLUME,
  AUDIO_MAX_ACTIVE_VOICES,
  AUDIO_POOL_SIZE,
  AUDIO_TEST_SFX_ID,
} from './audio';

describe('audio config (issue #26)', () => {
  it('exposes master-volume defaults and pool sizes from the ticket scope', () => {
    expect(AUDIO_DEFAULT_MASTER_VOLUME).toBe(1);
    expect(AUDIO_POOL_SIZE).toBe(4);
    expect(AUDIO_MAX_ACTIVE_VOICES).toBe(16);
    expect(AUDIO_TEST_SFX_ID).toBe('hjump');
  });
});
