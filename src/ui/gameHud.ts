/**
 * Phaser view for the in-game HUD (#23 / #105 / #106).
 *
 * Thin renderer over {@link buildHudSnapshot} — all meter math lives in hud.ts.
 * Anchored to the 1920×1080 design resolution via {@link HUD_LAYOUT}; scroll
 * factor 0 so the HUD stays fixed while the camera follows play.
 *
 * Bottom-right cluster matches Flash `HUD.weapon` + `HUD.ammo` places (#105).
 * Bottom meters match Flash order/positions: hyper-jump → bullet-time → reload (#106).
 */

import type Phaser from 'phaser';
import { ATLAS_KEY } from '../config/art';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { HUD_LAYOUT, weaponHudIconDisplaySize, type HudSnapshot } from './hud';

/**
 * Meter fills are the mean opaque colour of each Flash bar's bitmap fill,
 * sampled from `heli2.swf` (the originals are gradient-textured, we draw flat).
 * The rest of the palette is ours — Flash had no equivalent chrome.
 */
const COLORS = {
  panel: 0x1b263b,
  panelStroke: 0x415a77,
  /** Flash `HUD.health` fill (bitmap 174). */
  health: 0xfd755d,
  healthDead: 0xe63946,
  healthLabel: '#7dcfb6',
  healthDeadLabel: '#e63946',
  score: '#ffe066',
  ammo: '#ffffff',
  ammoShadow: '#000000',
  /** Flash `HUD.reload` fill (bitmap 151) — shown while charging. */
  reload: 0xf87931,
  /** Flash `HUD.reload.yellow` overlay (bitmap 153) — shown when ready to fire. */
  reloadReady: 0xf8b827,
  /** Flash `HUD.hyperjump` fill (bitmap 161). */
  hyperJump: 0x4b9292,
  /** Flash `HUD.bullettime` fill (bitmap 164). */
  bulletTime: 0x74b624,
  powerup: 0xf72585,
  powerupLabel: '#f72585',
  death: '#e63946',
  meterLabel: '#adb5bd',
} as const;

type MeterBar = {
  fill: Phaser.GameObjects.Rectangle;
  width: number;
  height: number;
};

/**
 * Creates and syncs all in-game HUD visuals for a Phaser scene.
 */
