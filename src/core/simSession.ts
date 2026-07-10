import { FixedTimestepAccumulator } from './fixedTimestep';
import { TimeScale } from './timeScale';
import { BulletPool, arenaCullBounds, type CullBounds } from '../combat/bullet';
import {
  createHeliExplosion,
  createSpawnRng,
  spawnHelicopter,
  stepBulletsVsHelis,
  stepHeliExplosion,
  stepHelicopter,
  type HeliExplosion,
  type Helicopter,
} from '../combat/helicopter';
import {
  addDamageScore,
  createScoreState,
  type ScoreState,
} from '../combat/score';
import {
  createMachineGunState,
  stepWeaponFire,
  type WeaponState,
} from '../combat/weapon';
import { PLAYER_SPAWN, Player } from '../player/player';
import { HELI } from '../config/constants';
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
 * counters, original level map, player, bullet pool, MachineGun reload,
 * helicopter combat (#12/#13), and the debug box. Lives outside Phaser so
 * scene restarts and the update loop are unit-testable (Phaser reuses the
 * scene instance; only create() re-runs).
 *
 * The debug overlay (#8) is a DOM panel outside Phaser so it can host real
 * `<input>` controls for live physics tuning and toggle off for clean demos.
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

  /** Active helicopter enemies in arena space (#12). */
  helicopters: Helicopter[] = [
    spawnHelicopter(
      HELI.hp,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      createSpawnRng(12),
    ),
  ];

  /** Short-lived placeholder explosions after heli kills (#12/#13). */
  explosions: HeliExplosion[] = [];

  /** Damage-dealt score (Flash `score += damage`) (#13). */
  score: ScoreState = createScoreState();

  /** Spawn RNG — fixed seed so tests and demos are reproducible. */
  readonly spawnRng = createSpawnRng(12);

  /**
   * Held-fire intent (Flash `mouseD`): scene sets from pointer.isDown each
   * render frame; sim ticks read it and stream at MachineGun reload cadence.
   */
  fireHeld = false;

  /** Starting MachineGun slot — reload counter + infinite ammo (#11). */
  weapon: WeaponState = createMachineGunState();

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
    this.fireHeld = false;
    this.weapon = createMachineGunState();
    this.helicopters = [
      spawnHelicopter(
        HELI.hp,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        this.spawnRng,
      ),
    ];
    this.explosions = [];
    this.score = createScoreState();
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
    // Flash: reload++ every move frame; fire when held && reloadtime >= reload.
    if (stepWeaponFire(this.weapon, this.fireHeld)) {
      this.tryFire();
    }
    const playerBody = this.player.body;
    for (let i = 0; i < this.helicopters.length; i += 1) {
      stepHelicopter(
        this.helicopters[i]!,
        this.timeScale.timeStep,
        playerBody.x + playerBody.w / 2,
        playerBody.y,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
      );
    }
    stepBulletsVsHelis(
      this.bullets,
      this.helicopters,
      this.bulletCullBounds,
      this.timeScale.timeStep,
      (event) => {
        addDamageScore(this.score, event.damage);
        if (event.killed) {
          this.explosions.push(createHeliExplosion(event.heli.x, event.heli.y));
        }
      },
    );
    for (let i = this.explosions.length - 1; i >= 0; i -= 1) {
      if (stepHeliExplosion(this.explosions[i]!, this.timeScale.timeStep)) {
        this.explosions.splice(i, 1);
      }
    }
    this.debugBox.step(this.map, this.timeScale.timeStep);
  }
}
