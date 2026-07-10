/**
 * Audio pipeline constants (issues #26 / #27).
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

/** Catalog id used for the click-to-play unlock demo SFX (#26). */
export const AUDIO_TEST_SFX_ID = 'hjump' as const;

/** Background music catalog id (Flash `smusic`). */
export const AUDIO_MUSIC_ID = 'music' as const;

/**
 * In-game music gain (Flash `smusic.setVolume(50)` → 50/100).
 * Applied as a per-play multiplier under the master bus.
 */
export const AUDIO_MUSIC_VOLUME = 0.5;

/** FlameThrower hold loop (Flash `sflame.start(0,9999999)` at game start). */
export const AUDIO_FLAME_HOLD_ID = 'flame' as const;
