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
  stepBulletsVsHelis,
  stepHeliCombat,
  stepHeliExplosion,
  stepHelicopter,
  type HeliExplosion,
  type Helicopter,
} from '../combat/helicopter';
import {
  createHeliShards,
  spawnHeliDeathEntities,
  stepFallingPilot,
  stepHeliShard,
  stepHeliWreck,
  type FallingPilot,
  type HeliShard,
  type HeliWreck,
} from '../combat/heliDeathFx';
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
  isJetpackActive,
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
import type { GameAudioEvent } from '../audio/eventMap';
import {
  buildBloodFx,
  buildImpactFx,
  buildKillFx,
  buildMuzzleFx,
  buildSmokeFx,
  shouldEmitJetpackSmoke,
} from '../fx/particleEvents';
import { ParticleFxQueue } from '../fx/particleQueue';
import { shouldEmitSmokeTrail } from '../fx/smokeTrail';
import { PLAYER_SPAWN, Player } from '../player/player';
import { HELI_DEATH, POWERUP } from '../config/constants';
import {
  LEVEL1_HEIGHT_PX,
  LEVEL1_WIDTH_PX,
  createLevel1,
} from '../world/level1';
import type { TileMap } from '../world/tileMap';

/**
 * Per-run sim state for GameScene: fixed-step accumulator, timeStep, HUD
 * counters, original level map, player, bullet pool, weapon inventory (#14),
 * helicopter combat (#12/#13), enemy return fire + player health (#18),
 * replacement spawn treadmill + difficulty ramp (#19), parachuting powerup
 * drops (#21), timed state powerup effects (#22), manual bullet-time meter
 * (#42), event-driven SFX cues (#27), pooled particle FX cues (#35), and
 * player-hurt flash cue.
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

  /**
   * SFX cues queued during the last drained window (issue #27).
   * GameScene drains via {@link drainAudioEvents} after each render update.
   */
  private readonly audioEvents: GameAudioEvent[] = [];

  /**
   * Particle FX cues (issue #35). Fixed-capacity ring — GameScene drains via
   * {@link drainParticleFx} after each render update.
   */
  readonly particleFx = new ParticleFxQueue();

  /**
   * Player took damage since the last drain — GameScene triggers a hard
   * 33 ms full-screen flash (not a fade).
   */
  private hurtFlashPending = false;

  /** Jetpack smoke frame counter (Flash `smok++`). */
  private jetpackSmokeCounter = 0;

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

  /** Spawn RNG — fixed seed so tests and demos are reproducible. */
  readonly spawnRng = createSpawnRng(12);

  /** Kill count / level / nextLevelScore for the spawn treadmill (#19). */
  heliSpawn: HeliSpawnState = createHeliSpawnState();

  /** Active helicopter enemies in arena space (#12/#19). */
  helicopters: Helicopter[] = [];

  /** Falling wrecks after kills — Flash `HeliDestroyed` / `heliFall`. */
  heliWrecks: HeliWreck[] = [];

  /** Bouncing scrap — Flash `Shard` / `shardFrame`. */
  heliShards: HeliShard[] = [];

  /** Burned gunner tumble — Flash `GuyBurned` / `guyFall`. */
  fallingPilots: FallingPilot[] = [];

  /** Flash global `sbounce` — gates metal SFX on shard bounces. */
  private shardMetalBounce = { value: 0 };

  /** Short-lived boom sprites after heli kills / wreck ground impacts. */
  explosions: HeliExplosion[] = [];

  /** Damage-dealt score (Flash `score += damage`) (#13). */
  score: ScoreState = createScoreState();

  /**
   * Successful bullet-on-heli first contacts this run (Flash global `hits`) —
   * feeds game-over accuracy (#25). Only the first damage event per projectile
   * counts so DoT / splash / multi-heli beams cannot exceed projectiles fired.
   */
  runHits = 0;

  /**
   * Projectiles successfully acquired this run (#25 accuracy denominator).
   * Counts pellets/beams spawned, not trigger pulls — matches Flash `shots+=N`
   * for multi-projectile weapons.
   */
  runShots = 0;

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
   * Held-fire intent (Flash `mouseD`): filled from the player intent layer
   * each render frame; sim ticks read it and stream at the active weapon's reload.
   */
  fireHeld = false;

  /**
   * Bullet-time held (Flash `Key.isDown(bulletTimeKey)` / Shift).
   * Filled from the player intent layer each render frame; sim ticks ease
   * `timeScale` from it.
   */
  bulletTimeHeld = false;

  /**
   * Run arsenal (#14 / #92) — MachineGun only at start; other slots unlock
   * when weapon crates grant ammo. `testGrant` stays out of normal play.
   */
  inventory: WeaponInventory = createWeaponInventory();

  /** Active gun slot — Flash `this.guns[this.cgun]`. */
  get weapon(): WeaponState {
    return getActiveWeapon(this.inventory);
  }

  constructor() {
    // A fresh session and a reset session must be indistinguishable — deriving
    // one from the other is what keeps them from drifting apart.
    this.reset();
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
    this.player.beginParachute();
    this.bullets.reset();
    this.enemyBullets.reset();
    this.fireHeld = false;
    this.bulletTimeHeld = false;
    this.bulletTime = createBulletTimeState();
    this.inventory = createWeaponInventory();
    this.heliSpawn = createHeliSpawnState();
    // Flash waits for `heroStart` chute collapse before `addEnemy(300)`.
    this.helicopters = [];
    this.heliWrecks = [];
    this.heliShards = [];
    this.fallingPilots = [];
    this.shardMetalBounce.value = 0;
    this.explosions = [];
    this.score = createScoreState();
    this.runHits = 0;
    this.runShots = 0;
    this.playerHealth = createPlayerHealth();
    this.powerupDrop = createPowerupDropState();
    this.powerups = [];
    this.playerPowerup = createPlayerPowerupState();
    this.predatorFlicker = 0;
    this.audioEvents.length = 0;
    this.particleFx.reset();
    this.hurtFlashPending = false;
    this.jetpackSmokeCounter = 0;
  }

  /**
   * Take ownership of every SFX cue queued since the last drain (issue #27).
   * Call once per render frame after {@link update}.
   */
  drainAudioEvents(): GameAudioEvent[] {
    if (this.audioEvents.length === 0) {
      return [];
    }
    return this.audioEvents.splice(0, this.audioEvents.length);
  }

  /**
   * Take ownership of every particle FX cue queued since the last drain
   * (issue #35). Call once per render frame after {@link update}.
   */
  drainParticleFx() {
    return this.particleFx.drain();
  }

  /**
   * True when the player took damage since the last drain. Call once per
   * render frame after {@link update}; clears the pending flag.
   */
  drainHurtFlash(): boolean {
    const pending = this.hurtFlashPending;
    this.hurtFlashPending = false;
    return pending;
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
      const bullet = this.bullets.acquire(spawn.x, spawn.y, spawn.rotationDeg, {
        speed: spawn.speed,
        damage: spawn.damage * damageMult,
        maxLifetime: spawn.maxLifetime,
        behavior: spawn.behavior,
        smokeTrailInterval: spawn.smokeTrailInterval,
        weaponIndex: spawn.weaponIndex,
      });
      if (bullet !== null) {
        any = true;
        this.runShots += 1;
      }
    }
    if (any) {
      this.audioEvents.push({ type: 'weaponFire', weaponIndex: weapon.type });
      this.particleFx.pushAll(
        buildMuzzleFx(muzzle.x, muzzle.y, gunAim.rotationDeg),
      );
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
    // Flash `heroStart`: no fire / walk until the chute collapses.
    if (this.playerHealth.alive) {
      const playerStep = playerTimeStepForPowerup(
        this.timeScale.timeStep,
        this.playerPowerup.powerupOn,
      );
      this.player.step(this.map, playerStep, this.playerPowerup.powerupOn);
      if (this.player.hyperJumpFired) {
        this.audioEvents.push({ type: 'hyperJump' });
      }
      if (!this.player.parachuting) {
        const def = getActiveWeaponDef(this.inventory);
        if (stepWeaponFire(this.weapon, this.fireHeld, def)) {
          this.tryFire();
          fallbackIfActiveEmpty(this.inventory);
        }
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
        playerBody.x, // Flash player._x (left edge) for chase tx
        playerBody.y,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        this.spawnRng,
        this.player.boostState.hjump,
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
        if (event.firstContact) {
          this.runHits += 1;
        }
        if (event.killed) {
          const death = spawnHeliDeathEntities(event.heli, this.spawnRng);
          this.heliWrecks.push(death.wreck);
          this.fallingPilots.push(death.pilot);
          this.heliShards.push(...death.shards);
          this.explosions.push(createHeliExplosion(event.heli.x, event.heli.y));
          this.particleFx.pushAll(buildKillFx(event.heli.x, event.heli.y));
          this.audioEvents.push({ type: 'heliBoom' });
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
        } else if (event.firstContact) {
          // Distinct non-fatal impact FX (not the kill boom).
          this.particleFx.pushAll(buildImpactFx(event.heli.x, event.heli.y));
        }
      },
      this.map,
      playerBody,
    );

    // Flash `addEnemy(300)` once the chute collapses, then 1:1 replacement on
    // kill. Target concurrency only moves on a kill, so an idle tick has
    // nothing to do — don't rescan the array 30× a second to learn that.
    const skyNeedsRefill = killsThisTick > 0 || this.helicopters.length === 0;
    if (!this.player.parachuting && skyNeedsRefill) {
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
      () => {
        this.audioEvents.push({ type: 'hurt' });
        this.particleFx.pushAll(
          buildBloodFx(
            playerBody.x + playerBody.w / 2,
            playerBody.y + playerBody.h / 2,
          ),
        );
        this.hurtFlashPending = true;
      },
      this.playerPowerup.powerupOn,
    );
    syncPlayerLastHealth(this.playerHealth);

    // Rocket / seeker smoke trails (#35) — Flash attachMovie("smoke") cadence.
    const trailStep = this.timeScale.timeStep;
    for (let i = 0; i < this.bullets.slots.length; i += 1) {
      const bullet = this.bullets.slots[i]!;
      if (
        !bullet.active ||
        !shouldEmitSmokeTrail(bullet.age, trailStep, bullet.smokeTrailInterval)
      ) {
        continue;
      }
      this.particleFx.pushAll(buildSmokeFx(bullet.x, bullet.y));
    }

    // Jetpack smoke while thrusting (Flash smok++%5 under jump).
    if (
      shouldEmitJetpackSmoke(
        this.playerPowerup.powerupOn,
        isJetpackActive(this.playerPowerup.powerupOn, this.player.input.jump) ||
          this.player.jumpState.jump,
        this.jetpackSmokeCounter,
      )
    ) {
      this.particleFx.pushAll(
        buildSmokeFx(
          playerBody.x + playerBody.w / 2,
          playerBody.y + playerBody.h,
        ),
      );
    }
    if (this.playerPowerup.powerupOn === POWERUP.Jetpack) {
      this.jetpackSmokeCounter += 1;
    } else {
      this.jetpackSmokeCounter = 0;
    }

    stepPowerups(this.powerups, this.map, this.timeScale.timeStep);
    if (this.playerHealth.alive) {
      const collected = collectPowerups(
        this.powerups,
        playerBody,
        this.playerHealth,
        this.inventory,
        this.playerPowerup,
        this.spawnRng,
      );
      for (const collect of collected) {
        this.audioEvents.push({ type: 'powerup', collect });
      }
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

    const dt = this.timeScale.timeStep;
    for (let i = this.heliWrecks.length - 1; i >= 0; i -= 1) {
      const wreck = this.heliWrecks[i]!;
      const done = stepHeliWreck(wreck, this.map, dt, (sx, sy) => {
        this.heliShards.push(
          ...createHeliShards(sx, sy, HELI_DEATH.shardBurst, this.spawnRng),
        );
        this.explosions.push(createHeliExplosion(wreck.x, wreck.y));
        this.audioEvents.push({ type: 'boom' });
      });
      if (done) {
        this.heliWrecks.splice(i, 1);
      }
    }
    for (let i = this.heliShards.length - 1; i >= 0; i -= 1) {
      if (
        stepHeliShard(
          this.heliShards[i]!,
          this.map,
          dt,
          this.shardMetalBounce,
          this.spawnRng,
          (index) => {
            this.audioEvents.push({ type: 'metal', index });
          },
        )
      ) {
        this.heliShards.splice(i, 1);
      }
    }
    for (let i = this.fallingPilots.length - 1; i >= 0; i -= 1) {
      if (stepFallingPilot(this.fallingPilots[i]!, this.map, dt)) {
        this.fallingPilots.splice(i, 1);
      }
    }
  }
}
