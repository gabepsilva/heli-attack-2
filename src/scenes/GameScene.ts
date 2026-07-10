import Phaser from 'phaser';
import { getSpriteDef, PLAYER_PLACEHOLDER_FRAME } from '../art/catalog';
import { placeOnCenter, playerSpritePlacement } from '../art/spritePlacement';
import { AudioHud } from '../audio/audioHud';
import { getGameAudio } from '../audio/gameAudio';
import { GameSfx } from '../audio/gameSfx';
import { ATLAS_KEY } from '../config/art';
import { playerPowerupAlpha } from '../combat/powerupEffects';
import {
  getActiveWeaponDef,
  nextWeapon,
  prevWeapon,
  selectWeaponByDigitKey,
} from '../combat/weaponInventory';
import {
  BULLET,
  ENEMY_BULLET,
  GAME_FLOW,
  GUN,
  HELI_LOOK_TINT,
  PLAYER,
  POWERUP,
  POWERUP_DROP,
  SIM_HZ,
  WORLD,
} from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import {
  beginDeath,
  createGameFlowState,
  pauseGame,
  resumeGame,
  startPlaying,
  tickDeath,
  type GameFlowState,
} from '../core/gameFlow';
import { SimSession } from '../core/simSession';
import { DebugOverlay } from '../tooling/debugOverlay';
import { buildHudSnapshot } from '../ui/hud';
import { GameHud } from '../ui/gameHud';
import { DEBUG_BOX_SIZE } from '../world/debugBox';
import {
  LEVEL1_HEIGHT_PX,
  LEVEL1_WIDTH_PX,
  isLevelSolid,
} from '../world/level1';

