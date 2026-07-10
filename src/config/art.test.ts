import { describe, expect, it } from 'vitest';
import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ATLAS_KEY,
  ATLAS_IMAGE_PATH,
  ATLAS_JSON_PATH,
  ATLAS_MAX_SIZE,
  ATLAS_PADDING,
} from './art';

describe('art config constants (issue #32 / #33)', () => {
  it('locks atlas paths, placeholder scale, and player final scale', () => {
    expect(ATLAS_KEY).toBe('game-atlas');
    expect(ATLAS_IMAGE_PATH).toBe('atlas/game-atlas.png');
    expect(ATLAS_JSON_PATH).toBe('atlas/game-atlas.json');
    expect(ART_PLACEHOLDER_SCALE).toBe(4);
    expect(ART_PLAYER_FINAL_SCALE).toBe(8);
    expect(ART_PLAYER_FINAL_DIR).toBe('art/player');
    expect(ATLAS_PADDING).toBe(2);
    expect(ATLAS_MAX_SIZE).toBe(2048);
  });
});
