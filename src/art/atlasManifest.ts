/**
 * Atlas manifest helpers — validate Phaser hash JSON and resolve frame metadata
 * without touching Phaser (unit-testable).
 */

import { ATLAS_IMAGE_PATH, ATLAS_JSON_PATH, ATLAS_KEY } from '../config/art';
import {
  SPRITE_DEFS,
  type SpriteId,
  getSpriteDef,
  textureSize,
} from './catalog';

/** Phaser Texture Packer / hash atlas frame entry. */
export type AtlasFrame = Readonly<{
  frame: Readonly<{ x: number; y: number; w: number; h: number }>;
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: Readonly<{ x: number; y: number; w: number; h: number }>;
  sourceSize?: Readonly<{ w: number; h: number }>;
  pivot?: Readonly<{ x: number; y: number }>;
}>;

export type AtlasJson = Readonly<{
  textures?: readonly unknown[];
  frames: Readonly<Record<string, AtlasFrame>>;
  meta: Readonly<{
    app?: string;
    version?: string;
    image: string;
    format?: string;
    size: Readonly<{ w: number; h: number }>;
    scale?: string | number;
  }>;
}>;

export type AtlasLoadPaths = Readonly<{
  key: string;
  imagePath: string;
  jsonPath: string;
}>;

/** Paths BootScene / loaders use for `this.load.atlas`. */
export function atlasLoadPaths(): AtlasLoadPaths {
  return {
    key: ATLAS_KEY,
    imagePath: ATLAS_IMAGE_PATH,
    jsonPath: ATLAS_JSON_PATH,
  };
}

/** Every catalog sprite id must appear as a frame in the packed atlas. */
export function expectedFrameIds(): readonly SpriteId[] {
  return SPRITE_DEFS.map((s) => s.id);
}

export type ManifestValidation = Readonly<{
  ok: boolean;
  missing: readonly string[];
  unexpected: readonly string[];
  sizeMismatches: readonly string[];
  pivotMismatches: readonly string[];
}>;

/**
 * Assert a packed atlas JSON matches the sprite catalog (acceptance: scene can
 * render every documented frame from the atlas).
 */
export function validateAtlasManifest(json: AtlasJson): ManifestValidation {
  const frames = json.frames ?? {};
  const present = new Set(Object.keys(frames));
  const expected = expectedFrameIds();

  const missing = expected.filter((id) => !present.has(id));
  const unexpected = [...present].filter(
    (id) => !expected.includes(id as SpriteId),
  );

  const sizeMismatches: string[] = [];
  const pivotMismatches: string[] = [];

  for (const id of expected) {
    if (!present.has(id)) {
      continue;
    }
    const def = getSpriteDef(id);
    const tex = textureSize(def);
    const entry = frames[id]!;
    if (entry.frame.w !== tex.w || entry.frame.h !== tex.h) {
      sizeMismatches.push(
        `${id}: frame ${entry.frame.w}×${entry.frame.h} != ${tex.w}×${tex.h}`,
      );
    }
    const pivot = entry.pivot;
    if (!pivot || pivot.x !== def.pivot.x || pivot.y !== def.pivot.y) {
      pivotMismatches.push(
        `${id}: pivot ${JSON.stringify(pivot)} != ${JSON.stringify(def.pivot)}`,
      );
    }
  }

  return {
    ok:
      missing.length === 0 &&
      unexpected.length === 0 &&
      sizeMismatches.length === 0 &&
      pivotMismatches.length === 0,
    missing,
    unexpected,
    sizeMismatches,
    pivotMismatches,
  };
}
