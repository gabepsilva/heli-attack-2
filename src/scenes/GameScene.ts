import Phaser from 'phaser';
import { getSpriteDef, PLAYER_PLACEHOLDER_FRAME } from '../art/catalog';
import { placeOnCenter, playerSpritePlacement } from '../art/spritePlacement';
import { AudioHud } from '../audio/audioHud';
import { getGameAudio } from '../audio/gameAudio';
import { ATLAS_KEY } from '../config/art';
import { AUDIO_TEST_SFX_ID } from '../config/audio';
import { formatScoreHud } from '../combat/score';
import { formatHealthHud } from '../combat/playerHealth';
import {
  getActiveWeaponDef,
  nextWeapon,
  prevWeapon,
  selectWeaponByDigitKey,
} from '../combat/weaponInventory';
import {
  BULLET,
  ENEMY_BULLET,
  GUN,
  PLAYER,
  SIM_HZ,
  WORLD,
} from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { SimSession } from '../core/simSession';
import { DebugOverlay } from '../tooling/debugOverlay';
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
const HELI_TINT = 0xffffff;
const EXPLOSION_COLOR = 0xff9f1c;
const SCORE_COLOR = '#ffe066';
const HEALTH_COLOR = '#7dcfb6';
const HEALTH_DEAD_COLOR = '#e63946';
const HELI_FRAME = 'heli';
const HELI_HIT_FRAME = 'heli_hit';

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * original level layout (placeholder tiles), hosts a controllable player
 * (←/→ walk, ↑ jump, ↓ duck, Ctrl boost, mouse aim, hold-to-fire, weapon
 * switch via 1–0 / Q–E (#14), pooled bullets) rendered from the packed atlas
 * (#32), a shootable heli with hit flash / death boom / score HUD (#12/#13),
 * and a draggable debug box.
 * Game logic lives in plain modules under src/.
 *
 * Audio (#26): click plays the test SFX after Boot unlock; DOM HUD owns
 * master volume + mute. Pooling / gain math lives in {@link AudioManager}.
 *
 * The debug overlay (#8) is a DOM panel outside Phaser so it can host real
 * `<input>` controls for live physics tuning and toggle off for clean demos.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();

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
  private scoreText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private deathText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private audioHud: AudioHud | null = null;
  private boostKey!: Phaser.Input.Keyboard.Key;
  private overlay: DebugOverlay | null = null;
  private arenaOriginX = 0;
  private arenaOriginY = 0;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  create(): void {
    // Phaser reuses this instance across scene.start — only create() re-runs.
    this.session.reset();
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
    this.createScoreHud();
    this.createHealthHud();
    this.createDebugBoxVisual();
    this.setupAudioDemo();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.boostKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.CTRL,
    );

    this.add
      .text(
        GAME_WIDTH / 2,
        28,
        '↑ jump · Ctrl boost · ↓ duck · ←/→ walk · mouse aim · hold fire · 1–0 / Q–E weapons · click SFX',
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
      '←/→ walk · ↑ jump · Ctrl boost · ↓ duck · mouse aim · hold fire · 1–0 weapons · Q/E prev/next · -/= timeStep · click SFX · drag box · ` debug · Esc → Boot',
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
        selectWeaponByDigitKey(this.session.inventory, digit);
      });
    }
    this.input.keyboard?.on('keydown-Q', () => {
      prevWeapon(this.session.inventory);
    });
    this.input.keyboard?.on('keydown-E', () => {
      nextWeapon(this.session.inventory);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.Boot);
    });
    // Backtick / tilde key — toggle overlay for clean demos (issue #8).
    this.input.keyboard?.on('keydown-BACKTICK', () => {
      this.overlay?.toggle();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audioHud?.destroy();
      this.audioHud = null;
      this.overlay?.destroy();
      this.overlay = null;
    });
  }

  private setupAudioDemo(): void {
    const audio = getGameAudio();
    this.audioHud = new AudioHud({ audio });

    void (async () => {
      if (!audio.isUnlocked()) {
        await audio.unlock();
      }
      if (!audio.hasBuffer(AUDIO_TEST_SFX_ID)) {
        await audio.load(AUDIO_TEST_SFX_ID);
      }
      this.audioHud?.refreshStatus();
    })();

    this.input.on('pointerdown', () => {
      audio.play(AUDIO_TEST_SFX_ID);
      this.audioHud?.refreshStatus();
    });
  }

  update(_time: number, delta: number): void {
    this.session.player.input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      jump: this.cursors.up.isDown,
      duck: this.cursors.down.isDown,
      boost: this.boostKey.isDown,
    };
    this.session.player.mouse = {
      x: this.input.activePointer.worldX - this.arenaOriginX,
      y: this.input.activePointer.worldY - this.arenaOriginY,
    };

    // Held fire (Flash mouseD). Skip while dragging the debug box.
    const pointer = this.input.activePointer;
    this.session.fireHeld =
      pointer.isDown &&
      !pointer.rightButtonDown() &&
      !this.session.debugBox.dragging;

    this.session.update(delta);

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
    this.syncScoreHud();
    this.syncHealthHud();
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
          .setTint(HELI_TINT)
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

  private createScoreHud(): void {
    // Temporary on-screen score readout (#13) until the full HUD lands in M6.
    this.scoreText = this.add
      .text(40, 40, formatScoreHud(0), {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: SCORE_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(20);
  }

  private syncScoreHud(): void {
    this.scoreText.setText(formatScoreHud(this.session.score.value));
  }

  private createHealthHud(): void {
    // Temporary health bar (#18) until the full HUD lands in #23.
    const barX = 40;
    const barY = 100;
    const barW = 280;
    const barH = 28;

    this.add
      .rectangle(barX, barY, barW, barH, 0x1b263b)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x415a77)
      .setDepth(20);

    this.healthBarFill = this.add
      .rectangle(barX + 2, barY + 2, barW - 4, barH - 4, 0x2a9d8f)
      .setOrigin(0, 0)
      .setDepth(21);

    this.healthText = this.add
      .text(barX, barY + barH + 8, formatHealthHud(this.session.playerHealth), {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: HEALTH_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(20);

    this.deathText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'YOU DIED', {
        fontFamily: 'monospace',
        fontSize: '96px',
        color: HEALTH_DEAD_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
  }

  private syncHealthHud(): void {
    const health = this.session.playerHealth;
    const frac = Math.max(0, Math.min(1, health.health / health.maxHealth));
    const innerW = 280 - 4;
    this.healthBarFill.width = Math.max(0, innerW * frac);
    this.healthBarFill.setFillStyle(health.alive ? 0x2a9d8f : 0xe63946);
    this.healthText.setText(formatHealthHud(health));
    this.healthText.setColor(health.alive ? HEALTH_COLOR : HEALTH_DEAD_COLOR);
    this.deathText.setVisible(!health.alive);

    // Brief red tint on the player hitbox while hurt-flashing / i-framed.
    if (health.iFramesRemaining > 0 && health.alive) {
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
      // Brighten during flash so the hit reads even if frames look similar.
      sprite.setTint(flashing ? 0xffffff : HELI_TINT);
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
