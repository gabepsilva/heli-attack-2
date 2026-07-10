/**
 * Art pipeline constants (issues #32–#34 / #95).
 * Shipped textures are temporary original Flash sprites (iopred ha2/assets),
 * nearest-neighbor upscaled into art/player/ (8×) and art/world/ (4×).
 * Hi-res redraws are TBD — see docs/ART-SPEC.md.
 */

/** Phaser texture key for the packed gameplay atlas. */
export const ATLAS_KEY = 'game-atlas';

/** Public path (under Vite `public/`) for the packed atlas image. */
export const ATLAS_IMAGE_PATH = 'atlas/game-atlas.png';

/** Public path for the Phaser hash atlas JSON. */
export const ATLAS_JSON_PATH = 'atlas/game-atlas.json';

/**
 * Integer upscale formerly applied to reference sprites for placeholders (#32).
 * Retained for ART-SPEC history; the packer no longer emits placeholders.
 */
export const ART_PLACEHOLDER_SCALE = 4;

/**
 * Scale of committed player textures vs Flash-era original pixel sizes.
 * 8× nearest-neighbor upscale of originals into the 48×48 game sprite box
 * (issue #33 pipeline; #95 ships Flash originals at this scale).
 */
export const ART_PLAYER_FINAL_SCALE = 8;

/** Directory (repo-relative) of player PNGs packed into the atlas. */
export const ART_PLAYER_FINAL_DIR = 'art/player';

/**
 * Scale of committed world textures (helis, weapons, VFX, tiles, …)
 * vs Flash-era original sizes. 4× nearest-neighbor keeps the packer stable
 * (issue #34 pipeline; #95 ships Flash originals at this scale).
 */
export const ART_WORLD_FINAL_SCALE = 4;

/** Directory (repo-relative) of world PNGs packed into the atlas. */
export const ART_WORLD_FINAL_DIR = 'art/world';

/**
 * Full-bleed desert backdrop (not packed into the atlas — too large).
 * From Flash `bg.png` via `npm run art:import-original`, copied by `art:pack`.
 */
export const BG_IMAGE_KEY = 'game-bg';
export const BG_IMAGE_PATH = 'art/bg.png';
export const BG_ORIGINAL_W = 452;
export const BG_ORIGINAL_H = 322;

/** Max atlas edge length (power-of-two friendly ceiling for the packer). */
export const ATLAS_MAX_SIZE = 4096;

/** Padding between packed frames (px) to avoid bleed when filtering. */
export const ATLAS_PADDING = 2;
