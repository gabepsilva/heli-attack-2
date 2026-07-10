import {
  createGunAimState,
  updateGunAim,
  type GunAimState,
  type Vec2,
} from '../combat/gunAim';
import { GUN, PLAYER, WORLD } from '../config/constants';
import { createAabbBody, type AabbBody } from '../world/aabbBody';
import { resolveAabbAgainstTiles } from '../world/tileResolve';
import type { TileMap } from '../world/tileMap';
import { LEVEL1_PLAYER_SPAWN } from '../world/level1';
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

/** Default spawn on the original level (see {@link LEVEL1_PLAYER_SPAWN}). */
export const PLAYER_SPAWN = LEVEL1_PLAYER_SPAWN;

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
 * hyper-jump + duck + AABB resolve + mouse gun aim.
 * Plain module — Phaser only owns the visual and keyboard/mouse → {@link input}.
 */
export class Player {
  readonly body: AabbBody;
  readonly jumpState: JumpState;
  readonly boostState: BoostState;

  /** True while the duck hitbox is active (after the last duck tick). */
  ducking = false;

  /** Live gun pose (rotation + facing flip). Updated each sim tick. */
  gunAim: GunAimState = createGunAimState();

  /** Last computed muzzle tip in arena/world space (for #10 bullets). */
  muzzle: Vec2 = { x: 0, y: 0 };

  /** Last gun grip/pivot in arena/world space. */
  gunPivot: Vec2 = { x: 0, y: 0 };

  /** Set by the scene each render frame from keyboard state. */
  input: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
  };

  /**
   * Mouse position in arena/world space (same coords as {@link body}).
   * Scene converts pointer → arena each frame.
   */
  mouse: Vec2 = { x: PLAYER_SPAWN.x + 100, y: PLAYER_SPAWN.y };

  constructor(
    x: number = PLAYER_SPAWN.x,
    y: number = PLAYER_SPAWN.y,
    w: number = PLAYER.boxW,
    h: number = PLAYER.boxH,
  ) {
    this.body = createAabbBody(x, y, w, h);
    this.jumpState = createJumpState();
    this.boostState = createBoostState();
    this.mouse = { x: x + GUN.attachX + 100, y: y + GUN.attachY };
    this.syncGunPose(0);
  }

  /** Teleport and clear velocity / jump / boost / duck / aim (scene reset). */
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
    this.gunAim = createGunAimState();
    // Default mouse to the right of the grip so aim starts at 0° (no turn).
    this.mouse = { x: x + GUN.attachX + 100, y: y + GUN.attachY };
    this.syncGunPose(0);
  }

  /**
   * One sim tick — order matches `heroAction`:
   * duck hitbox → walk → airborne mark → boost → jump → gravity → AABB
   * resolve → land / ceiling jump flags → gun aim.
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

    this.body.vy = applyBoostInput(
      this.body.vy,
      this.boostState,
      this.jumpState,
      { boost: this.input.boost },
    );

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
      resetBoostOnLand(this.boostState);
    } else if (this.body.onCeiling) {
      cancelJumpOnCeiling(this.jumpState);
    }

    this.syncGunPose(timeStep);
  }

  private syncGunPose(timeStep: number): void {
    const result = updateGunAim(this.gunAim, this.body, this.mouse, timeStep);
    this.gunAim = result.state;
    this.gunPivot = result.pivot;
    this.muzzle = result.muzzle;
  }
}
