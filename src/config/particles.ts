/**
 * Pooled particle FX tunables (issue #35).
 *
 * Burst counts and pool caps keep simultaneous kills/impacts at a fixed
 * particle budget so 60fps holds under heavy load. Flash references:
 * - heli kill: boom @ 200% + 3 shards
 * - player hurt: 3 blood clips
 * - rocket smoke: every 2 frames (seeker/rocket), every 4 (smallrocket)
 */

import type { SpriteId } from '../art/catalog';

/** Discrete particle FX kinds driven by pooled Phaser emitters. */
export type ParticleFxKind =
  'explosion' | 'impact' | 'smoke' | 'debris' | 'muzzle' | 'blood';

/** Atlas frame used by each emitter kind. */
export const PARTICLE_FX_FRAMES: Readonly<Record<ParticleFxKind, SpriteId>> = {
  explosion: 'explosion',
  impact: 'blood',
  smoke: 'smoke',
  debris: 'heli_destroyed',
  muzzle: 'muzzle_flash',
  blood: 'blood',
};

/**
 * Fixed particle budgets and burst sizes (#35).
 * `*MaxParticles` is the Phaser emitter hard cap (never grows at runtime).
 * `*Burst` is how many particles one event emits via `explode`.
 */
export const PARTICLE_FX = {
  /** Sim-side pending event ring capacity — drops oldest when full. */
  eventQueueCapacity: 128,

  // --- Emitter hard caps (alive+dead particle instances) ---
  explosionMaxParticles: 64,
  impactMaxParticles: 96,
  smokeMaxParticles: 128,
  debrisMaxParticles: 64,
  muzzleMaxParticles: 32,
  bloodMaxParticles: 48,

  // --- Particles emitted per event ---
  /** Heli-kill boom burst (hi-res explosion frame). */
  explosionBurst: 14,
  /** Bullet-on-heli impact sparks. */
  impactBurst: 6,
  /** Smoke puff (trail tick or kill plume). */
  smokeBurst: 3,
  /** Flash heli kill: 3 shards — debris particles per kill. */
  debrisBurst: 3,
  /** Muzzle flash spark burst on weapon fire. */
  muzzleBurst: 4,
  /** Flash player hurt: 3 blood clips. */
  bloodBurst: 3,
  /** Extra smoke puffs layered on a heli kill. */
  killSmokeBurst: 5,

  // --- Lifetimes (ms, Phaser particle lifespan) ---
  explosionLifespanMs: 420,
  impactLifespanMs: 220,
  smokeLifespanMs: 520,
  debrisLifespanMs: 700,
  muzzleLifespanMs: 90,
  bloodLifespanMs: 380,

  // --- Motion (px/s) ---
  explosionSpeedMin: 40,
  explosionSpeedMax: 180,
  impactSpeedMin: 60,
  impactSpeedMax: 220,
  smokeSpeedMin: 10,
  smokeSpeedMax: 60,
  debrisSpeedMin: 80,
  debrisSpeedMax: 280,
  muzzleSpeedMin: 40,
  muzzleSpeedMax: 160,
  bloodSpeedMin: 50,
  bloodSpeedMax: 200,

  /** Gravity for debris / blood (px/s²). */
  debrisGravityY: 420,
  bloodGravityY: 380,
  smokeGravityY: -40,

  // --- Scale (relative to atlas frame display) ---
  explosionScaleStart: 0.35,
  explosionScaleEnd: 1.1,
  impactScaleStart: 0.4,
  impactScaleEnd: 0.15,
  smokeScaleStart: 0.5,
  smokeScaleEnd: 1.4,
  debrisScaleStart: 0.25,
  debrisScaleEnd: 0.1,
  muzzleScaleStart: 0.7,
  muzzleScaleEnd: 0.2,
  bloodScaleStart: 0.55,
  bloodScaleEnd: 0.2,

  /**
   * Flash rocket smoke cadence: `!(r%2)` → every 2 sim frames.
   * ShotgunRockets uses `!(r%4)` → every 4.
   */
  smokeTrailIntervalRocket: 2,
  smokeTrailIntervalSmallRocket: 4,
  /** Flash jetpack: `(smok++%5)==0` while jumping. */
  smokeTrailIntervalJetpack: 5,

  /** Depth above bullets / below HUD. */
  emitterDepth: 28,
} as const;

/**
 * Arsenal indices that leave a smoke trail (Flash smoke attachMovie).
 * 3 ShotgunRockets, 5 RPG, 6 RocketLauncher, 7 Seeker, 10 A-Bomb.
 */
export const SMOKE_TRAIL_WEAPONS: Readonly<Record<number, number>> = {
  3: PARTICLE_FX.smokeTrailIntervalSmallRocket,
  5: PARTICLE_FX.smokeTrailIntervalRocket,
  6: PARTICLE_FX.smokeTrailIntervalRocket,
  7: PARTICLE_FX.smokeTrailIntervalRocket,
  10: PARTICLE_FX.smokeTrailIntervalSmallRocket,
};

/** Sum of all emitter hard caps — peak particle budget under load. */
export function particleBudgetCap(): number {
  return (
    PARTICLE_FX.explosionMaxParticles +
    PARTICLE_FX.impactMaxParticles +
    PARTICLE_FX.smokeMaxParticles +
    PARTICLE_FX.debrisMaxParticles +
    PARTICLE_FX.muzzleMaxParticles +
    PARTICLE_FX.bloodMaxParticles
  );
}
