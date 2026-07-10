import Phaser from 'phaser';
import { GUN, PLAYER, SIM_HZ, WORLD } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { SimSession } from '../core/simSession';
import { DEBUG_BOX_SIZE } from '../world/debugBox';
import {
  TEST_ARENA_HEIGHT_PX,
  TEST_ARENA_WIDTH_PX,
  isArenaSolid,
} from '../world/testArena';

const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '22px',
  color: '#e8e8e8',
};

const TILE_COLOR = 0x3d5a80;
const BOX_COLOR = 0xe09f3e;
const BOX_DRAG_COLOR = 0xf4a261;
const PLAYER_COLOR = 0x90be6d;
const PLAYER_STROKE = 0xd8f3dc;
const GUN_COLOR = 0xc9ada7;
const GUN_STROKE = 0xf2e9e4;
const MUZZLE_COLOR = 0xff6b6b;

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * hand-authored tile arena, hosts a controllable player (←/→ walk + mouse aim),
 * and a draggable debug box. Game logic lives in plain modules under src/.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();

  private rateText!: Phaser.GameObjects.Text;
  private timeStepText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private aimText!: Phaser.GameObjects.Text;
  private boxText!: Phaser.GameObjects.Text;
  private boxRect!: Phaser.GameObjects.Rectangle;
  private playerRect!: Phaser.GameObjects.Rectangle;
  private gunRect!: Phaser.GameObjects.Rectangle;
  private muzzleDot!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private arenaOriginX = 0;
  private arenaOriginY = 0;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  create(): void {
    // Phaser reuses this instance across scene.start — only create() re-runs.
    this.session.reset();

    this.cameras.main.setBackgroundColor('#0d1b2a');

    this.arenaOriginX = Math.floor((GAME_WIDTH - TEST_ARENA_WIDTH_PX) / 2);
    this.arenaOriginY =
      Math.floor((GAME_HEIGHT - TEST_ARENA_HEIGHT_PX) / 2) - 40;

    this.drawArena();
    this.createPlayerVisual();
    this.createGunVisual();
    this.createDebugBoxVisual();

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.add
      .text(GAME_WIDTH / 2, 28, 'Walk ←/→ · aim with mouse', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.rateText = this.add.text(40, 70, '', HUD_STYLE);
    this.timeStepText = this.add.text(40, 98, '', HUD_STYLE);
    this.playerText = this.add.text(40, 126, '', HUD_STYLE);
    this.aimText = this.add.text(40, 154, '', HUD_STYLE);
    this.boxText = this.add.text(40, 182, '', HUD_STYLE);

    this.add.text(
      40,
      GAME_HEIGHT - 60,
      '←/→ walk · mouse aim · drag box · 1/2 = timeStep 1.0/0.5 · Esc → BootScene',
      { ...HUD_STYLE, fontSize: '20px', color: '#9ab' },
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
  }

  update(_time: number, delta: number): void {
    this.session.player.input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
    };
    this.session.player.mouse = {
      x: this.input.activePointer.worldX - this.arenaOriginX,
      y: this.input.activePointer.worldY - this.arenaOriginY,
    };

    this.session.update(delta);

    this.rateText.setText(
      `Sim rate: ${this.session.displayedSimRate.toFixed(1)} /s  (target ${SIM_HZ})`,
    );
    this.timeStepText.setText(
      `timeStep: ${this.session.timeScale.timeStep.toFixed(2)}`,
    );
    const p = this.session.player.body;
    this.playerText.setText(
      `player vx=${p.vx.toFixed(0)}  vy=${p.vy.toFixed(1)}  ` +
        `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})  ` +
        `${p.onGround ? 'grounded' : 'air'}  ` +
        `cap±${PLAYER.walkCap}/hard±${PLAYER.hardCap}`,
    );
    const aim = this.session.player.gunAim;
    const muzzle = this.session.player.muzzle;
    this.aimText.setText(
      `aim ${aim.rotationDeg.toFixed(0)}°  ` +
        `${aim.flipY ? 'flipY' : 'upright'}  ` +
        `muzzle (${muzzle.x.toFixed(0)}, ${muzzle.y.toFixed(0)})`,
    );
    const b = this.session.debugBox.body;
    this.boxText.setText(
      `box (${b.x.toFixed(0)}, ${b.y.toFixed(0)})  vy=${b.vy.toFixed(1)}  ${b.onGround ? 'grounded' : 'air'}`,
    );

    this.syncPlayerVisual();
    this.syncGunVisual();
    this.syncBoxVisual();
  }

  private drawArena(): void {
    const map = this.session.map;
    const g = this.add.graphics();
    g.fillStyle(TILE_COLOR, 1);

    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (!isArenaSolid(map, col, row)) {
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
        if (!isArenaSolid(map, col, row)) {
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
