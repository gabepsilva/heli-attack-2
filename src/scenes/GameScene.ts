import Phaser from 'phaser';
import {
  gameDrawSize,
  getSpriteDef,
  heliFrameForLook,
  type SpriteId,
} from '../art/catalog';
import {
  explosionAgeScale,
  placeOnCenter,
  playerSpritePlacement,
  scaledDisplaySize,
} from '../art/spritePlacement';
import { AudioHud } from '../audio/audioHud';
import { getGameAudio } from '../audio/gameAudio';
import { GameSfx } from '../audio/gameSfx';
import { ATLAS_KEY, BG_IMAGE_KEY } from '../config/art';
import { isPlayerHurtFlashing } from '../combat/playerHealth';
import { playerPowerupAlpha } from '../combat/powerupEffects';
import { getActiveWeaponDef } from '../combat/weaponInventory';
import {
  advanceWalkPhase,
  playerAnimMoving,
  selectPlayerAnimFrame,
} from '../player/playerAnim';
import {
  GAME_FLOW,
  GUN,
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
import {
  createIntentActionBuffer,
  DEFAULT_KEY_BINDINGS,
  drainIntentActions,
  queueNextWeapon,
  queuePrevWeapon,
  queueWeaponDigit,
  sampleKeyboardMouseIntent,
  weaponDigitKeydownEvent,
  type IntentActionBuffer,
} from '../input/keyboardMouse';
import { applyPlayerIntent, mergePlayerIntents } from '../input/playerIntent';
import { sampleTouchIntent, stickActive } from '../input/touchControls';
import {
  advanceGamepadWeaponEdges,
  applyGamepadHotplugEvent,
  createGamepadHotplugState,
  createGamepadWeaponEdgeState,
  gamepadStickActive,
  isGamepadConnected,
  sampleGamepadIntent,
  syncGamepadHotplugFromPads,
  type GamepadHotplugState,
  type GamepadWeaponEdgeState,
} from '../input/gamepadControls';
import { DEFAULT_GAMEPAD_BINDINGS } from '../config/gamepad';
import { DebugOverlay } from '../tooling/debugOverlay';
import { buildHudSnapshot } from '../ui/hud';
import { GameHud } from '../ui/gameHud';
import { getMountedTouchControlsHud } from '../ui/touchControlsHud';
import { DEBUG_BOX_SIZE } from '../world/debugBox';
import {
  LEVEL1_HEIGHT_PX,
  LEVEL1_WIDTH_PX,
  isLevelSolid,
} from '../world/level1';

const BOX_COLOR = 0xe09f3e;
const BOX_DRAG_COLOR = 0xf4a261;
const PLAYER_HITBOX_STROKE = 0xd8f3dc;
const POWERUP_HEALTH_COLOR = 0x7dcfb6;
const POWERUP_WEAPON_COLOR = 0xffe066;
const POWERUP_STATE_COLOR = 0xc77dff;
const POWERUP_CHUTE_COLOR = 0xf8f9fa;
const HELI_HIT_FRAME = 'heli_hit';
const POWERUP_FRAME = 'powerup';
const WEAPON_FRAME = 'weapon_machinegun';
const BULLET_PLAYER_FRAME = 'bullet_player';
const BULLET_ENEMY_FRAME = 'bullet_enemy';
const MUZZLE_FRAME = 'muzzle_flash';
const EXPLOSION_FRAME = 'explosion';
const TILE_FRAME = 'tile_floor';

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * original level layout with final hi-res tiles (#34), hosts a controllable
 * player (←/→ walk, ↑ jump, ↓ duck, Ctrl boost, Shift bullet-time, mouse aim,
 * hold-to-fire, weapon switch via 1–0 / Q–E (#14), pooled bullets) rendered
 * from the packed atlas with final hi-res player animations (#32/#33), shootable
 * heli variants with hit flash / death boom (#12/#13/#20/#34), parachuting
 * powerup crates (#21), full in-game HUD (#23), menu/pause/game-over session
 * loop (#24), and a draggable debug box. Game logic lives in plain modules
 * under src/.
 *
 * Input (#29/#30/#31): keyboard/mouse, on-screen touch, and gamepad feed the
 * intent layer; gameplay reads {@link applyPlayerIntent} output on the session
 * — never raw keys, touches, or pad APIs. Portrait shows a rotate overlay
 * (#30). Unplugging a controller falls back to keyboard cleanly (#31).
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
  /** Edge-triggered weapon actions queued from keydown (#29). */
  private readonly intentActions: IntentActionBuffer =
    createIntentActionBuffer();
  /** Active gamepad hotplug state (#31). */
  private gamepadHotplug: GamepadHotplugState = createGamepadHotplugState();
  /** LB/RB rising-edge tracker for weapon switch (#31). */
  private readonly gamepadWeaponEdges: GamepadWeaponEdgeState =
    createGamepadWeaponEdgeState();
  private readonly onGamepadConnected = (pad: { index: number }): void => {
    this.gamepadHotplug = applyGamepadHotplugEvent(this.gamepadHotplug, {
      type: 'connected',
      index: pad.index,
    });
  };
  private readonly onGamepadDisconnected = (pad: { index: number }): void => {
    this.gamepadHotplug = applyGamepadHotplugEvent(this.gamepadHotplug, {
      type: 'disconnected',
      index: pad.index,
    });
  };

  private boxRect!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerHitbox!: Phaser.GameObjects.Rectangle;
  /** Flash nested walk-cycle phase (0..walk.length-1). */
  private playerWalkPhase = 0;
  private playerAnimFrame: SpriteId = 'player_idle';
  private gunSprite!: Phaser.GameObjects.Image;
  private muzzleSprite!: Phaser.GameObjects.Image;
  /** One visual per pool slot — toggled visible when the slot is active. */
  private bulletSprites: Phaser.GameObjects.Image[] = [];
  /** Enemy return-fire visuals (#18). */
  private enemyBulletSprites: Phaser.GameObjects.Image[] = [];
  /** One visual per concurrent heli slot (#19 treadmill can fill several). */
  private heliSprites: Phaser.GameObjects.Image[] = [];
  /** One visual per in-flight explosion (kills can overlap). */
  private explosionSprites: Phaser.GameObjects.Image[] = [];
  /** Crate + chute visuals for parachuting pickups (#21). */
  private powerupSprites: Phaser.GameObjects.Container[] = [];
  private gameHud!: GameHud;
  /** Movement / combat keys — codes come from {@link DEFAULT_KEY_BINDINGS}. */
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private duckKey!: Phaser.Input.Keyboard.Key;
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
    // Drop any weapon-switch presses queued while the scene was shut down.
    drainIntentActions(this.intentActions);
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

    // Full-bleed desert plate behind the arena (#34).
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_IMAGE_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10);

    this.drawArena();
    this.createPlayerVisual();
    this.createGunVisual();
    this.createBulletVisuals();
    this.createHeliVisual();
    this.createPowerupVisuals();
    this.gameHud = new GameHud(this);
    this.createDebugBoxVisual();
    this.setupGameAudio();

    // Bind gameplay keys from DEFAULT_KEY_BINDINGS — single source of truth (#29).
    const kb = this.input.keyboard!;
    const bind = DEFAULT_KEY_BINDINGS;
    this.leftKey = kb.addKey(bind.left.code);
    this.rightKey = kb.addKey(bind.right.code);
    this.jumpKey = kb.addKey(bind.jump.code);
    this.duckKey = kb.addKey(bind.duck.code);
    this.boostKey = kb.addKey(bind.boost.code);
    this.bulletTimeKey = kb.addKey(bind.bulletTime.code);

    this.add
      .text(
        GAME_WIDTH / 2,
        28,
        '↑ jump · Ctrl boost · Shift slow-mo · ↓ duck · ←/→ walk · mouse / pad aim · hold fire · 1–0 / Q–E / LB–RB weapons',
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
      '←/→ walk · ↑ jump · Ctrl boost · Shift slow-mo · ↓ duck · mouse/pad aim · hold fire/RT · 1–0 / Q–E / LB–RB weapons · -/= timeStep · drag box · ` debug · P/Esc pause',
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
    // Number keys 1–0 → arsenal indices 0–9 (#14) via intent action buffer (#29).
    for (const digit of bind.weaponDigits) {
      this.input.keyboard?.on(
        `keydown-${weaponDigitKeydownEvent(digit)}`,
        () => {
          queueWeaponDigit(this.intentActions, digit);
        },
      );
    }
    this.input.keyboard?.on(`keydown-${bind.prevWeapon.event}`, () => {
      queuePrevWeapon(this.intentActions);
    });
    this.input.keyboard?.on(`keydown-${bind.nextWeapon.event}`, () => {
      queueNextWeapon(this.intentActions);
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

    // Gamepad hotplug (#31): listen for connect/disconnect; sync already-present pads.
    const gp = this.input.gamepad;
    if (gp) {
      gp.on('connected', this.onGamepadConnected);
      gp.on('disconnected', this.onGamepadDisconnected);
      this.gamepadHotplug = syncGamepadHotplugFromPads(
        this.gamepadHotplug,
        gp.gamepads,
      );
    }

    // Resume may re-enter without a full create() — keep flow in sync.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
      this.pauseKey?.off('down');
      this.escKey?.off('down');
      const gamepadPlugin = this.input.gamepad;
      if (gamepadPlugin) {
        gamepadPlugin.off('connected', this.onGamepadConnected);
        gamepadPlugin.off('disconnected', this.onGamepadDisconnected);
      }
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
    // Keyboard/mouse (+ touch #30 + gamepad #31) → intent → session.
    // Never raw keys / touches / pad APIs in gameplay.
    const pointer = this.input.activePointer;
    const allowFire =
      this.flow.phase === 'playing' && !this.session.debugBox.dragging;
    const touchHud = getMountedTouchControlsHud();
    const touchMode = touchHud?.isVisible() ?? false;
    // In touch mode, ignore canvas pointer fire/aim — sticks own those slots.
    const kbIntent = sampleKeyboardMouseIntent({
      held: {
        left: this.leftKey.isDown,
        right: this.rightKey.isDown,
        jump: this.jumpKey.isDown,
        duck: this.duckKey.isDown,
        boost: this.boostKey.isDown,
        bulletTime: this.bulletTimeKey.isDown,
      },
      pointer: {
        aimX: touchMode
          ? this.session.player.mouse.x
          : pointer.worldX - this.arenaOriginX,
        aimY: touchMode
          ? this.session.player.mouse.y
          : pointer.worldY - this.arenaOriginY,
        primaryDown: touchMode ? false : pointer.isDown,
        rightDown: touchMode ? false : pointer.rightButtonDown(),
      },
      actions: this.intentActions,
      allowFire,
    });
    let intent = kbIntent;
    if (touchHud && touchMode) {
      const touchSample = touchHud.getSample(allowFire);
      const touchIntent = sampleTouchIntent(
        touchSample,
        this.session.player.body,
        {
          fallbackAimX: intent.aimX,
          fallbackAimY: intent.aimY,
        },
      );
      intent = mergePlayerIntents(intent, touchIntent, {
        preferSecondaryAim: stickActive(
          touchSample.aimStickX,
          touchSample.aimStickY,
        ),
      });
    }

    // Gamepad (#31): sample when a pad is connected; unplug → keyboard path.
    const gp = this.input.gamepad;
    if (gp) {
      this.gamepadHotplug = syncGamepadHotplugFromPads(
        this.gamepadHotplug,
        gp.gamepads,
      );
    }
    if (gp && isGamepadConnected(this.gamepadHotplug)) {
      const pad =
        this.gamepadHotplug.padIndex !== null
          ? gp.getPad(this.gamepadHotplug.padIndex)
          : null;
      if (pad?.connected) {
        const bind = DEFAULT_GAMEPAD_BINDINGS;
        const weaponEdges = advanceGamepadWeaponEdges(this.gamepadWeaponEdges, {
          prevWeapon: pad.isButtonDown(bind.prevWeapon),
          nextWeapon: pad.isButtonDown(bind.nextWeapon),
        });
        // Analog triggers report 0–1; treat >0.5 as pressed (RT fire).
        const fireHeld =
          pad.isButtonDown(bind.fire) || pad.getButtonValue(bind.fire) > 0.5;
        const padIntent = sampleGamepadIntent(
          {
            moveX: pad.leftStick.x,
            moveY: pad.leftStick.y,
            aimStickX: pad.rightStick.x,
            aimStickY: pad.rightStick.y,
            jump: pad.isButtonDown(bind.jump),
            boost: pad.isButtonDown(bind.boost),
            bulletTime: pad.isButtonDown(bind.bulletTime),
            fire: fireHeld,
            dpadLeft: pad.isButtonDown(bind.dpadLeft) || pad.left,
            dpadRight: pad.isButtonDown(bind.dpadRight) || pad.right,
            dpadDown: pad.isButtonDown(bind.dpadDown) || pad.down,
            dpadUp: pad.isButtonDown(bind.dpadUp) || pad.up,
            prevWeapon: weaponEdges.prevWeapon,
            nextWeapon: weaponEdges.nextWeapon,
            allowFire,
          },
          this.session.player.body,
          {
            fallbackAimX: intent.aimX,
            fallbackAimY: intent.aimY,
          },
        );
        intent = mergePlayerIntents(intent, padIntent, {
          preferSecondaryAim: gamepadStickActive(
            pad.rightStick.x,
            pad.rightStick.y,
          ),
        });
      }
    }

    applyPlayerIntent(this.session, intent);

    const wasDying = this.flow.phase === 'dying';
    const ticksBefore = this.session.simTickCount;
    this.session.update(delta);
    const simSteps = this.session.simTickCount - ticksBefore;
    // Advance walk cycle once per sim move tick while horizontally moving
    // (Flash `gfx.gfx.nextFrame()` under walk parent frame 4).
    if (simSteps > 0) {
      const moving = playerAnimMoving(this.session.player.body.vx);
      for (let i = 0; i < simSteps; i += 1) {
        this.playerWalkPhase = advanceWalkPhase(
          this.playerWalkPhase,
          moving,
          true,
        );
      }
    }
    this.gameSfx?.drainAndPlay(this.session.drainAudioEvents(), {
      simTicks: simSteps,
    });

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
    const tileDef = getSpriteDef(TILE_FRAME);

    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (!isLevelSolid(map, col, row)) {
          continue;
        }
        this.add
          .image(
            this.arenaOriginX + col * WORLD.tile,
            this.arenaOriginY + row * WORLD.tile,
            ATLAS_KEY,
            TILE_FRAME,
          )
          .setOrigin(tileDef.pivot.x, tileDef.pivot.y)
          .setDisplaySize(WORLD.tile, WORLD.tile)
          .setDepth(0);
      }
    }
  }

  private resolvePlayerAnimFrame(): SpriteId {
    const pl = this.session.player;
    const health = this.session.playerHealth;
    return selectPlayerAnimFrame({
      ducking: pl.ducking,
      jump: pl.jumpState.jump,
      jump2: pl.jumpState.jump2,
      moving: playerAnimMoving(pl.body.vx),
      hurt:
        health.alive &&
        (isPlayerHurtFlashing(health) || health.iFramesRemaining > 0),
      dead: !health.alive || this.flow.phase === 'dying',
      walkPhase: this.playerWalkPhase,
    });
  }

  private createPlayerVisual(): void {
    this.playerWalkPhase = 0;
    this.playerAnimFrame = this.resolvePlayerAnimFrame();
    const body = this.session.player.body;
    const def = getSpriteDef(this.playerAnimFrame);
    const place = playerSpritePlacement(body, def);

    this.playerSprite = this.add
      .image(
        this.arenaOriginX + place.x,
        this.arenaOriginY + place.y,
        ATLAS_KEY,
        this.playerAnimFrame,
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
    const frame = this.resolvePlayerAnimFrame();
    const def = getSpriteDef(frame);
    const place = playerSpritePlacement(body, def);

    if (frame !== this.playerAnimFrame) {
      this.playerAnimFrame = frame;
      this.playerSprite.setTexture(ATLAS_KEY, frame);
      this.playerSprite.setOrigin(place.originX, place.originY);
      this.playerSprite.setDisplaySize(place.displayW, place.displayH);
    }

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
    const gunDef = getSpriteDef(WEAPON_FRAME);
    this.gunSprite = this.add
      .image(
        this.arenaOriginX + pivot.x,
        this.arenaOriginY + pivot.y,
        ATLAS_KEY,
        WEAPON_FRAME,
      )
      .setOrigin(gunDef.pivot.x, gunDef.pivot.y)
      .setDisplaySize(GUN.spriteW, GUN.spriteH)
      .setDepth(20);

    const muzzleDef = getSpriteDef(MUZZLE_FRAME);
    const muzzleDraw = gameDrawSize(muzzleDef);
    this.muzzleSprite = this.add
      .image(
        this.arenaOriginX + this.session.player.muzzle.x,
        this.arenaOriginY + this.session.player.muzzle.y,
        ATLAS_KEY,
        MUZZLE_FRAME,
      )
      .setOrigin(muzzleDef.pivot.x, muzzleDef.pivot.y)
      .setDisplaySize(muzzleDraw.w, muzzleDraw.h)
      .setDepth(21)
      .setVisible(false);
  }

  private syncGunVisual(): void {
    const player = this.session.player;
    const pivot = player.gunPivot;
    const aim = player.gunAim;

    this.gunSprite.setPosition(
      this.arenaOriginX + pivot.x,
      this.arenaOriginY + pivot.y,
    );
    this.gunSprite.setAngle(aim.rotationDeg);
    // Flash `_yscale = -100` when aiming left. Use flipY — do NOT setScale,
    // which would wipe setDisplaySize on the atlas Image (#34 lead review).
    this.gunSprite.setFlipY(aim.flipY);

    this.muzzleSprite.setPosition(
      this.arenaOriginX + player.muzzle.x,
      this.arenaOriginY + player.muzzle.y,
    );
    this.muzzleSprite.setAngle(aim.rotationDeg);
    // Brief flash while reloadTime is still near zero after a shot.
    const firing =
      this.session.playerHealth.alive && this.session.weapon.reloadTime < 3;
    this.muzzleSprite.setVisible(firing);
  }

  private createBulletVisuals(): void {
    this.bulletSprites = [];
    const playerDef = getSpriteDef(BULLET_PLAYER_FRAME);
    for (let i = 0; i < this.session.bullets.capacity; i += 1) {
      this.bulletSprites.push(
        this.add
          .image(0, 0, ATLAS_KEY, BULLET_PLAYER_FRAME)
          .setOrigin(playerDef.pivot.x, playerDef.pivot.y)
          .setDisplaySize(playerDef.originalW, playerDef.originalH)
          .setDepth(15)
          .setVisible(false),
      );
    }
    this.enemyBulletSprites = [];
    const enemyDef = getSpriteDef(BULLET_ENEMY_FRAME);
    for (let i = 0; i < this.session.enemyBullets.capacity; i += 1) {
      this.enemyBulletSprites.push(
        this.add
          .image(0, 0, ATLAS_KEY, BULLET_ENEMY_FRAME)
          .setOrigin(enemyDef.pivot.x, enemyDef.pivot.y)
          .setDisplaySize(enemyDef.originalW, enemyDef.originalH)
          .setDepth(15)
          .setVisible(false),
      );
    }
  }

  private syncBulletVisuals(): void {
    const slots = this.session.bullets.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const bullet = slots[i]!;
      const sprite = this.bulletSprites[i]!;
      if (!bullet.active) {
        sprite.setVisible(false);
        continue;
      }
      sprite.setVisible(true);
      sprite.setPosition(
        this.arenaOriginX + bullet.x,
        this.arenaOriginY + bullet.y,
      );
      sprite.setAngle((Math.atan2(bullet.vy, bullet.vx) * 180) / Math.PI);
    }
  }

  private syncEnemyBulletVisuals(): void {
    const slots = this.session.enemyBullets.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const bullet = slots[i]!;
      const sprite = this.enemyBulletSprites[i]!;
      if (!bullet.active) {
        sprite.setVisible(false);
        continue;
      }
      sprite.setVisible(true);
      sprite.setPosition(
        this.arenaOriginX + bullet.x,
        this.arenaOriginY + bullet.y,
      );
      sprite.setAngle((Math.atan2(bullet.vy, bullet.vx) * 180) / Math.PI);
    }
  }

  private createHeliVisual(): void {
    // Pool sized for max concurrent + a couple spare explosion slots (#19).
    const heliPool = 8;
    const boomPool = 8;
    const def = getSpriteDef('heli');
    const place = placeOnCenter(0, 0, def.pivot, {
      w: def.originalW,
      h: def.originalH,
    });
    this.heliSprites = [];
    for (let i = 0; i < heliPool; i += 1) {
      this.heliSprites.push(
        this.add
          .image(0, 0, ATLAS_KEY, 'heli')
          .setOrigin(place.originX, place.originY)
          .setDisplaySize(place.displayW, place.displayH)
          .setVisible(false),
      );
    }
    const boomDef = getSpriteDef(EXPLOSION_FRAME);
    const boomDraw = gameDrawSize(boomDef);
    this.explosionSprites = [];
    for (let i = 0; i < boomPool; i += 1) {
      this.explosionSprites.push(
        this.add
          .image(0, 0, ATLAS_KEY, EXPLOSION_FRAME)
          .setOrigin(boomDef.pivot.x, boomDef.pivot.y)
          .setDisplaySize(boomDraw.w, boomDraw.h)
          .setDepth(25)
          .setVisible(false),
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
      const frame = flashing ? HELI_HIT_FRAME : heliFrameForLook(heli.look);
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
      // Hit flash uses the dedicated white frame; look variants are redrawn.
      sprite.clearTint();
    }

    const booms = this.session.explosions;
    const boomBase = gameDrawSize(getSpriteDef(EXPLOSION_FRAME));
    for (let i = 0; i < this.explosionSprites.length; i += 1) {
      const sprite = this.explosionSprites[i]!;
      const boom = booms[i];
      if (!boom || !boom.active) {
        sprite.setVisible(false);
        continue;
      }
      // Grow via setDisplaySize — setScale would wipe the 120px base and draw
      // the 748×744 texture at native size (#34 lead review).
      const grow = explosionAgeScale(boom.age, boom.maxAge);
      const size = scaledDisplaySize(boomBase.w, boomBase.h, grow);
      sprite.setVisible(true);
      sprite.setPosition(
        this.arenaOriginX + boom.x,
        this.arenaOriginY + boom.y,
      );
      sprite.setDisplaySize(size.w, size.h);
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
