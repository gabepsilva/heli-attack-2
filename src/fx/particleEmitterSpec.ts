/**
 * Pure Phaser emitter config builders for pooled particle FX (issue #35).
 * Kept Phaser-free so tests assert exact lifespan / speed / scale / caps
 * without spinning up a game.
 */

import { ATLAS_KEY } from '../config/art';
import {
  PARTICLE_FX,
  PARTICLE_FX_FRAMES,
  type ParticleFxKind,
} from '../config/particles';

/** Serializable emitter settings consumed by GameParticles. */
export type ParticleEmitterSpec = Readonly<{
  kind: ParticleFxKind;
  frame: string;
  textureKey: string;
  maxParticles: number;
  lifespanMs: number;
  speedMin: number;
  speedMax: number;
  gravityY: number;
  scaleStart: number;
  scaleEnd: number;
  /** Default explode quantity for this kind. */
  burst: number;
  frequency: number;
  quantity: number;
  emitting: boolean;
  blendMode: 'ADD' | 'NORMAL';
  depth: number;
}>;

function maxParticlesFor(kind: ParticleFxKind): number {
  switch (kind) {
    case 'explosion':
      return PARTICLE_FX.explosionMaxParticles;
    case 'impact':
      return PARTICLE_FX.impactMaxParticles;
    case 'smoke':
      return PARTICLE_FX.smokeMaxParticles;
    case 'debris':
      return PARTICLE_FX.debrisMaxParticles;
    case 'muzzle':
      return PARTICLE_FX.muzzleMaxParticles;
    case 'blood':
      return PARTICLE_FX.bloodMaxParticles;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function lifespanFor(kind: ParticleFxKind): number {
  switch (kind) {
    case 'explosion':
      return PARTICLE_FX.explosionLifespanMs;
    case 'impact':
      return PARTICLE_FX.impactLifespanMs;
    case 'smoke':
      return PARTICLE_FX.smokeLifespanMs;
    case 'debris':
      return PARTICLE_FX.debrisLifespanMs;
    case 'muzzle':
      return PARTICLE_FX.muzzleLifespanMs;
    case 'blood':
      return PARTICLE_FX.bloodLifespanMs;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function speedFor(kind: ParticleFxKind): { min: number; max: number } {
  switch (kind) {
    case 'explosion':
      return {
        min: PARTICLE_FX.explosionSpeedMin,
        max: PARTICLE_FX.explosionSpeedMax,
      };
    case 'impact':
      return {
        min: PARTICLE_FX.impactSpeedMin,
        max: PARTICLE_FX.impactSpeedMax,
      };
    case 'smoke':
      return {
        min: PARTICLE_FX.smokeSpeedMin,
        max: PARTICLE_FX.smokeSpeedMax,
      };
    case 'debris':
      return {
        min: PARTICLE_FX.debrisSpeedMin,
        max: PARTICLE_FX.debrisSpeedMax,
      };
    case 'muzzle':
      return {
        min: PARTICLE_FX.muzzleSpeedMin,
        max: PARTICLE_FX.muzzleSpeedMax,
      };
    case 'blood':
      return {
        min: PARTICLE_FX.bloodSpeedMin,
        max: PARTICLE_FX.bloodSpeedMax,
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function scaleFor(kind: ParticleFxKind): { start: number; end: number } {
  switch (kind) {
    case 'explosion':
      return {
        start: PARTICLE_FX.explosionScaleStart,
        end: PARTICLE_FX.explosionScaleEnd,
      };
    case 'impact':
      return {
        start: PARTICLE_FX.impactScaleStart,
        end: PARTICLE_FX.impactScaleEnd,
      };
    case 'smoke':
      return {
        start: PARTICLE_FX.smokeScaleStart,
        end: PARTICLE_FX.smokeScaleEnd,
      };
    case 'debris':
      return {
        start: PARTICLE_FX.debrisScaleStart,
        end: PARTICLE_FX.debrisScaleEnd,
      };
    case 'muzzle':
      return {
        start: PARTICLE_FX.muzzleScaleStart,
        end: PARTICLE_FX.muzzleScaleEnd,
      };
    case 'blood':
      return {
        start: PARTICLE_FX.bloodScaleStart,
        end: PARTICLE_FX.bloodScaleEnd,
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function gravityFor(kind: ParticleFxKind): number {
  switch (kind) {
    case 'debris':
      return PARTICLE_FX.debrisGravityY;
    case 'blood':
      return PARTICLE_FX.bloodGravityY;
    case 'smoke':
      return PARTICLE_FX.smokeGravityY;
    default:
      return 0;
  }
}

function burstFor(kind: ParticleFxKind): number {
  switch (kind) {
    case 'explosion':
      return PARTICLE_FX.explosionBurst;
    case 'impact':
      return PARTICLE_FX.impactBurst;
    case 'smoke':
      return PARTICLE_FX.smokeBurst;
    case 'debris':
      return PARTICLE_FX.debrisBurst;
    case 'muzzle':
      return PARTICLE_FX.muzzleBurst;
    case 'blood':
      return PARTICLE_FX.bloodBurst;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function blendFor(kind: ParticleFxKind): 'ADD' | 'NORMAL' {
  return kind === 'explosion' || kind === 'muzzle' || kind === 'impact'
    ? 'ADD'
    : 'NORMAL';
}

/** Build the emitter spec for one FX kind. */
export function emitterSpecFor(kind: ParticleFxKind): ParticleEmitterSpec {
  const speed = speedFor(kind);
  const scale = scaleFor(kind);
  return {
    kind,
    frame: PARTICLE_FX_FRAMES[kind],
    textureKey: ATLAS_KEY,
    maxParticles: maxParticlesFor(kind),
    lifespanMs: lifespanFor(kind),
    speedMin: speed.min,
    speedMax: speed.max,
    gravityY: gravityFor(kind),
    scaleStart: scale.start,
    scaleEnd: scale.end,
    burst: burstFor(kind),
    // On-demand explode only — never continuous emit.
    frequency: -1,
    quantity: 0,
    emitting: false,
    blendMode: blendFor(kind),
    depth: PARTICLE_FX.emitterDepth,
  };
}

/** All six pooled emitter specs in a stable order. */
export const PARTICLE_FX_KINDS: readonly ParticleFxKind[] = [
  'explosion',
  'impact',
  'smoke',
  'debris',
  'muzzle',
  'blood',
] as const;

export function allEmitterSpecs(): ParticleEmitterSpec[] {
  return PARTICLE_FX_KINDS.map(emitterSpecFor);
}
