import { PLAYER, WORLD } from '../config/constants';
import { createAabbBody, type AabbBody } from '../world/aabbBody';
import { resolveAabbAgainstTiles } from '../world/tileResolve';
import type { TileMap } from '../world/tileMap';
import { LEVEL1_PLAYER_SPAWN } from '../world/level1';
import { applyHorizontalWalk, type WalkInput } from './walkPhysics';

/** Default spawn on the original level (see {@link LEVEL1_PLAYER_SPAWN}). */
export const PLAYER_SPAWN = LEVEL1_PLAYER_SPAWN;

/**
 * Controllable player: walk accel/cap/friction + gravity + AABB tile resolve.
 * Plain module — Phaser only owns the visual and keyboard → {@link input}.
 */
export class Player {
  readonly body: AabbBody;

  /** Set by the scene each render frame from keyboard state. */
  input: WalkInput = { left: false, right: false };

  constructor(
    x: number = PLAYER_SPAWN.x,
    y: number = PLAYER_SPAWN.y,
    w: number = PLAYER.boxW,
    h: number = PLAYER.boxH,
  ) {
    this.body = createAabbBody(x, y, w, h);
  }

  /** Teleport and clear velocity (scene reset). */
  placeAt(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.onGround = false;
  }

  /**
   * One sim tick: horizontal walk curve → gravity → AABB tile resolve.
   * Displacement is scaled by `timeStep` inside the resolver (HA2 `* timeStep`).
   */
  step(map: TileMap, timeStep: number): void {
    this.body.vx = applyHorizontalWalk(this.body.vx, this.input);
    this.body.vy += WORLD.gravity;
    resolveAabbAgainstTiles(map, this.body, timeStep);
  }
}
