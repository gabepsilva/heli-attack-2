/**
 * Pooled Phaser particle emitters for kills, impacts, smoke, debris, muzzle,
 * and blood (issue #35). One emitter per kind with a hard maxParticles cap —
 * explode() reuses instances so heavy simultaneous load stays within budget.
 */

import type Phaser from 'phaser';
import {
  allEmitterSpecs,
  type ParticleEmitterSpec,
} from './particleEmitterSpec';
import type { ParticleFxEvent } from './particleEvents';
import type { ParticleFxKind } from '../config/particles';

export type GameParticlesOptions = {
  scene: Phaser.Scene;
  /** Arena origin in scene space (added to sim x/y). */
  originX: number;
  originY: number;
};

/**
 * Binds drained {@link ParticleFxEvent}s to pooled Phaser emitters.
 * Create once in GameScene.create(); call {@link drainAndExplode} each frame.
 */
export class GameParticles {
  private readonly originX: number;
  private readonly originY: number;
  private readonly emitters = new Map<
    ParticleFxKind,
    Phaser.GameObjects.Particles.ParticleEmitter
  >();
  private readonly specs = new Map<ParticleFxKind, ParticleEmitterSpec>();

  constructor(options: GameParticlesOptions) {
    this.originX = options.originX;
    this.originY = options.originY;
    const scene = options.scene;

    for (const spec of allEmitterSpecs()) {
      this.specs.set(spec.kind, spec);
      const emitter = scene.add.particles(0, 0, spec.textureKey, {
        frame: spec.frame,
        lifespan: spec.lifespanMs,
        speed: { min: spec.speedMin, max: spec.speedMax },
        angle: { min: 0, max: 360 },
        scale: { start: spec.scaleStart, end: spec.scaleEnd },
        alpha: { start: 1, end: 0 },
        gravityY: spec.gravityY,
        maxParticles: spec.maxParticles,
        frequency: spec.frequency,
        quantity: spec.quantity,
        emitting: spec.emitting,
        blendMode: spec.blendMode,
      });
      emitter.setDepth(spec.depth);
      // Pre-allocate the particle pool so explode under load never allocates.
      emitter.reserve(spec.maxParticles);
      this.emitters.set(spec.kind, emitter);
    }
  }

  /** Hard particle cap across all emitters (acceptance: fixed budget). */
  totalMaxParticles(): number {
    let sum = 0;
    for (const spec of this.specs.values()) {
      sum += spec.maxParticles;
    }
    return sum;
  }

  /** Emitter for tests / debug. */
  getEmitter(
    kind: ParticleFxKind,
  ): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    return this.emitters.get(kind);
  }

  /**
   * Explode every queued FX event at its world position.
   * Returns how many particles were requested (may be clamped by maxParticles).
   */
  drainAndExplode(events: readonly ParticleFxEvent[]): number {
    let requested = 0;
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i]!;
      const emitter = this.emitters.get(event.kind);
      if (!emitter) {
        continue;
      }
      const x = this.originX + event.x;
      const y = this.originY + event.y;
      if (event.angleDeg !== undefined && event.kind === 'muzzle') {
        // Cone along the barrel (±25°) instead of a full radial burst.
        emitter.setEmitterAngle({
          min: event.angleDeg - 25,
          max: event.angleDeg + 25,
        });
      } else {
        emitter.setEmitterAngle({ min: 0, max: 360 });
      }
      emitter.explode(event.count, x, y);
      requested += event.count;
    }
    return requested;
  }

  destroy(): void {
    for (const emitter of this.emitters.values()) {
      emitter.destroy();
    }
    this.emitters.clear();
  }
}
