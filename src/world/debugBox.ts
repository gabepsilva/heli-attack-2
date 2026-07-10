import { WORLD } from '../config/constants';
import { createAabbBody, type AabbBody } from './aabbBody';
import { resolveAabbAgainstTiles } from './tileResolve';
import type { TileMap } from './tileMap';

/** Default debug-box size — visible, larger than the player hitbox. */
export const DEBUG_BOX_SIZE = 40;

/**
 * Draggable / droppable AABB that falls under gravity and resolves against
 * the tile grid. Plain module — Phaser only owns the visual + pointer input.
 */
export class DebugBox {
  readonly body: AabbBody;

  /** When true, sim skips gravity/resolve so the pointer owns position. */
  dragging = false;

  constructor(
    x: number,
    y: number,
    w: number = DEBUG_BOX_SIZE,
    h: number = DEBUG_BOX_SIZE,
  ) {
    this.body = createAabbBody(x, y, w, h);
  }

  /** Teleport and clear velocity (used on drag-drop and scene reset). */
  placeAt(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.onGround = false;
  }

  /**
   * One sim tick: apply gravity (+1 px/frame² like the original), then AABB
   * tile resolve. No-op while dragging.
   */
  step(map: TileMap, timeStep: number): void {
    if (this.dragging) {
      return;
    }
    // Original increments yspeed by gravity once per frame, then scales the
    // resulting displacement by timeStep inside the resolver.
    this.body.vy += WORLD.gravity;
    resolveAabbAgainstTiles(map, this.body, timeStep);
  }
}