export class GameHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly healthLabel: Phaser.GameObjects.Text;
  private readonly healthInnerW: number;
  private readonly weaponIcon: Phaser.GameObjects.Image;
  private readonly ammoText: Phaser.GameObjects.Text;
  private readonly reload: MeterBar;
  private readonly hyperJump: MeterBar;
  private readonly bulletTime: MeterBar;
  private readonly powerupRoot: Phaser.GameObjects.Container;
  private readonly powerupFill: Phaser.GameObjects.Rectangle;
  private readonly powerupLabel: Phaser.GameObjects.Text;
  private readonly powerupInnerW: number;
  private readonly deathText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const L = HUD_LAYOUT;
    const depth = L.depth;

    // --- Health ---
    const hx = L.health.x;
    const hy = L.health.y;
    scene.add
      .rectangle(hx, hy, L.health.width, L.health.height, COLORS.panel)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.panelStroke)
      .setScrollFactor(0)
      .setDepth(depth);
    this.healthInnerW = L.health.width - 4;
    this.healthFill = scene.add
      .rectangle(
        hx + 2,
        hy + 2,
        this.healthInnerW,
        L.health.height - 4,
        COLORS.health,
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    this.healthLabel = scene.add
      .text(hx, hy + L.health.height + L.health.labelGap, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: COLORS.healthLabel,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    // --- Score (top-right) ---
    this.scoreText = scene.add
      .text(L.score.x, L.score.y, '', {
        fontFamily: 'monospace',
        fontSize: `${L.score.fontSize}px`,
        color: COLORS.score,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    // --- Weapon crate + ammo (Flash bottom-right; ammo left, right-aligned) ---
    const iconSize = weaponHudIconDisplaySize();
    this.weaponIcon = scene.add
      .image(L.weapon.x, L.weapon.y, ATLAS_KEY, 'powermachinegun')
      .setOrigin(0, 0)
      .setDisplaySize(iconSize.w, iconSize.h)
      .setScrollFactor(0)
      .setDepth(depth);
    // Origin (1, 0): Flash right-aligns the field and lays its line out from
    // the top, so the count grows leftwards from the field's right edge.
    this.ammoText = scene.add
      .text(L.weapon.ammoRightX, L.weapon.ammoTopY, '', {
        fontFamily: 'monospace',
        fontSize: `${L.weapon.ammoFontSize}px`,
        color: COLORS.ammo,
      })
      .setOrigin(1, 0)
      .setShadow(
        L.weapon.ammoShadowDx,
        L.weapon.ammoShadowDy,
        COLORS.ammoShadow,
        0,
        false,
        true,
      )
      .setScrollFactor(0)
      .setDepth(depth);

    // --- Hyper-jump → bullet-time → reload (Flash Symbol 38 bottom row) ---
    const labelStyle = {
      fontFamily: 'monospace',
      fontSize: `${L.meters.labelFontSize}px`,
      color: COLORS.meterLabel,
    } as const;

    scene.add
      .text(
        L.meters.hyperJumpLabelX,
        L.meters.labelY,
        L.meters.hyperJumpLabel,
        labelStyle,
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(depth);
    this.hyperJump = this.createMeter(
      scene,
      L.meters.hyperJumpX,
      L.meters.y,
      L.meters.width,
      L.meters.height,
      COLORS.hyperJump,
      depth,
    );

    scene.add
      .text(
        L.meters.bulletTimeLabelX,
        L.meters.labelY,
        L.meters.bulletTimeLabel,
        labelStyle,
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(depth);
    this.bulletTime = this.createMeter(
      scene,
      L.meters.bulletTimeX,
      L.meters.y,
      L.meters.width,
      L.meters.height,
      COLORS.bulletTime,
      depth,
    );

    scene.add
      .text(
        L.meters.reloadLabelX,
        L.meters.labelY,
        L.meters.reloadLabel,
        labelStyle,
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(depth);
    this.reload = this.createMeter(
      scene,
      L.meters.reloadX,
      L.meters.y,
      L.meters.width,
      L.meters.height,
      COLORS.reload,
      depth,
    );

    // --- Powerup indicator ---
    const px = L.powerup.x;
    const py = L.powerup.y;
    this.powerupLabel = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: `${L.powerup.fontSize}px`,
        color: COLORS.powerupLabel,
      })
      .setOrigin(0, 0);
    const powerupBg = scene.add
      .rectangle(
        0,
        L.powerup.fontSize + L.powerup.labelGap,
        L.powerup.width,
        L.powerup.height,
        COLORS.panel,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.panelStroke);
    this.powerupInnerW = L.powerup.width - 4;
    this.powerupFill = scene.add
      .rectangle(
        2,
        L.powerup.fontSize + L.powerup.labelGap + 2,
        this.powerupInnerW,
        L.powerup.height - 4,
        COLORS.powerup,
      )
      .setOrigin(0, 0);
    this.powerupRoot = scene.add
      .container(px, py, [this.powerupLabel, powerupBg, this.powerupFill])
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);

    // --- Death banner ---
    this.deathText = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'YOU DIED', {
        fontFamily: 'monospace',
        fontSize: `${L.death.fontSize}px`,
        color: COLORS.death,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 10)
      .setVisible(false);
  }

  private createMeter(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    depth: number,
  ): MeterBar {
    scene.add
      .rectangle(x, y, width, height, COLORS.panel)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.panelStroke)
      .setScrollFactor(0)
      .setDepth(depth);
    const fill = scene.add
      .rectangle(x + 2, y + 2, width - 4, height - 4, fillColor)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    return { fill, width: width - 4, height: height - 4 };
  }

  /** Apply a fresh snapshot — call once per rendered frame after sim update. */
  sync(snap: HudSnapshot): void {
    this.scoreText.setText(snap.scoreText);

    this.healthFill.width = Math.max(
      0,
      this.healthInnerW * snap.healthFraction,
    );
    this.healthFill.setFillStyle(
      snap.healthAlive ? COLORS.health : COLORS.healthDead,
    );
    this.healthLabel.setText(snap.healthLabel);
    this.healthLabel.setColor(
      snap.healthAlive ? COLORS.healthLabel : COLORS.healthDeadLabel,
    );

    // Flash: HUD.weapon.gotoAndStop(cgun+1) + HUD.ammo = "Infinite x " | "N x "
    // updateOrigin=false: every power* frame carries pivot 0.5/0.5, and Phaser
    // re-applies a frame's pivot as the origin on setFrame — which would undo
    // the top-left origin below and re-centre the crate on its anchor.
    this.weaponIcon.setFrame(snap.weaponIconFrame, true, false);
    this.ammoText.setText(snap.ammoText);

    // Flash: HUD.reload.mask._xscale + HUD.reload.yellow when ready
    this.reload.fill.width = Math.max(
      0,
      this.reload.width * snap.reloadFraction,
    );
    this.reload.fill.setFillStyle(
      snap.reloadReady ? COLORS.reloadReady : COLORS.reload,
    );

    this.hyperJump.fill.width = Math.max(
      0,
      this.hyperJump.width * snap.hyperJumpFraction,
    );
    this.bulletTime.fill.width = Math.max(
      0,
      this.bulletTime.width * snap.bulletTimeFraction,
    );

    this.powerupRoot.setVisible(snap.powerupVisible);
    if (snap.powerupVisible) {
      this.powerupLabel.setText(snap.powerupName);
      this.powerupFill.width = Math.max(
        0,
        this.powerupInnerW * snap.powerupFraction,
      );
    }

    this.deathText.setVisible(snap.showDeath);
  }
}
