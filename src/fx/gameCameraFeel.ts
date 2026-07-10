/**
 * Applies camera-feel juice in Phaser (issue #36): screen shake, hit flash,
 * hit-stop freeze clock, damage vignette, and subtle aim/velocity lead.
 *
 * Sim queues {@link CameraFeelEvent}s; this class drains them each frame and
 * drives `cameras.main`. Intensity comes from {@link loadCameraFeelIntensity}.
 */

import type Phaser from 'phaser';
import {
  CAMERA_FEEL,
  cameraFeelEnabled,
  cameraLeadTarget,
  easeCameraLead,
  hitFlashMsForDamage,
  hitStopMsForDamage,
  hurtFlashMs,
  shakeDurationMsForDamage,
  shakeIntensityForDamage,
  vignetteStrengthIdle,
  vignetteStrengthOnHurt,
  type CameraFeelIntensity,
} from '../config/cameraFeel';
import type { CameraFeelEvent } from './cameraFeelEvents';
import {
  loadCameraFeelIntensity,
  saveCameraFeelIntensity,
} from './cameraFeelPrefs';

export type GameCameraFeelOptions = {
  scene: Phaser.Scene;
  intensity?: CameraFeelIntensity;
};

/**
 * Presentation-side camera juice. Create once in GameScene.create(); call
 * {@link consume} after each sim drain and {@link update} every render frame.
 */
export class GameCameraFeel {
  private readonly scene: Phaser.Scene;
  private intensity: CameraFeelIntensity;
  private hitStopRemainingMs = 0;
  private leadX = 0;
  private leadY = 0;
  private vignette: Phaser.Filters.Vignette | null = null;
  private vignettePulse = 0;

  constructor(options: GameCameraFeelOptions) {
    this.scene = options.scene;
    this.intensity = options.intensity ?? loadCameraFeelIntensity();
    this.ensureVignette();
    this.applyIdleVignette();
  }

  getIntensity(): CameraFeelIntensity {
    return this.intensity;
  }

  /** Update intensity and persist; reapplies idle vignette. */
  setIntensity(intensity: CameraFeelIntensity): void {
    this.intensity = intensity;
    saveCameraFeelIntensity(intensity);
    if (!cameraFeelEnabled(intensity)) {
      this.hitStopRemainingMs = 0;
      this.leadX = 0;
      this.leadY = 0;
      this.vignettePulse = 0;
      this.scene.cameras.main.setScroll(0, 0);
    }
    this.applyIdleVignette();
  }

  /** True while a hit-stop freeze should pause the sim. */
  isHitStopping(): boolean {
    return this.hitStopRemainingMs > 0;
  }

  /** Remaining hit-stop ms (tests / debug). */
  getHitStopRemainingMs(): number {
    return this.hitStopRemainingMs;
  }

  getLead(): Readonly<{ x: number; y: number }> {
    return { x: this.leadX, y: this.leadY };
  }

  /**
   * Apply every queued camera-feel event (shake / flash / hit-stop / vignette).
   * Call once per render frame after {@link SimSession.drainCameraFeelEvents}.
   */
  consume(events: readonly CameraFeelEvent[]): void {
    if (!cameraFeelEnabled(this.intensity) || events.length === 0) {
      return;
    }
    const cam = this.scene.cameras.main;
    for (const event of events) {
      if (event.type === 'weaponHit') {
        const shakeI = shakeIntensityForDamage(
          event.damage,
          event.killed,
          this.intensity,
        );
        const shakeMs = shakeDurationMsForDamage(
          event.damage,
          event.killed,
          this.intensity,
        );
        if (shakeI > 0 && shakeMs > 0) {
          cam.shake(shakeMs, shakeI);
        }
        const flashMs = hitFlashMsForDamage(
          event.damage,
          event.killed,
          this.intensity,
        );
        if (flashMs > 0) {
          cam.flash(
            flashMs,
            CAMERA_FEEL.hitFlashRed,
            CAMERA_FEEL.hitFlashGreen,
            CAMERA_FEEL.hitFlashBlue,
          );
        }
        const stopMs = hitStopMsForDamage(
          event.damage,
          event.killed,
          this.intensity,
        );
        if (stopMs > this.hitStopRemainingMs) {
          this.hitStopRemainingMs = stopMs;
        }
      } else if (event.type === 'playerHurt') {
        const flashMs = hurtFlashMs(this.intensity);
        if (flashMs > 0) {
          cam.flash(
            flashMs,
            CAMERA_FEEL.hurtFlashRed,
            CAMERA_FEEL.hurtFlashGreen,
            CAMERA_FEEL.hurtFlashBlue,
          );
        }
        this.vignettePulse = vignetteStrengthOnHurt(this.intensity);
        this.applyVignetteStrength(this.vignettePulse);
      }
    }
  }

  /**
   * Advance hit-stop clock, ease camera lead, and fade damage vignette.
   * Always call each render frame (including during hit-stop).
   */
  update(deltaMs: number, aimDeg: number, vx: number, vy: number): void {
    const dt = Math.max(0, deltaMs);
    if (this.hitStopRemainingMs > 0) {
      this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - dt);
    }

    if (!cameraFeelEnabled(this.intensity)) {
      this.scene.cameras.main.setScroll(0, 0);
      return;
    }

    const target = cameraLeadTarget(aimDeg, vx, vy, this.intensity);
    const eased = easeCameraLead(
      this.leadX,
      this.leadY,
      target.x,
      target.y,
      dt / 1000,
      this.intensity,
    );
    this.leadX = eased.x;
    this.leadY = eased.y;
    this.scene.cameras.main.setScroll(this.leadX, this.leadY);

    if (this.vignettePulse > 0) {
      const idle = vignetteStrengthIdle(this.intensity);
      const fade = dt / CAMERA_FEEL.vignetteFadeMs;
      this.vignettePulse = Math.max(
        idle,
        this.vignettePulse - fade * (this.vignettePulse - idle + 0.001),
      );
      if (this.vignettePulse <= idle + 0.001) {
        this.vignettePulse = 0;
        this.applyIdleVignette();
      } else {
        this.applyVignetteStrength(this.vignettePulse);
      }
    }
  }

  destroy(): void {
    this.hitStopRemainingMs = 0;
    if (this.vignette) {
      this.scene.cameras.main.filters.external.remove(this.vignette);
      this.vignette = null;
    }
    this.scene.cameras.main.setScroll(0, 0);
  }

  private ensureVignette(): void {
    if (this.vignette) {
      return;
    }
    const cam = this.scene.cameras.main;
    this.vignette = cam.filters.external.addVignette(
      0.5,
      0.5,
      CAMERA_FEEL.vignetteRadius,
      0,
      CAMERA_FEEL.vignetteHurtColor,
    );
  }

  private applyIdleVignette(): void {
    this.applyVignetteStrength(vignetteStrengthIdle(this.intensity));
  }

  private applyVignetteStrength(strength: number): void {
    this.ensureVignette();
    if (this.vignette) {
      this.vignette.strength = strength;
      this.vignette.setColor(CAMERA_FEEL.vignetteHurtColor);
    }
  }
}
