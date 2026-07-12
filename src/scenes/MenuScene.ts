import Phaser from 'phaser';
import {
  BG_IMAGE_KEY,
  BULLET_ENEMY_FRAME,
  ENEMY_GUY_FRAME,
  HELI_FRAME,
  MACHINEGUN_FRAME,
  TITLE_IMAGE_KEY,
} from '../config/art';
import { GUN } from '../config/constants';
import { BOOT_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { SCENE_KEYS } from '../config/scenes';
import { getGameAudio } from '../audio/gameAudio';
import {
  formatHighScoreHud,
  formatHighScoreTableText,
  loadHighScores,
} from '../core/highScores';
import { addAtlasImage } from './atlasSprite';
import {
  createMenuHeliAmbience,
  menuHeliGunnerPose,
  menuHeliGunPose,
  stepMenuHeliAmbience,
  type MenuHeliAmbienceState,
} from './menuHeliAmbience';

/** Longest frame the ambience sim will absorb before it stops catching up. */
const MAX_MENU_DELTA_SEC = 0.05;

/**
 * Ambience heli stack, all behind the title plate (-10) and text panel (-5).
 * The gunner's body is sandwiched between the hull he stands in and the gun he
 * holds, so the depths have to interleave rather than sit on integers.
 */
const HELI_HULL_DEPTH = -9;
const HELI_GUNNER_DEPTH = -8.5;
const HELI_GUN_DEPTH = -8;
const HELI_BULLET_DEPTH = -7;

/**
 * Main menu — issues #24 / #25 / #27.
 * Boot loads assets then lands here; Space / click starts a fresh run,
 * unlocks audio, and preloads the full SFX/music catalog. Shows Flash
 * `bg.png` + transparent `title.png` stacked (original intro/menu plates),
 * the loading-screen door-gunner heli (Flash timeline frames 7–14), a dark
 * text panel (Flash menu button backs), and the local high-score table.
 */
export class MenuScene extends Phaser.Scene {
  private heliAmbience!: MenuHeliAmbienceState;
  private heliSprite!: Phaser.GameObjects.Image;
  private heliGunnerSprite!: Phaser.GameObjects.Image;
  private heliGunSprite!: Phaser.GameObjects.Image;
  private cosmeticBulletSprites: Phaser.GameObjects.Image[] = [];
  private starting = false;

  constructor() {
    super({ key: SCENE_KEYS.Menu });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOOT_BACKGROUND_COLOR);
    this.starting = false;

    const table = loadHighScores();

    // Flash intro/menu: full-bleed desert plate, then title overlay on top.
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_IMAGE_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-11);
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TITLE_IMAGE_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10);

    this.createMenuHeli();

    // Flash menu buttons sat on near-black backs (SWF DefineBitsLossless2
    // id419/id427 — solid black with soft alpha edges). One panel behind our
    // text stack keeps START / scores readable over the bright desert + heli.
    this.add
      .rectangle(GAME_WIDTH / 2, 520, 720, 560, 0x000000, 0.55)
      .setDepth(-5);

    this.add
      .text(GAME_WIDTH / 2, 280, 'START', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 360, 'Press SPACE or click to play', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 460, formatHighScoreHud(table.stats.bestScore), {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffe066',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 530, 'HIGH SCORES', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#c9ada7',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 580, formatHighScoreTableText(table), {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f5f5f5',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 80,
        'F fullscreen · Phone: landscape + on-screen sticks · P / Esc pause',
        {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#6a7a8a',
        },
      )
      .setOrigin(0.5);

    const start = (): void => {
      if (this.starting) return;
      this.starting = true;
      const audio = getGameAudio();
      void audio.unlock().then(async () => {
        try {
          await audio.loadAll();
        } catch {
          // GameScene retries; partial loads still unlock the bus.
        }
        this.scene.start(SCENE_KEYS.Game);
      });
    };

    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }

  update(_time: number, delta: number): void {
    if (this.starting) return;
    const pointer = this.input.activePointer;
    stepMenuHeliAmbience(
      this.heliAmbience,
      pointer.worldX,
      pointer.worldY,
      Math.min(MAX_MENU_DELTA_SEC, delta / 1000),
    );
    this.drawMenuHeli();
  }

  private createMenuHeli(): void {
    this.heliAmbience = createMenuHeliAmbience();
    this.heliSprite = addAtlasImage(this, HELI_FRAME).setDepth(HELI_HULL_DEPTH);
    this.heliGunnerSprite = addAtlasImage(this, ENEMY_GUY_FRAME).setDepth(
      HELI_GUNNER_DEPTH,
    );
    this.heliGunSprite = addAtlasImage(this, MACHINEGUN_FRAME, {
      w: GUN.spriteW,
      h: GUN.spriteH,
    }).setDepth(HELI_GUN_DEPTH);
    this.cosmeticBulletSprites = this.heliAmbience.bullets.map(() =>
      addAtlasImage(this, BULLET_ENEMY_FRAME)
        .setDepth(HELI_BULLET_DEPTH)
        .setVisible(false),
    );

    this.drawMenuHeli();
  }

  /** Sprites follow the ambience sim; menu space is screen space (no arena origin). */
  private drawMenuHeli(): void {
    const { heli, bullets } = this.heliAmbience;
    this.heliSprite.setPosition(heli.x, heli.y);
    this.heliSprite.setAngle(heli.rotationDeg);

    const gunner = menuHeliGunnerPose(this.heliAmbience);
    this.heliGunnerSprite.setPosition(gunner.x, gunner.y);
    this.heliGunnerSprite.setAngle(gunner.rotationDeg);

    const gun = menuHeliGunPose(this.heliAmbience);
    this.heliGunSprite.setPosition(gun.x, gun.y);
    this.heliGunSprite.setAngle(gun.rotationDeg);
    this.heliGunSprite.setFlipY(gun.flipY);

    for (let i = 0; i < this.cosmeticBulletSprites.length; i += 1) {
      const sprite = this.cosmeticBulletSprites[i]!;
      const bullet = bullets[i]!;
      sprite.setVisible(bullet.active);
      if (!bullet.active) {
        continue;
      }
      sprite.setPosition(bullet.x, bullet.y);
      sprite.setAngle(bullet.rotationDeg);
    }
  }
}
