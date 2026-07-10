import { PLAYER, WORLD } from '../config/constants';
import { createAabbBody, type AabbBody } from '../world/aabbBody';
import { resolveAabbAgainstTiles } from '../world/tileResolve';
import type { TileMap } from '../world/tileMap';
import { LEVEL1_PLAYER_SPAWN } from '../world/level1';
import { applyDuckHitbox } from './duckPhysics';
import {
  applyJumpInput,
  cancelJumpOnCeiling,
  createJumpState,
  markAirborneIfMoving,
  resetJumpOnLand,
  type JumpState,
} from './jumpPhysics';
import { applyHorizontalWalk } from './walkPhysics';

/** Default spawn on the original level (see {@link LEVEL1_PLAYER_SPAWN}). */
export const PLAYER_SPAWN = LEVEL1_PLAYER_SPAWN;

/**
 * Per-frame keyboard state. Phaser only fills this; all physics lives here.
 * `jump` / `duck` are key-held flags (↑ / ↓), not the airborne jump state.
 */
export type PlayerInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
};

/**
 * Controllable player: walk + gravity + variable jump + duck + AABB resolve.
 * Plain module — Phaser only owns the visual and keyboard → {@link input}.
 */
export class Player {
  readonly body: AabbBody;
  readonly jumpState: JumpState;

  /** True while the duck hitbox is active (after the last duck tick). */
  ducking = false;

  /** Set by the scene each render frame from keyboard state. */
  input: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    duck: false,
  };

  constructor(
    x: number = PLAYER_SPAWN.x,
    y: number = PLAYER_SPAWN.y,
    w: number = PLAYER.boxW,
    h: number = PLAYER.boxH,
  ) {
    this.body = createAabbBody(x, y, w, h);
    this.jumpState = createJumpState();
  }

  /** Teleport and clear velocity / jump / duck (scene reset). */
  placeAt(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.w = PLAYER.boxW;
    this.body.h = PLAYER.boxH;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.onGround = false;
    this.body.onCeiling = false;
    this.ducking = false;
    Object.assign(this.jumpState, createJumpState());
  }

  /**
   * One sim tick — duck hitbox → walk → airborne mark → jump → gravity →
   * AABB resolve → land / ceiling jump flags. Close to `heroAction`; friction
   * reads jump one frame earlier than the original (negligible).
   */
  step(map: TileMap, timeStep: number): void {
    this.ducking = applyDuckHitbox(this.body, this.input.duck, this.ducking);

    this.body.vx = applyHorizontalWalk(this.body.vx, {
      left: this.input.left,
      right: this.input.right,
      duck: this.input.duck,
      // Original friction gate uses the airborne flag, not the jump key.
      jump: this.jumpState.jump,
    });

    markAirborneIfMoving(this.jumpState, this.body.vy);

    this.body.vy = applyJumpInput(this.body.vy, this.jumpState, {
      jump: this.input.jump,
      duck: this.input.duck,
    });

    // Gravity after jump (original: clamp → yspeed++). Terminal clamp lives
    // in the resolver so tunneling stays impossible.
    this.body.vy += WORLD.gravity;

    resolveAabbAgainstTiles(map, this.body, timeStep);

    if (this.body.onGround) {
      resetJumpOnLand(this.jumpState);
    } else if (this.body.onCeiling) {
      cancelJumpOnCeiling(this.jumpState);
    }
  }
}
