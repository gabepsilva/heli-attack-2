import {
  createGunAimState,
  updateGunAim,
  type GunAimState,
  type Vec2,
} from '../combat/gunAim';
import { DEFAULT_HELD_GUN, type HeldGun } from '../combat/heldGun';
import { applyJetpackThrust, isJetpackActive } from '../combat/powerupEffects';
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
import {
  beginParachuteIntro,
  completeParachuteIntro,
  createParachuteIntroState,
  stepParachuteIntro,
  type ParachuteIntroState,
} from './parachuteIntro';
import { applyHorizontalWalk } from './walkPhysics';

/** Default spawn on the original level (see {@link LEVEL1_PLAYER_SPAWN}). */
export const PLAYER_SPAWN = LEVEL1_PLAYER_SPAWN;

/**
 * Per-frame movement intent. Filled from the player intent layer (#29);
 * all physics lives here. `jump` / `duck` / `boost` are held flags (↑ / ↓ / Ctrl).
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
 * Controllable player: spawn parachute (`heroStart`) + walk + gravity +
 * variable jump + double-jump + charged hyper-jump + duck + AABB resolve +
 * mouse gun aim.
 * Plain module — the intent layer owns keyboard/mouse → {@link input} / mouse.
 */
export class Player {
  readonly body: AabbBody;
  readonly jumpState: JumpState;
  readonly boostState: BoostState;

  /** Flash `heroStart` parachute drop — inactive until {@link beginParachute}. */
  readonly parachute: ParachuteIntroState = createParachuteIntroState();

  /** True while the duck hitbox is active (after the last duck tick). */
  ducking = false;

  /** Live gun pose (rotation + facing flip). Updated each sim tick. */
  gunAim: GunAimState = createGunAimState();

  /** Last computed muzzle tip in arena/world space (for #10 bullets). */
  muzzle: Vec2 = { x: 0, y: 0 };

  /** Last gun grip/pivot in arena/world space. */
  gunPivot: Vec2 = { x: 0, y: 0 };

  /** Set each render frame from the player intent layer (#29). */
  input: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
  };

  /**
   * Aim point in arena/world space (same coords as {@link body}).
   * Intent layer converts pointer → arena each frame.
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
    this.syncGunPose(0, DEFAULT_HELD_GUN);
  }

  /**
   * Teleport and clear velocity / jump / boost / duck / aim (scene reset).
   * Deliberately leaves the parachute alone — a teleport is not a mode change.
   * Callers that want a fresh drop follow up with {@link beginParachute}.
   */
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
    this.syncGunPose(0, DEFAULT_HELD_GUN);
  }

  /** Start the Flash `heroStart` parachute drop (run start). */
  beginParachute(): void {
    beginParachuteIntro(this.parachute);
  }

  /** Skip / finish the spawn drop and hand control straight to `heroAction`. */
  endParachute(): void {
    completeParachuteIntro(this.parachute);
  }

  /** True while the spawn parachute owns movement (no walk / fire yet). */
  get parachuting(): boolean {
    return this.parachute.active;
  }

  /**
   * Set true for one {@link step} when a charged hyper-jump fires (SFX #27).
   * Cleared at the start of each step.
   */
  hyperJumpFired = false;

  /**
   * One sim tick — order matches `heroAction`:
   * duck hitbox → walk → airborne mark → boost → jump/jetpack → gravity → AABB
   * resolve → land / ceiling jump flags → gun aim.
   *
   * {@link powerupOn} drives Jetpack (#22): hold jump replaces the normal
   * variable-height jump with `yspeed = max(yspeed-2, -32)`.
   */
  step(
    map: TileMap,
    timeStep: number,
    powerupOn: number = 0,
    heldGun: HeldGun = DEFAULT_HELD_GUN,
  ): void {
    this.hyperJumpFired = false;

    // Flash `heroStart` — chute owns motion until it collapses near ground.
    if (this.parachute.active) {
      stepParachuteIntro(this.parachute, this.body, map, timeStep);
      this.syncGunPose(timeStep, heldGun);
      return;
    }

    this.ducking = applyDuckHitbox(this.body, this.input.duck, this.ducking);

    this.body.vx = applyHorizontalWalk(this.body.vx, {
      left: this.input.left,
      right: this.input.right,
      duck: this.input.duck,
      // Original friction gate uses the airborne flag, not the jump key.
      jump: this.jumpState.jump,
    });

    markAirborneIfMoving(this.jumpState, this.body.vy);

    const boost = applyBoostInput(
      this.body.vy,
      this.boostState,
      this.jumpState,
      { boost: this.input.boost },
    );
    this.body.vy = boost.vy;
    this.hyperJumpFired = boost.fired;

    if (isJetpackActive(powerupOn, this.input.jump)) {
      // Flash: jump = jump2 = hjump = 1; yspeed = max(yspeed-2, -32).
      this.jumpState.jump = true;
      this.jumpState.jump2 = true;
      this.boostState.hjump = true;
      this.body.vy = applyJetpackThrust(this.body.vy);
    } else {
      this.body.vy = applyJumpInput(
        this.body.vy,
        this.jumpState,
        {
          jump: this.input.jump,
          duck: this.input.duck,
        },
        timeStep,
      );
    }

    // Gravity after jump (Flash: clamp → yspeed++). Scale by timeStep so
    // ballistic arcs keep their height under bullet-time (#90); at timeStep
    // 1 this is identical to the original +1/frame. Terminal clamp lives in
    // the resolver so tunneling stays impossible.
    this.body.vy += WORLD.gravity * timeStep;

    resolveAabbAgainstTiles(map, this.body, timeStep);

    if (this.body.onGround) {
      resetJumpOnLand(this.jumpState);
      resetBoostOnLand(this.boostState);
    } else if (this.body.onCeiling) {
      cancelJumpOnCeiling(this.jumpState);
    }

    this.syncGunPose(timeStep, heldGun);
  }

  private syncGunPose(timeStep: number, heldGun: HeldGun): void {
    const result = updateGunAim(
      this.gunAim,
      this.body,
      this.mouse,
      timeStep,
      heldGun,
    );
    this.gunAim = result.state;
    this.gunPivot = result.pivot;
    this.muzzle = result.muzzle;
  }
}