const TILE_COLOR = 0x3d5a80;
const BOX_COLOR = 0xe09f3e;
const BOX_DRAG_COLOR = 0xf4a261;
const PLAYER_HITBOX_STROKE = 0xd8f3dc;
const GUN_COLOR = 0xc9ada7;
const GUN_STROKE = 0xf2e9e4;
const MUZZLE_COLOR = 0xff6b6b;
const BULLET_COLOR = 0xffe066;
const ENEMY_BULLET_COLOR = 0xff6b6b;
const EXPLOSION_COLOR = 0xff9f1c;
const POWERUP_HEALTH_COLOR = 0x7dcfb6;
const POWERUP_WEAPON_COLOR = 0xffe066;
const POWERUP_STATE_COLOR = 0xc77dff;
const POWERUP_CHUTE_COLOR = 0xf8f9fa;
const HELI_FRAME = 'heli';
const HELI_HIT_FRAME = 'heli_hit';
const POWERUP_FRAME = 'powerup';

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * original level layout (placeholder tiles), hosts a controllable player
 * (←/→ walk, ↑ jump, ↓ duck, Ctrl boost, Shift bullet-time, mouse aim,
 * hold-to-fire, weapon switch via 1–0 / Q–E (#14), pooled bullets) rendered
 * from the packed atlas (#32), shootable heli variants with hit flash / death
 * boom (#12/#13/#20), parachuting powerup crates (#21), full in-game HUD
 * (#23), menu/pause/game-over session loop (#24), and a draggable debug box.
 * Game logic lives in plain modules under src/.
 *
 * Audio (#26/#27): menu unlock + catalog load; GameScene starts looping music
 * and drains sim SFX events (weapon / hurt / hyper-jump / heliboom / powerups).
 * DOM HUD owns master volume + mute. Pooling / gain math lives in AudioManager.
 *
 * The debug overlay (#8) is a DOM panel outside Phaser so it can host real
 * `<input>` controls for live physics tuning and toggle off for clean demos.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();
  private readonly flow: GameFlowState = createGameFlowState('playing');

  private boxRect!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerHitbox!: Phaser.GameObjects.Rectangle;
  private gunRect!: Phaser.GameObjects.Rectangle;
  private muzzleDot!: Phaser.GameObjects.Arc;
  /** One visual per pool slot — toggled visible when the slot is active. */
  private bulletDots: Phaser.GameObjects.Arc[] = [];
  /** Enemy return-fire visuals (#18). */
  private enemyBulletDots: Phaser.GameObjects.Arc[] = [];
  /** One visual per concurrent heli slot (#19 treadmill can fill several). */
  private heliSprites: Phaser.GameObjects.Image[] = [];
  /** One visual per in-flight explosion (kills can overlap). */
  private explosionSprites: Phaser.GameObjects.Arc[] = [];
  /** Crate + chute visuals for parachuting pickups (#21). */
  private powerupSprites: Phaser.GameObjects.Container[] = [];
  private gameHud!: GameHud;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private audioHud: AudioHud | null = null;
  private gameSfx: GameSfx | null = null;
  private boostKey!: Phaser.Input.Keyboard.Key;
  private bulletTimeKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private overlay: DebugOverlay | null = null;
  private arenaOriginX = 0;
  private arenaOriginY = 0;

  private readonly onResume = (): void => {
    resumeGame(this.flow);
  };

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  create(): void {
    // Phaser reuses this instance across scene.start — only create() re-runs.
    this.session.reset();
    startPlaying(this.flow);
    this.gameSfx?.destroy();
    this.gameSfx = null;
    this.audioHud?.destroy();
    this.overlay?.destroy();
    this.overlay = new DebugOverlay({
      search:
        typeof window !== 'undefined' ? window.location.search : undefined,
    });

    this.cameras.main.setBackgroundColor('#0d1b2a');

    this.arenaOriginX = Math.floor((GAME_WIDTH - LEVEL1_WIDTH_PX) / 2);
    this.arenaOriginY = Math.floor((GAME_HEIGHT - LEVEL1_HEIGHT_PX) / 2) - 40;

    this.drawArena();
    this.createPlayerVisual();
    this.createGunVisual();
    this.createBulletVisuals();
    this.createHeliVisual();
    this.createPowerupVisuals();
    this.gameHud = new GameHud(this);
    this.createDebugBoxVisual();
    this.setupGameAudio();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.boostKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.CTRL,
    );
    this.bulletTimeKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    this.add
      .text(
        GAME_WIDTH / 2,
        28,
        '↑ jump · Ctrl boost · Shift slow-mo · ↓ duck · ←/→ walk · mouse aim · hold fire · 1–0 / Q–E weapons',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '36px',
          color: '#f5f5f5',
        },
      )
      .setOrigin(0.5);

    this.add.text(
      40,
      GAME_HEIGHT - 60,
      '←/→ walk · ↑ jump · Ctrl boost · Shift slow-mo · ↓ duck · mouse aim · hold fire · 1–0 weapons · Q/E prev/next · -/= timeStep · drag box · ` debug · P/Esc pause',
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#9ab',
      },
    );

    this.input.keyboard?.on('keydown-MINUS', () => {
      this.session.timeScale.setTimeStep(1);
    });
    this.input.keyboard?.on('keydown-EQUALS', () => {
      this.session.timeScale.setTimeStep(0.5);
    });
    // Number keys 1–0 → arsenal indices 0–9 (#14).
    const digitKeyNames = [
      'ZERO',
      'ONE',
      'TWO',
      'THREE',
      'FOUR',
      'FIVE',
      'SIX',
      'SEVEN',
      'EIGHT',
      'NINE',
    ] as const;
    for (let digit = 0; digit <= 9; digit += 1) {
      const key = digitKeyNames[digit]!;
      this.input.keyboard?.on(`keydown-${key}`, () => {
        selectWeaponByDigitKey(
          this.session.inventory,
          digit,
          this.session.playerPowerup.powerupOn,
        );
      });
    }
    this.input.keyboard?.on('keydown-Q', () => {
      prevWeapon(this.session.inventory, this.session.playerPowerup.powerupOn);
    });
    this.input.keyboard?.on('keydown-E', () => {
      nextWeapon(this.session.inventory, this.session.playerPowerup.powerupOn);
    });
    // Flash pauseKey (80 / P) via GAME_FLOW — addKey avoids OS key-repeat strobe.
    this.pauseKey = this.input.keyboard!.addKey(GAME_FLOW.pauseKeyCode);
    this.pauseKey.on('down', () => {
      this.enterPause();
    });
    this.escKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    this.escKey.on('down', () => {
      this.enterPause();
    });
    // Backtick / tilde key — toggle overlay for clean demos (issue #8).
    this.input.keyboard?.on('keydown-BACKTICK', () => {
      this.overlay?.toggle();
    });

    // Resume may re-enter without a full create() — keep flow in sync.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
      this.pauseKey?.off('down');
      this.escKey?.off('down');
      this.gameSfx?.destroy();
      this.gameSfx = null;
      this.audioHud?.destroy();
      this.audioHud = null;
      this.overlay?.destroy();
      this.overlay = null;
    });
  }

  /** Pause gameplay and launch the pause overlay (#24). */
  private enterPause(): void {
    if (!pauseGame(this.flow)) {
      return;
    }
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.Pause);
  }

  /** Unlock (if needed), load catalog, start looping music, bind SFX (#27). */
  private setupGameAudio(): void {
    const audio = getGameAudio();
    this.audioHud = new AudioHud({ audio });
    this.gameSfx = new GameSfx({ audio });

    void (async () => {
      if (!audio.isUnlocked()) {
        await audio.unlock();
      }
      try {
        await audio.loadAll();
      } catch {
        // Partial catalog still plays whatever decoded.
      }
      this.gameSfx?.startMusic();
      this.audioHud?.refreshStatus();
    })();
  }

  update(_time: number, delta: number): void {
    this.session.player.input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      jump: this.cursors.up.isDown,
      duck: this.cursors.down.isDown,
      boost: this.boostKey.isDown,
    };
    this.session.bulletTimeHeld = this.bulletTimeKey.isDown;
    this.session.player.mouse = {
      x: this.input.activePointer.worldX - this.arenaOriginX,
      y: this.input.activePointer.worldY - this.arenaOriginY,
    };

    // Held fire (Flash mouseD). Skip while dragging the debug box / dying.
    const pointer = this.input.activePointer;
    this.session.fireHeld =
      this.flow.phase === 'playing' &&
      pointer.isDown &&
      !pointer.rightButtonDown() &&
      !this.session.debugBox.dragging;

    const wasDying = this.flow.phase === 'dying';
    const ticksBefore = this.session.simTickCount;
    this.session.update(delta);
    this.gameSfx?.drainAndPlay(this.session.drainAudioEvents());
    const simSteps = this.session.simTickCount - ticksBefore;

    if (!this.session.playerHealth.alive) {
      if (this.flow.phase === 'playing') {
        beginDeath(this.flow, this.session.score.value);
      }
      if (this.flow.phase === 'dying') {
        // Count only steps while already dead; on the death frame count one
        // (sim steps before the killing blow were still alive).
        const deathTicks = wasDying ? simSteps : simSteps > 0 ? 1 : 0;
        for (let i = 0; i < deathTicks; i += 1) {
          if (tickDeath(this.flow)) {
            this.scene.start(SCENE_KEYS.GameOver, {
              finalScore: this.flow.finalScore,
              helisKilled: this.session.heliSpawn.kills,
              shots: this.session.runShots,
              hits: this.session.runHits,
            });
            return;
          }
        }
      }
    }

    const p = this.session.player.body;
    const pl = this.session.player;
    const gun = this.session.weapon;
    const gunDef = getActiveWeaponDef(this.session.inventory);
    const pool = this.session.bullets;
    const reloadFrames = gunDef.reload;
    const mgReloadHud =
      gun.reloadTime === Number.POSITIVE_INFINITY
        ? 'ready'
        : `${Math.min(gun.reloadTime, reloadFrames)}/${reloadFrames}`;
    const weaponAmmoHud =
      gun.bullets === Number.POSITIVE_INFINITY ? '∞' : String(gun.bullets);
    this.overlay?.update({
      simRate: this.session.displayedSimRate,
      simHzTarget: SIM_HZ,
      timeStep: this.session.timeScale.timeStep,
      vx: p.vx,
      vy: p.vy,
      x: p.x,
      y: p.y,
      onGround: p.onGround,
      ducking: pl.ducking,
      jump: pl.jumpState.jump,
      jump2: pl.jumpState.jump2,
      jumpUp: pl.jumpState.up,
      boostCharge: pl.boostState.charge,
      boostChargeMax: PLAYER.boostChargeFrames,
      hjump: pl.boostState.hjump,
      weaponName: gunDef.name,
      weaponIndex: this.session.inventory.activeIndex,
      weaponAmmoHud,
      mgReloadHud,
      mgShots: gun.shots,
      bulletsActive: pool.activeCount,
      bulletsCapacity: pool.capacity,
      bulletsFired: pool.acquireCount,
      bulletsRecycled: pool.recycleCount,
    });

    this.syncPlayerVisual();
    this.syncGunVisual();
    this.syncBulletVisuals();
    this.syncEnemyBulletVisuals();
    this.syncHeliVisual();
    this.syncPowerupVisuals();
    this.syncGameHud();
    this.syncPlayerCombatFx();
    this.syncBoxVisual();
  }

  private drawArena(): void {
    const map = this.session.map;
    const g = this.add.graphics();
    g.fillStyle(TILE_COLOR, 1);

    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (!isLevelSolid(map, col, row)) {
          continue;
        }
        g.fillRect(
          this.arenaOriginX + col * WORLD.tile,
          this.arenaOriginY + row * WORLD.tile,
          WORLD.tile,
          WORLD.tile,
        );
      }
    }

    // Subtle grid outline so 50px tiles are visible.
    g.lineStyle(1, 0x1b263b, 0.6);
    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (!isLevelSolid(map, col, row)) {
          continue;
        }
        g.strokeRect(
          this.arenaOriginX + col * WORLD.tile,
          this.arenaOriginY + row * WORLD.tile,
          WORLD.tile,
          WORLD.tile,
        );
      }
    }
  }

  private createPlayerVisual(): void {
    const body = this.session.player.body;
    const def = getSpriteDef(PLAYER_PLACEHOLDER_FRAME);
    const place = playerSpritePlacement(body, def);

    this.playerSprite = this.add
      .image(
        this.arenaOriginX + place.x,
        this.arenaOriginY + place.y,
        ATLAS_KEY,
        PLAYER_PLACEHOLDER_FRAME,
      )
      .setOrigin(place.originX, place.originY)
      .setDisplaySize(place.displayW, place.displayH);

    // Collision AABB outline (debug aid until #8 overlay owns this).
    this.playerHitbox = this.add
      .rectangle(
        this.arenaOriginX + body.x + body.w / 2,
        this.arenaOriginY + body.y + body.h / 2,
        PLAYER.boxW,
        PLAYER.boxH,
      )
      .setStrokeStyle(1, PLAYER_HITBOX_STROKE, 0.7)
      .setFillStyle(0x000000, 0);
  }

  private syncPlayerVisual(): void {
    const body = this.session.player.body;
    const def = getSpriteDef(PLAYER_PLACEHOLDER_FRAME);
    const place = playerSpritePlacement(body, def);

    this.playerSprite.setPosition(
      this.arenaOriginX + place.x,
      this.arenaOriginY + place.y,
    );
    this.playerHitbox.setPosition(
      this.arenaOriginX + body.x + body.w / 2,
      this.arenaOriginY + body.y + body.h / 2,
    );
    this.playerHitbox.setSize(body.w, body.h);
  }

  private createGunVisual(): void {
    const pivot = this.session.player.gunPivot;
    // Rectangle origin is center by default; shift so the grip (pivotX) sits
    // on the gun pivot — matches Phaser Image.setOrigin(GUN.pivotX, pivotY).
    this.gunRect = this.add
      .rectangle(
        this.arenaOriginX + pivot.x,
        this.arenaOriginY + pivot.y,
        GUN.spriteW,
        GUN.spriteH,
        GUN_COLOR,
      )
      .setStrokeStyle(1, GUN_STROKE)
      .setOrigin(GUN.pivotX, GUN.pivotY);

    this.muzzleDot = this.add.circle(
      this.arenaOriginX + this.session.player.muzzle.x,
      this.arenaOriginY + this.session.player.muzzle.y,
      3,
      MUZZLE_COLOR,
    );
  }

  private syncGunVisual(): void {
    const player = this.session.player;
    const pivot = player.gunPivot;
    const aim = player.gunAim;

    this.gunRect.setPosition(
      this.arenaOriginX + pivot.x,
      this.arenaOriginY + pivot.y,
    );
    this.gunRect.setAngle(aim.rotationDeg);
    // Flash `_yscale = -100` when aiming left — Phaser flipY.
    this.gunRect.setScale(1, aim.flipY ? -1 : 1);

    this.muzzleDot.setPosition(
      this.arenaOriginX + player.muzzle.x,
      this.arenaOriginY + player.muzzle.y,
    );
  }

  private createBulletVisuals(): void {
    this.bulletDots = [];
    for (let i = 0; i < this.session.bullets.capacity; i += 1) {
      const dot = this.add
        .circle(0, 0, BULLET.radius, BULLET_COLOR)
        .setVisible(false);
      this.bulletDots.push(dot);
    }
    this.enemyBulletDots = [];
    for (let i = 0; i < this.session.enemyBullets.capacity; i += 1) {
      const dot = this.add
        .circle(0, 0, ENEMY_BULLET.radius, ENEMY_BULLET_COLOR)
        .setVisible(false);
      this.enemyBulletDots.push(dot);
    }
  }

  private syncBulletVisuals(): void {
    const slots = this.session.bullets.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const bullet = slots[i]!;
      const dot = this.bulletDots[i]!;
      if (!bullet.active) {
        dot.setVisible(false);
        continue;
      }
      dot.setVisible(true);
      dot.setPosition(
        this.arenaOriginX + bullet.x,
        this.arenaOriginY + bullet.y,
      );
    }
  }

  private syncEnemyBulletVisuals(): void {
    const slots = this.session.enemyBullets.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const bullet = slots[i]!;
      const dot = this.enemyBulletDots[i]!;
      if (!bullet.active) {
        dot.setVisible(false);
        continue;
      }
      dot.setVisible(true);
      dot.setPosition(
        this.arenaOriginX + bullet.x,
        this.arenaOriginY + bullet.y,
      );
    }
  }

  private createHeliVisual(): void {
    // Pool sized for max concurrent + a couple spare explosion slots (#19).
    const heliPool = 8;
    const boomPool = 8;
    const def = getSpriteDef(HELI_FRAME);
    const place = placeOnCenter(0, 0, def.pivot, {
      w: def.originalW,
      h: def.originalH,
    });
    this.heliSprites = [];
    for (let i = 0; i < heliPool; i += 1) {
      this.heliSprites.push(
        this.add
          .image(0, 0, ATLAS_KEY, HELI_FRAME)
          .setOrigin(place.originX, place.originY)
          .setDisplaySize(place.displayW, place.displayH)
          .setTint(HELI_LOOK_TINT[0])
          .setVisible(false),
      );
    }
    this.explosionSprites = [];
    for (let i = 0; i < boomPool; i += 1) {
      this.explosionSprites.push(
        this.add.circle(0, 0, 40, EXPLOSION_COLOR, 0.85).setVisible(false),
      );
    }
  }

  private syncGameHud(): void {
    const gunDef = getActiveWeaponDef(this.session.inventory);
    this.gameHud.sync(
      buildHudSnapshot({
        score: this.session.score.value,
        health: this.session.playerHealth,
        weapon: this.session.weapon,
        weaponDef: gunDef,
        weaponIndex: this.session.inventory.activeIndex,
        boost: this.session.player.boostState,
        bulletTime: this.session.bulletTime,
        powerup: this.session.playerPowerup,
      }),
    );
  }

  /** Hurt flash / PredatorMode alpha — kept out of the HUD view. */
  private syncPlayerCombatFx(): void {
    const health = this.session.playerHealth;
    const powerupAlpha = playerPowerupAlpha(
      this.session.playerPowerup.powerupOn,
      this.session.predatorFlicker,
    );
    if (this.session.playerPowerup.powerupOn === POWERUP.PredatorMode) {
      this.playerHitbox.setStrokeStyle(1, PLAYER_HITBOX_STROKE, 0.15);
      this.playerSprite.setAlpha(powerupAlpha);
    } else if (health.iFramesRemaining > 0 && health.alive) {
      this.playerHitbox.setStrokeStyle(2, 0xe63946, 1);
      this.playerSprite.setAlpha(
        0.55 + 0.45 * Math.sin(health.iFramesRemaining),
      );
    } else {
      this.playerHitbox.setStrokeStyle(1, PLAYER_HITBOX_STROKE, 0.7);
      this.playerSprite.setAlpha(health.alive ? 1 : 0.35);
    }
  }

  private syncHeliVisual(): void {
    const helis = this.session.helicopters;
    for (let i = 0; i < this.heliSprites.length; i += 1) {
      const sprite = this.heliSprites[i]!;
      const heli = helis[i];
      if (!heli || !heli.active) {
        sprite.setVisible(false);
        continue;
      }
      const flashing = heli.hitFlashRemaining > 0;
      const frame = flashing ? HELI_HIT_FRAME : HELI_FRAME;
      const def = getSpriteDef(frame);
      const place = placeOnCenter(heli.x, heli.y, def.pivot, {
        w: def.originalW,
        h: def.originalH,
      });
      sprite.setVisible(true);
      sprite.setTexture(ATLAS_KEY, frame);
      sprite.setOrigin(place.originX, place.originY);
      sprite.setDisplaySize(place.displayW, place.displayH);
      sprite.setPosition(
        this.arenaOriginX + place.x,
        this.arenaOriginY + place.y,
      );
      sprite.setAngle(heli.rotationDeg);
      // Look tint distinguishes hover vs strafe (#20); flash goes white.
      const lookTint = HELI_LOOK_TINT[heli.look] ?? HELI_LOOK_TINT[0];
      sprite.setTint(flashing ? 0xffffff : lookTint);
    }

    const booms = this.session.explosions;
    for (let i = 0; i < this.explosionSprites.length; i += 1) {
      const sprite = this.explosionSprites[i]!;
      const boom = booms[i];
      if (!boom || !boom.active) {
        sprite.setVisible(false);
        continue;
      }
      const scale = 1 + (boom.age / boom.maxAge) * 1.5;
      sprite.setVisible(true);
      sprite.setPosition(
        this.arenaOriginX + boom.x,
        this.arenaOriginY + boom.y,
      );
      sprite.setScale(scale);
      sprite.setAlpha(Math.max(0, 1 - boom.age / boom.maxAge));
    }
  }

  private createPowerupVisuals(): void {
    // Enough slots for a long run of threshold + lucky weapon drops.
    const pool = 16;
    this.powerupSprites = [];
    for (let i = 0; i < pool; i += 1) {
      const chute = this.add
        .ellipse(0, -28, 36, 14, POWERUP_CHUTE_COLOR, 0.85)
        .setVisible(false);
      const crate = this.add
        .image(0, 0, ATLAS_KEY, POWERUP_FRAME)
        .setDisplaySize(POWERUP_DROP.crateW, POWERUP_DROP.crateH)
        .setTint(POWERUP_WEAPON_COLOR);
      const container = this.add
        .container(0, 0, [chute, crate])
        .setVisible(false)
        .setDepth(12);
      // Stash chute/crate for sync tint + chute scale.
      container.setData('chute', chute);
      container.setData('crate', crate);
      this.powerupSprites.push(container);
    }
  }

  private syncPowerupVisuals(): void {
    const drops = this.session.powerups;
    for (let i = 0; i < this.powerupSprites.length; i += 1) {
      const container = this.powerupSprites[i]!;
      const pickup = drops[i];
      if (!pickup || !pickup.active) {
        container.setVisible(false);
        continue;
      }
      const chute = container.getData('chute') as Phaser.GameObjects.Ellipse;
      const crate = container.getData('crate') as Phaser.GameObjects.Image;
      const tint =
        pickup.kind === 'health'
          ? POWERUP_HEALTH_COLOR
          : pickup.kind === 'state'
            ? POWERUP_STATE_COLOR
            : POWERUP_WEAPON_COLOR;
      crate.setTint(tint);
      const chuteOpen = pickup.chuteScale > 0 && !pickup.stopped;
      chute.setVisible(chuteOpen);
      if (chuteOpen) {
        const s = Math.max(0.05, pickup.chuteScale / 100);
        chute.setScale(s, Math.min(1, s + 0.15));
      }
      container.setVisible(true);
      container.setPosition(
        this.arenaOriginX + pickup.x,
        this.arenaOriginY + pickup.y,
      );
    }
  }

  private createDebugBoxVisual(): void {
    const b = this.session.debugBox.body;
    this.boxRect = this.add
      .rectangle(
        this.arenaOriginX + b.x + b.w / 2,
        this.arenaOriginY + b.y + b.h / 2,
        DEBUG_BOX_SIZE,
        DEBUG_BOX_SIZE,
        BOX_COLOR,
      )
      .setStrokeStyle(2, 0xffd166)
      .setInteractive({ draggable: true, useHandCursor: true });

    this.input.setDraggable(this.boxRect);

    this.input.on(
      'dragstart',
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        if (gameObject !== this.boxRect) {
          return;
        }
        this.session.debugBox.dragging = true;
        this.boxRect.setFillStyle(BOX_DRAG_COLOR);
      },
    );

    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (gameObject !== this.boxRect) {
          return;
        }
        this.boxRect.setPosition(dragX, dragY);
        // Convert visual center → body top-left in arena space.
        this.session.debugBox.placeAt(
          dragX - this.arenaOriginX - b.w / 2,
          dragY - this.arenaOriginY - b.h / 2,
        );
      },
    );

    this.input.on(
      'dragend',
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        if (gameObject !== this.boxRect) {
          return;
        }
        this.session.debugBox.dragging = false;
        this.boxRect.setFillStyle(BOX_COLOR);
      },
    );
  }

  private syncBoxVisual(): void {
    if (this.session.debugBox.dragging) {
      return;
    }
    const b = this.session.debugBox.body;
    this.boxRect.setPosition(
      this.arenaOriginX + b.x + b.w / 2,
      this.arenaOriginY + b.y + b.h / 2,
    );
  }
}
