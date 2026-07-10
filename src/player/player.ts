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
import { applyHorizontalWalk, type WalkInput } from './walkPhysics';

/** Default spawn above the left floor shoulder of the test arena. */
export const PLAYER_SPAWN = { x: 100, y: 200 } as const;

/**
 * Controllable player: walk + gravity + AABB resolve + mouse gun aim.
 * Plain module — Phaser only owns the visual and keyboard/mouse → {@link input}.
 */
export class Player {
  readonly body: AabbBody;

  /** Live gun pose (rotation + facing flip). Updated each sim tick. */
  gunAim: GunAimState = createGunAimState();

  /** Last computed muzzle tip in arena/world space (for #10 bullets). */
  muzzle: Vec2 = { x: 0, y: 0 };

  /** Last gun grip/pivot in arena/world space. */
  gunPivot: Vec2 = { x: 0, y: 0 };

  /** Set by the scene each render frame from keyboard state. */
  input: WalkInput = { left: false, right: false };

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
    this.mouse = { x: x + GUN.attachX + 100, y: y + GUN.attachY };
    this.syncGunPose(0);
  }

  /** Teleport and clear velocity / aim (scene reset). */
  placeAt(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.onGround = false;
    this.gunAim = createGunAimState();
    // Default mouse to the right of the grip so aim starts at 0° (no turn).
    this.mouse = { x: x + GUN.attachX + 100, y: y + GUN.attachY };
    this.syncGunPose(0);
  }

  /**
   * One sim tick: horizontal walk → gravity → AABB resolve → gun aim.
   * Displacement is scaled by `timeStep` inside the resolver (HA2 `* timeStep`).
   */
  step(map: TileMap, timeStep: number): void {
    this.body.vx = applyHorizontalWalk(this.body.vx, this.input);
    this.body.vy += WORLD.gravity;
    resolveAabbAgainstTiles(map, this.body, timeStep);
    this.syncGunPose(timeStep);
  }

  private syncGunPose(timeStep: number): void {
    const result = updateGunAim(this.gunAim, this.body, this.mouse, timeStep);
    this.gunAim = result.state;
    this.gunPivot = result.pivot;
    this.muzzle = result.muzzle;
  }
}
