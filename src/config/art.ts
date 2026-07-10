/**
 * Art pipeline constants (issues #32–#34).
 * Non-player sprites still use 4× placeholder upscales from Flash reference
 * PNGs (#32). Player frames are final 1080p-native redraws (#33). Remaining
 * placeholders are replaced in #34.
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

/**
 * Scale of committed final player redraws vs Flash-era original pixel sizes.
 * 8× yields crisp textures when drawn into the 48×48 game sprite box on a
 * 1920×1080 canvas (issue #33).
 */
export const ART_PLAYER_FINAL_SCALE = 8;

/** Directory (repo-relative) of final player PNGs packed into the atlas. */
export const ART_PLAYER_FINAL_DIR = 'art/player';

/** Max atlas edge length (power-of-two friendly ceiling for the packer). */
export const ATLAS_MAX_SIZE = 2048;

/** Padding between packed frames (px) to avoid bleed when filtering. */
export const ATLAS_PADDING = 2;
