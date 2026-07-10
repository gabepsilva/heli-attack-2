import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/constants';
import {
  TEST_ARENA_COLS,
  TEST_ARENA_HEIGHT_PX,
  TEST_ARENA_ROWS,
  TEST_ARENA_WIDTH_PX,
  createTestArena,
} from './testArena';
import { TILE_EMPTY, TILE_SOLID } from './tileMap';

describe('createTestArena', () => {
  const map = createTestArena();

  it('is a 24×16 grid of 50px tiles (1200×800 px)', () => {
    expect(map.width).toBe(TEST_ARENA_COLS);
    expect(map.height).toBe(TEST_ARENA_ROWS);
    expect(map.width).toBe(24);
    expect(map.height).toBe(16);
    expect(map.tileSize).toBe(WORLD.tile);
    expect(map.tileSize).toBe(50);
    expect(TEST_ARENA_WIDTH_PX).toBe(24 * 50);
    expect(TEST_ARENA_HEIGHT_PX).toBe(16 * 50);
    expect(TEST_ARENA_WIDTH_PX).toBe(1200);
    expect(TEST_ARENA_HEIGHT_PX).toBe(800);
  });

  it('has solid outer walls on every edge', () => {
    for (let x = 0; x < map.width; x += 1) {
      expect(map.cells[0]![x]).toBe(TILE_SOLID); // ceiling
      expect(map.cells[map.height - 1]![x]).toBe(TILE_SOLID); // bottom
    }
    for (let y = 0; y < map.height; y += 1) {
      expect(map.cells[y]![0]).toBe(TILE_SOLID); // left wall
      expect(map.cells[y]![map.width - 1]).toBe(TILE_SOLID); // right wall
    }
  });

  it('has a floating platform at row 3, cols 9–14', () => {
    for (let x = 9; x <= 14; x += 1) {
      expect(map.cells[3]![x]).toBe(TILE_SOLID);
    }
    // Just outside the platform stays empty (open air).
    expect(map.cells[3]![8]).toBe(TILE_EMPTY);
    expect(map.cells[3]![15]).toBe(TILE_EMPTY);
    expect(map.cells[2]![10]).toBe(TILE_EMPTY);
    expect(map.cells[4]![10]).toBe(TILE_EMPTY);
  });

  it('has a floor with a pit spanning cols 7–14 at rows 12–13', () => {
    // Pit is empty.
    for (let x = 7; x <= 14; x += 1) {
      expect(map.cells[12]![x]).toBe(TILE_EMPTY);
      expect(map.cells[13]![x]).toBe(TILE_EMPTY);
    }
    // Floor shoulders are solid.
    expect(map.cells[12]![6]).toBe(TILE_SOLID);
    expect(map.cells[12]![15]).toBe(TILE_SOLID);
    expect(map.cells[13]![1]).toBe(TILE_SOLID);
    expect(map.cells[13]![22]).toBe(TILE_SOLID);
  });
});
