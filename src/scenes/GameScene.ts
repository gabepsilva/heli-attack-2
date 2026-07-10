import Phaser from 'phaser';
import { PLAYER, SIM_HZ, WORLD } from '../config/constants';
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
const PLAYER_COLOR = 0x90be6d;
const PLAYER_STROKE = 0xd8f3dc;

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * original level layout (placeholder tiles), hosts a controllable player
 * (←/→ walk), and a draggable debug box. Game logic lives in plain modules
 * under src/.
 *
 * The debug overlay (#8) is a DOM panel outside Phaser so it can host real
 * `<input>` controls for live physics tuning and toggle off for clean demos.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();

  private boxRect!: Phaser.GameObjects.Rectangle;
  private playerRect!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
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
    this.createDebugBoxVisual();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.boostKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.CTRL,
    );

    this.add
      .text(GAME_WIDTH / 2, 28, '↑ jump · Ctrl boost · ↓ duck · ←/→ walk', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add.text(
      40,
      GAME_HEIGHT - 60,
      '←/→ walk · ↑ jump · Ctrl boost · ↓ duck · drag box · ` debug · 1/2 timeStep · Esc → Boot',
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#9ab',
      },
    );

    this.input.keyboard?.on('keydown-ONE', () => {
      this.session.timeScale.setTimeStep(1);
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      this.session.timeScale.setTimeStep(0.5);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.Boot);
    });
    // Backtick / tilde key — toggle overlay for clean demos (issue #8).
    this.input.keyboard?.on('keydown-BACKTICK', () => {
      this.overlay?.toggle();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = null;
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

    this.session.update(delta);

    const p = this.session.player.body;
    const pl = this.session.player;
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
    });

    this.syncPlayerVisual();
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
    const p = this.session.player.body;
    this.playerRect = this.add
      .rectangle(
        this.arenaOriginX + p.x + p.w / 2,
        this.arenaOriginY + p.y + p.h / 2,
        PLAYER.boxW,
        PLAYER.boxH,
        PLAYER_COLOR,
      )
      .setStrokeStyle(2, PLAYER_STROKE);
  }

  private syncPlayerVisual(): void {
    const p = this.session.player.body;
    this.playerRect.setPosition(
      this.arenaOriginX + p.x + p.w / 2,
      this.arenaOriginY + p.y + p.h / 2,
    );
    this.playerRect.setSize(p.w, p.h);
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
