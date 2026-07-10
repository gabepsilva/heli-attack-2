import { FixedTimestepAccumulator } from './fixedTimestep';
import { TimeScale } from './timeScale';
import {
  createBulletTimeState,
  refillBulletTimeOnKill,
  stepBulletTime,
  type BulletTimeState,
} from './bulletTime';
import { BulletPool, arenaCullBounds, type CullBounds } from '../combat/bullet';
import {
  EnemyBulletPool,
  enemyBulletArenaCullBounds,
  stepEnemyBulletsVsPlayer,
} from '../combat/enemyBullet';
import {
  createHeliExplosion,
  createSpawnRng,
  spawnHelicopter,
  stepBulletsVsHelis,
  stepHeliCombat,
  stepHeliExplosion,
  stepHelicopter,
  type HeliExplosion,
  type Helicopter,
} from '../combat/helicopter';
import {
  createHeliSpawnState,
  ensureHeliPopulation,
  recordHeliKill,
  stepDifficultyFromScore,
  type HeliSpawnState,
} from '../combat/heliSpawn';
import {
  createPlayerHealth,
  stepPlayerIFrames,
  syncPlayerLastHealth,
  type PlayerHealthState,
} from '../combat/playerHealth';
import {
  collectPowerups,
  createPlayerPowerupState,
  createPowerupDropState,
  stepPowerups,
  trySpawnDropOnKill,
  type PlayerPowerupState,
  type PowerupDropState,
  type PowerupPickup,
} from '../combat/powerupDrop';
import {
  playerTimeStepForPowerup,
  stepPlayerPowerup,
  syncPredatorWeapon,
  weaponDamageMultiplier,
} from '../combat/powerupEffects';
import {
  addDamageScore,
  createScoreState,
  type ScoreState,
} from '../combat/score';
import { planWeaponFire } from '../combat/gunFire';
import { stepWeaponFire, type WeaponState } from '../combat/weapon';
import {
  createWeaponInventory,
  fallbackIfActiveEmpty,
  getActiveWeapon,
  getActiveWeaponDef,
  type WeaponInventory,
} from '../combat/weaponInventory';
import { PLAYER_SPAWN, Player } from '../player/player';
import { BULLET, HELI, POWERUP } from '../config/constants';
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
 * counters, original level map, player, bullet pool, weapon inventory (#14),
 * helicopter combat (#12/#13), enemy return fire + player health (#18),
 * replacement spawn treadmill + difficulty ramp (#19), parachuting powerup
 * drops (#21), timed state powerup effects (#22), manual bullet-time meter
 * (#42), and the debug box.
 * Lives outside Phaser so scene restarts and the update loop are
 * unit-testable (Phaser reuses the scene instance; only create() re-runs).
 *
 * The debug overlay (#8) is a DOM panel outside Phaser so it can host real
 * `<input>` controls for live physics tuning and toggle off for clean demos.
 */
export class SimSession {
  readonly accumulator = new FixedTimestepAccumulator();
  readonly timeScale = new TimeScale();

  /** Manual slow-mo meter (Flash `player.bullettime`) — HUD (#23) reads this. */
  bulletTime: BulletTimeState = createBulletTimeState();

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

  /** Enemy projectile pool (#18) — heli return fire. */
  readonly enemyBullets = new EnemyBulletPool();

  /** Arena cull region for bullet off-screen recycle (Flash ±1 tile). */
  readonly bulletCullBounds: CullBounds = arenaCullBounds(
    LEVEL1_WIDTH_PX,
    LEVEL1_HEIGHT_PX,
  );

  /** Cull region for enemy bullets (same arena expansion). */
  readonly enemyBulletCullBounds: CullBounds = enemyBulletArenaCullBounds(
    LEVEL1_WIDTH_PX,
    LEVEL1_HEIGHT_PX,
  );

  /** Draggable/droppable AABB that collides with {@link map}. */
  readonly debugBox = new DebugBox(DEBUG_BOX_SPAWN.x, DEBUG_BOX_SPAWN.y);

  /** Spawn RNG — fixed seed so tests and demos are reproducible. */
  readonly spawnRng = createSpawnRng(12);

  /** Kill count / level / nextLevelScore for the spawn treadmill (#19). */
  heliSpawn: HeliSpawnState = createHeliSpawnState();

  /** Active helicopter enemies in arena space (#12/#19). */
  helicopters: Helicopter[] = [
    spawnHelicopter(HELI.hp, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX, this.spawnRng),
  ];

  /** Short-lived placeholder explosions after heli kills (#12/#13). */
  explosions: HeliExplosion[] = [];

  /** Damage-dealt score (Flash `score += damage`) (#13). */
  score: ScoreState = createScoreState();

  /** Player vitals — health, i-frames, death (#18). */
  playerHealth: PlayerHealthState = createPlayerHealth();

  /** Kill-drop threshold tracker (Flash `nextHealth`) (#21). */
  powerupDrop: PowerupDropState = createPowerupDropState();

  /** Active parachuting crates (#21). */
  powerups: PowerupPickup[] = [];

  /** Timed state powerup slot — effects (#22). */
  playerPowerup: PlayerPowerupState = createPlayerPowerupState();

  /**
   * PredatorMode flicker counter (Flash `pred++`). Scene reads it for alpha.
   */
  predatorFlicker = 0;

  /**
   * Held-fire intent (Flash `mouseD`): scene sets from pointer.isDown each
   * render frame; sim ticks read it and stream at the active weapon's reload.
   */
  fireHeld = false;

  /**
   * Bullet-time key held (Flash `Key.isDown(bulletTimeKey)` / Shift).
   * Scene sets each render frame; sim ticks ease `timeScale` from it.
   */
  bulletTimeHeld = false;

  /**
   * Full arsenal inventory (#14) — test-grants pickup ammo so number-key /
   * next-prev switching is playable before drops (#21).
   */
  inventory: WeaponInventory = createWeaponInventory({ testGrant: true });

  /** Active gun slot — Flash `this.guns[this.cgun]`. */
  get weapon(): WeaponState {
    return getActiveWeapon(this.inventory);
  }

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
    this.enemyBullets.reset();
    this.fireHeld = false;
    this.bulletTimeHeld = false;
    this.bulletTime = createBulletTimeState();
    this.inventory = createWeaponInventory({ testGrant: true });
    this.heliSpawn = createHeliSpawnState();
    this.helicopters = [];
    ensureHeliPopulation(
      this.helicopters,
      this.heliSpawn,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      this.spawnRng,
    );
    this.explosions = [];
    this.score = createScoreState();
    this.playerHealth = createPlayerHealth();
    this.powerupDrop = createPowerupDropState();
    this.powerups = [];
    this.playerPowerup = createPlayerPowerupState();
    this.predatorFlicker = 0;
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
   * Spawn pooled projectile(s) for the active weapon from the current muzzle
   * (#15 ballistic patterns: akimbo twin-stream, shotgun spreads, etc.).
   * Returns false only when the first acquire fails (pool exhausted — capacity
   * never grows). Partial multi-pellet spawns still return true.
   */
  tryFire(): boolean {
    const { muzzle, gunAim } = this.player;
    const weapon = this.weapon;
    const def = getActiveWeaponDef(this.inventory);
    const damageMult = weaponDamageMultiplier(this.playerPowerup.powerupOn);
    const spawns = planWeaponFire(
      weapon.type,
      muzzle.x,
      muzzle.y,
      gunAim.rotationDeg,
      def,
    );
    if (spawns.length === 0) {
      return false;
    }
    let any = false;
    for (const spawn of spawns) {
      const bullet = this.bullets.acquire(
        spawn.x,
        spawn.y,
        spawn.rotationDeg,
        spawn.speed,
        spawn.damage * damageMult,
        spawn.maxLifetime ?? BULLET.maxLifetimeFrames,
        spawn.behavior,
      );
      if (bullet !== null) {
        any = true;
      }
    }
    return any;
  }

  private simTick(): void {
    this.simTickCount += 1;
    this.ticksThisSecond += 1;

    // Ease global timeStep before any entity motion (Flash sendGameSpeed).
    const nextStep = stepBulletTime(this.bulletTime, this.timeScale.timeStep, {
      keyHeld: this.bulletTimeHeld,
      timeRiftActive: this.playerPowerup.powerupOn === POWERUP.TimeRift,
      gameOver: !this.playerHealth.alive,
    });
    this.timeScale.setTimeStep(nextStep);

    // PredatorMode weapon lock while active (#22). Expiry restore runs after
    // the timer tick at the end of this frame.
    const powerupAtStart = this.playerPowerup.powerupOn;
    syncPredatorWeapon(this.inventory, powerupAtStart);
    if (powerupAtStart === POWERUP.PredatorMode) {
      this.predatorFlicker += 1;
    }

    // Dead players stop moving / firing; helis still update so the scene reads.
    // TimeRift: player steps at full speed while the world stays slowed (#22).
    // Manual bullet-time slows the player with the world (no TimeRift override).
    if (this.playerHealth.alive) {
      const playerStep = playerTimeStepForPowerup(
        this.timeScale.timeStep,
        this.playerPowerup.powerupOn,
      );
      this.player.step(this.map, playerStep, this.playerPowerup.powerupOn);
      const def = getActiveWeaponDef(this.inventory);
      if (stepWeaponFire(this.weapon, this.fireHeld, def)) {
        this.tryFire();
        fallbackIfActiveEmpty(this.inventory);
      }
    }

    stepPlayerIFrames(this.playerHealth, this.timeScale.timeStep);

    const playerBody = this.player.body;
    const playerCenterX = playerBody.x + playerBody.w / 2;
    const playerCenterY = playerBody.y + playerBody.h / 2;
    const predatorMode = this.playerPowerup.powerupOn === POWERUP.PredatorMode;

    for (let i = 0; i < this.helicopters.length; i += 1) {
      const heli = this.helicopters[i]!;
      const moved = stepHelicopter(
        heli,
        this.timeScale.timeStep,
        playerCenterX,
        playerBody.y,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        this.spawnRng,
      );
      if (this.playerHealth.alive) {
        stepHeliCombat(
          heli,
          this.timeScale.timeStep,
          playerCenterX,
          playerCenterY,
          this.enemyBullets,
          this.spawnRng,
          moved,
          this.heliSpawn.level,
          predatorMode,
        );
      }
    }

    let killsThisTick = 0;
    stepBulletsVsHelis(
      this.bullets,
      this.helicopters,
      this.bulletCullBounds,
      this.timeScale.timeStep,
      (event) => {
        addDamageScore(this.score, event.damage);
        if (event.killed) {
          this.explosions.push(createHeliExplosion(event.heli.x, event.heli.y));
          // State only — never splice/push helis here. Rail + A-Bomb keep
          // iterating the same array after a kill (#19 Lead review).
          recordHeliKill(this.heliSpawn, this.score.value);
          refillBulletTimeOnKill(this.bulletTime);
          trySpawnDropOnKill(
            this.heliSpawn.kills,
            this.powerupDrop,
            this.powerups,
            event.heli.x,
            event.heli.y,
            this.spawnRng,
          );
          killsThisTick += 1;
        }
      },
      this.map,
      playerBody,
    );

    if (killsThisTick > 0) {
      ensureHeliPopulation(
        this.helicopters,
        this.heliSpawn,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        this.spawnRng,
      );
    }

    // Flash checks `score > nextLevel` every frame (not only on kill).
    stepDifficultyFromScore(this.heliSpawn, this.score.value);

    stepEnemyBulletsVsPlayer(
      this.enemyBullets,
      playerBody,
      this.playerHealth,
      this.enemyBulletCullBounds,
      this.timeScale.timeStep,
      this.map,
      undefined,
      this.playerPowerup.powerupOn,
    );
    syncPlayerLastHealth(this.playerHealth);

    stepPowerups(this.powerups, this.map, this.timeScale.timeStep);
    if (this.playerHealth.alive) {
      collectPowerups(
        this.powerups,
        playerBody,
        this.playerHealth,
        this.inventory,
        this.playerPowerup,
        this.spawnRng,
      );
    }

    // Flash `powerupTime--` at end of heroAction move frame; clear on 0 (#22).
    // Skip the tick on the collection frame so a fresh pickup gets a full
    // POWERUP_FRAMES of effect.
    if (powerupAtStart !== 0) {
      const powerupTick = stepPlayerPowerup(this.playerPowerup);
      if (powerupTick.expired !== 0) {
        syncPredatorWeapon(
          this.inventory,
          this.playerPowerup.powerupOn,
          powerupTick.expired,
        );
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i -= 1) {
      if (stepHeliExplosion(this.explosions[i]!, this.timeScale.timeStep)) {
        this.explosions.splice(i, 1);
      }
    }
    this.debugBox.step(this.map, this.timeScale.timeStep);
  }
}
