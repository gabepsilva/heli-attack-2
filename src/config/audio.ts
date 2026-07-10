/**
 * Audio pipeline constants (issue #26).
 * Master volume + mute only — no per-channel mixer (see migration plan cuts).
 */

/** Default master volume (0–1) applied to every voice. */
export const AUDIO_DEFAULT_MASTER_VOLUME = 1;

/** Max concurrent voices per sound id (overlapping plays without cutting off). */
export const AUDIO_POOL_SIZE = 4;

/**
 * Soft ceiling for simultaneous voices across all sounds. Extra plays steal
 * the oldest active voice so stacked SFX cannot unbounded-clip the mix bus.
 */
export const AUDIO_MAX_ACTIVE_VOICES = 16;

/** Catalog id used for the click-to-play unlock demo SFX. */
export const AUDIO_TEST_SFX_ID = 'hjump' as const;
