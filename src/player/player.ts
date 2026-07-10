import { PLAYER, WORLD } from '../config/constants';
import { createAabbBody, type AabbBody } from '../world/aabbBody';
import { resolveAabbAgainstTiles } from '../world/tileResolve';
import type { TileMap } from '../world/tileMap';
import {
  applyBoostInput,
  createBoostState,
  resetBoostOnLand,
  type BoostState,
} from './boostPhysics';
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

/** Default spawn above the left floor shoulder of the test arena. */
export const PLAYER_SPAWN = { x: 100, y: 200 } as const;

/**
 * Per-frame keyboard state. Phaser only fills this; all physics lives here.
 * `jump` / `duck` / `boost` are key-held flags (↑ / ↓ / Ctrl).
 */
export type PlayerInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  /** Boost / hyper-jump key (Ctrl). */
  boost: boolean;
};

/**
 * Controllable player: walk + gravity + variable jump + double-jump + charged
 * hyper-jump + duck + AABB resolve.
 * Plain module — Phaser only owns the visual and keyboard → {@link input}.
 */
export class Player {
  readonly body: AabbBody;
  readonly jumpState: JumpState;
  readonly boostState: BoostState;

  /** True while the duck hitbox is active (after the last duck tick). */
  ducking = false;

  /** Set by the scene each render frame from keyboard state. */
  input: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
  };

  constructor(
    x: number = PLAYER_SPAWN.x,
    y: number = PLAYER_SPAWN.y,
    w: number = PLAYER.boxW,
    h: number = PLAYER.boxH,
  ) {
    this.body = createAabbBody(x, y, w, h);
    this.jumpState = createJumpState();
    this.boostState = createBoostState();
  }

  /** Teleport and clear velocity / jump / boost / duck (scene reset). */
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
    Object.assign(this.boostState, createBoostState());
  }

  /**
   * One sim tick — order matches `heroAction`:
   * duck hitbox → walk → airborne mark → boost → jump → gravity → AABB
   * resolve → land / ceiling jump flags.
   */
  step(map: TileMap, timeStep: number): void {
    this.ducking = applyDuckHitbox(
      this.body,
      this.input.duck,
      this.ducking,
      this.body.onGround,
    );

    this.body.vx = applyHorizontalWalk(this.body.vx, {
      left: this.input.left,
      right: this.input.right,
      duck: this.ducking,
      // Original friction gate uses the airborne flag, not the jump key.
      jump: this.jumpState.jump,
    });

    markAirborneIfMoving(this.jumpState, this.body.vy);

    this.body.vy = applyBoostInput(
      this.body.vy,
      this.boostState,
      this.jumpState,
      { boost: this.input.boost },
    );

    this.body.vy = applyJumpInput(this.body.vy, this.jumpState, {
      jump: this.input.jump,
      duck: this.ducking,
    });

    // Gravity after jump (original: clamp → yspeed++). Terminal clamp lives
    // in the resolver so tunneling stays impossible.
    this.body.vy += WORLD.gravity;

    resolveAabbAgainstTiles(map, this.body, timeStep);

    if (this.body.onGround) {
      resetJumpOnLand(this.jumpState);
      resetBoostOnLand(this.boostState);
    } else if (this.body.onCeiling) {
      cancelJumpOnCeiling(this.jumpState);
    }
  }
}
