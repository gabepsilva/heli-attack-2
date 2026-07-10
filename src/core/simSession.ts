import { FixedTimestepAccumulator } from './fixedTimestep';
import { TimeScale } from './timeScale';
import { BulletPool, arenaCullBounds, type CullBounds } from '../combat/bullet';
import { PLAYER_SPAWN, Player } from '../player/player';
import { DebugBox } from '../world/debugBox';
import {
  LEVEL1_HEIGHT_PX,
  LEVEL1_WIDTH_PX,
  createLevel1,
} from '../world/level1';
import type { TileMap } from '../world/tileMap';

/** Spawn point above open ground near the left side of level 1. */
export const DEBUG_BOX_SPAWN = { x: 200, y: 200 } as const;

/**
 * Per-run sim state for GameScene: fixed-step accumulator, timeStep, HUD
 * counters, original level map, player, bullet pool, and the debug box. Lives
 * outside Phaser so scene restarts and the update loop are unit-testable
 * (Phaser reuses the scene instance; only create() re-runs).
 */
export class SimSession {
  readonly accumulator = new FixedTimestepAccumulator();
  readonly timeScale = new TimeScale();

  simTickCount = 0;
  ticksThisSecond = 0;
  secondTimerMs = 0;
  displayedSimRate = 0;

  /** Original HA2 playfield — rebuilt on reset so callers always see a fresh map. */
  map: TileMap = createLevel1();

  /** Controllable player (walk accel/cap/friction + gravity + tile resolve). */
  readonly player = new Player(PLAYER_SPAWN.x, PLAYER_SPAWN.y);

  /** Fixed-capacity projectile pool (#10) — never grows after construction. */
  readonly bullets = new BulletPool();

  /** Arena cull region for bullet off-screen recycle (Flash ±1 tile). */
  readonly bulletCullBounds: CullBounds = arenaCullBounds(
    LEVEL1_WIDTH_PX,
    LEVEL1_HEIGHT_PX,
  );

  /** Draggable/droppable AABB that collides with {@link map}. */
  readonly debugBox = new DebugBox(DEBUG_BOX_SPAWN.x, DEBUG_BOX_SPAWN.y);

  /**
   * Click-to-fire latch: scene sets true on pointer down; consumed once per
   * sim tick so a single click cannot multi-fire within one accumulator burst.
   * Full MachineGun reload cadence is #11.
   */
  fireRequested = false;

  /** Clear all per-run state — call from GameScene.create() on every start. */
  reset(): void {
    this.accumulator.reset();
    this.timeScale.reset();
    this.simTickCount = 0;
    this.ticksThisSecond = 0;
    this.secondTimerMs = 0;
    this.displayedSimRate = 0;
    this.map = createLevel1();
    this.player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    this.player.placeAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    this.bullets.reset();
    this.fireRequested = false;
    this.debugBox.dragging = false;
    this.debugBox.placeAt(DEBUG_BOX_SPAWN.x, DEBUG_BOX_SPAWN.y);
  }

  /**
   * Drive one render frame. `deltaMs` is Phaser's update delta (milliseconds);
   * converted to seconds for the accumulator. Non-finite / negative deltas are
   * ignored so neither the bank nor the HUD rate timer can be poisoned.
   */
  update(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      return;
    }

    const steps = this.accumulator.advance(deltaMs / 1000);

    for (let i = 0; i < steps; i += 1) {
      this.simTick();
    }

    this.secondTimerMs += deltaMs;
    if (this.secondTimerMs >= 1000) {
      this.displayedSimRate =
        this.ticksThisSecond / (this.secondTimerMs / 1000);
      this.ticksThisSecond = 0;
      this.secondTimerMs = 0;
    }
  }

  /**
   * Spawn one pooled bullet from the current muzzle along the gun aim.
   * Returns false if the pool is exhausted (capacity never grows).
   */
  tryFire(): boolean {
    const { muzzle, gunAim } = this.player;
    return (
      this.bullets.acquire(muzzle.x, muzzle.y, gunAim.rotationDeg) !== null
    );
  }

  private simTick(): void {
    this.simTickCount += 1;
    this.ticksThisSecond += 1;
    this.player.step(this.map, this.timeScale.timeStep);
    if (this.fireRequested) {
      this.fireRequested = false;
      this.tryFire();
    }
    this.bullets.stepAll(this.timeScale.timeStep, this.bulletCullBounds);
    this.debugBox.step(this.map, this.timeScale.timeStep);
  }
}
