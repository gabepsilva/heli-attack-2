import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ART_WORLD_FINAL_DIR,
  ART_WORLD_FINAL_SCALE,
  ATLAS_KEY,
  ATLAS_IMAGE_PATH,
  ATLAS_JSON_PATH,
  ATLAS_MAX_SIZE,
  ATLAS_PADDING,
  BG_IMAGE_KEY,
  BG_IMAGE_PATH,
  BG_ORIGINAL_H,
  BG_ORIGINAL_W,
  TITLE_IMAGE_KEY,
  TITLE_IMAGE_PATH,
  TITLE_ORIGINAL_H,
  TITLE_ORIGINAL_W,
} from './art';

describe('art config constants (issue #32 / #33 / #34)', () => {
  it('locks atlas paths, final scales, and background plate', () => {
    expect(ATLAS_KEY).toBe('game-atlas');
    expect(ATLAS_IMAGE_PATH).toBe('atlas/game-atlas.png');
    expect(ATLAS_JSON_PATH).toBe('atlas/game-atlas.json');
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    expect(ART_PLAYER_FINAL_SCALE).toBe(8);
    expect(ART_PLAYER_FINAL_DIR).toBe('art/player');
    expect(ART_WORLD_FINAL_SCALE).toBe(4);
    expect(ART_WORLD_FINAL_DIR).toBe('art/world');
    expect(BG_IMAGE_KEY).toBe('game-bg');
    expect(BG_IMAGE_PATH).toBe('art/bg.png');
    expect(BG_ORIGINAL_W).toBe(452);
    expect(BG_ORIGINAL_H).toBe(322);
    expect(TITLE_IMAGE_KEY).toBe('game-title');
    expect(TITLE_IMAGE_PATH).toBe('art/title.png');
    expect(TITLE_ORIGINAL_W).toBe(452);
    expect(TITLE_ORIGINAL_H).toBe(322);
    expect(ATLAS_PADDING).toBe(2);
    expect(ATLAS_MAX_SIZE).toBe(4096);
  });
});
