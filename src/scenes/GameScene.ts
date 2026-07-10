import Phaser from 'phaser';
import { SIM_HZ, WORLD } from '../config/constants';
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

/**
 * Thin Phaser shell: banks render deltas into a 30 Hz fixed sim, draws the
 * hand-authored tile arena, and hosts a draggable debug box that collides
 * via the plain-module AABB resolver.
 */
export class GameScene extends Phaser.Scene {
  private readonly session = new SimSession();

  private rateText!: Phaser.GameObjects.Text;
  private timeStepText!: Phaser.GameObjects.Text;
  private boxText!: Phaser.GameObjects.Text;
  private boxRect!: Phaser.GameObjects.Rectangle;
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
    this.createDebugBoxVisual();

    this.add
      .text(GAME_WIDTH / 2, 28, 'Tile arena — drag the box, drop to collide', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.rateText = this.add.text(40, 70, '', HUD_STYLE);
    this.timeStepText = this.add.text(40, 98, '', HUD_STYLE);
    this.boxText = this.add.text(40, 126, '', HUD_STYLE);

    this.add.text(
      40,
      GAME_HEIGHT - 60,
      'Drag box to place · 1/2 = timeStep 1.0/0.5 · Esc → BootScene',
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
    this.session.update(delta);

    this.rateText.setText(
      `Sim rate: ${this.session.displayedSimRate.toFixed(1)} /s  (target ${SIM_HZ})`,
    );
    this.timeStepText.setText(
      `timeStep: ${this.session.timeScale.timeStep.toFixed(2)}`,
    );
    const b = this.session.debugBox.body;
    this.boxText.setText(
      `box (${b.x.toFixed(0)}, ${b.y.toFixed(0)})  vy=${b.vy.toFixed(1)}  ${b.onGround ? 'grounded' : 'air'}`,
    );

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
