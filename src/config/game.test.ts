import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from './game';

describe('game config', () => {
  it('uses the 16:9 design resolution', () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9);
  });
});
