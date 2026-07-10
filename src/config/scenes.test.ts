import { describe, expect, it } from 'vitest';
import { SCENE_KEYS } from './scenes';

describe('scene keys', () => {
  it('defines Boot and Game scenes for switching', () => {
    expect(SCENE_KEYS.Boot).toBe('BootScene');
    expect(SCENE_KEYS.Game).toBe('GameScene');
  });
});
