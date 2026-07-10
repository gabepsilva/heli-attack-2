/**
 * Art pipeline constants (issue #32).
 * Placeholders are upscaled from Flash-era reference PNGs; final art lands in #33/#34.
 */

/** Phaser texture key for the packed gameplay atlas. */
export const ATLAS_KEY = 'game-atlas';

/** Public path (under Vite `public/`) for the packed atlas image. */
export const ATLAS_IMAGE_PATH = 'atlas/game-atlas.png';

/** Public path for the Phaser hash atlas JSON. */
export const ATLAS_JSON_PATH = 'atlas/game-atlas.json';

/**
 * Integer upscale applied to reference sprites when building placeholders.
 * 4× keeps small Flash sprites readable on the 1920×1080 design canvas while
 * game logic stays in original Flash pixel units (see {@link PLAYER.spriteW}).
 */
export const ART_PLACEHOLDER_SCALE = 4;

/** Max atlas edge length (power-of-two friendly ceiling for the packer). */
export const ATLAS_MAX_SIZE = 2048;

/** Padding between packed frames (px) to avoid bleed when filtering. */
export const ATLAS_PADDING = 2;
