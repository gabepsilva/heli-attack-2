import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/constants';
import { DEBUG_BOX_SIZE, DebugBox } from './debugBox';
import { createTestArena } from './testArena';

describe('DebugBox', () => {
  it('defaults to a 40×40 box', () => {
    const box = new DebugBox(100, 50);
    expect(box.body.w).toBe(DEBUG_BOX_SIZE);
    expect(box.body.h).toBe(DEBUG_BOX_SIZE);
    expect(DEBUG_BOX_SIZE).toBe(40);
  });

  it('falls under WORLD.gravity and rests on the arena floor', () => {
    const map = createTestArena();
    // Left floor shoulder (cols 1–6 solid at row 12).
    const box = new DebugBox(100, 200);

    for (let i = 0; i < 60; i += 1) {
      box.step(map, 1);
    }

    expect(box.body.onGround).toBe(true);
    expect(box.body.vy).toBe(0);
    expect(box.body.y + box.body.h).toBe(12 * WORLD.tile - 1);
  });

  it('does not simulate while dragging', () => {
    const map = createTestArena();
    const box = new DebugBox(100, 200);
    box.dragging = true;
    const yBefore = box.body.y;

    box.step(map, 1);
    box.step(map, 1);

    expect(box.body.y).toBe(yBefore);
    expect(box.body.vy).toBe(0);
  });

  it('placeAt clears velocity for a clean drop', () => {
    const box = new DebugBox(0, 0);
    box.body.vx = 9;
    box.body.vy = 9;
    box.placeAt(200, 100);

    expect(box.body.x).toBe(200);
    expect(box.body.y).toBe(100);
    expect(box.body.vx).toBe(0);
    expect(box.body.vy).toBe(0);
    expect(box.body.onGround).toBe(false);
  });
});
