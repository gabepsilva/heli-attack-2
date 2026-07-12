/**
 * Discrete particle FX cues queued by the sim (issue #35).
 * Phaser-free — GameScene drains via {@link ParticleFxQueue} and feeds
 * pooled emitters. Builders encode Flash kill/impact/muzzle/smoke/debris
 * composition so unit tests can assert exact burst counts.
 */

import {
  PARTICLE_FX,
  SMOKE_TRAIL_WEAPONS,
  type ParticleFxKind,
} from '../config/particles';
import { POWERUP } from '../config/constants';

/** One burst request for a pooled emitter. */
export type ParticleFxEvent = Readonly<{
  kind: ParticleFxKind;
  x: number;
  y: number;
  /** Particles to explode; defaults come from {@link burstForKind}. */
  count: number;
  /** Optional aim angle (degrees) for directional muzzle sparks. */
  angleDeg?: number;
}>;

/** Particles one event of `kind` emits by default. */
export function burstForKind(kind: ParticleFxKind): number {
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

function event(
  kind: ParticleFxKind,
  x: number,
  y: number,
  count: number = burstForKind(kind),
  angleDeg?: number,
): ParticleFxEvent {
  return angleDeg === undefined
    ? { kind, x, y, count }
    : { kind, x, y, count, angleDeg };
}

/**
 * Flash heli kill VFX particles — smoke plume only.
 * Boom sprite + bouncing shards + falling wreck/pilot are sim entities
 * ({@link spawnHeliDeathEntities}), not particle bursts.
 */
export function buildKillFx(x: number, y: number): ParticleFxEvent[] {
  return [event('smoke', x, y, PARTICLE_FX.killSmokeBurst)];
}

/** Non-fatal bullet-on-heli impact sparks. */
export function buildImpactFx(x: number, y: number): ParticleFxEvent[] {
  return [event('impact', x, y, PARTICLE_FX.impactBurst)];
}

/** Muzzle flash sparks at the barrel tip. */
export function buildMuzzleFx(
  x: number,
  y: number,
  angleDeg: number,
): ParticleFxEvent[] {
  return [event('muzzle', x, y, PARTICLE_FX.muzzleBurst, angleDeg)];
}

/** Single smoke puff (rocket trail tick / jetpack). */
export function buildSmokeFx(x: number, y: number): ParticleFxEvent[] {
  return [event('smoke', x, y, PARTICLE_FX.smokeBurst)];
}

/** Flash player-hurt blood: 3 clips. */
export function buildBloodFx(x: number, y: number): ParticleFxEvent[] {
  return [event('blood', x, y, PARTICLE_FX.bloodBurst)];
}

/** Smoke trail interval for an arsenal index, or 0 when none. */
export function smokeTrailIntervalForWeapon(weaponIndex: number): number {
  return SMOKE_TRAIL_WEAPONS[weaponIndex] ?? 0;
}

/**
 * True when jetpack powerup should emit a smoke puff this move frame.
 * Flash: `(smok++%5)==0` while jumping under powerupOn==5.
 */
export function shouldEmitJetpackSmoke(
  powerupOn: number,
  jumping: boolean,
  frameCounter: number,
  interval: number = PARTICLE_FX.smokeTrailIntervalJetpack,
): boolean {
  if (powerupOn !== POWERUP.Jetpack || !jumping || interval <= 0) {
    return false;
  }
  return frameCounter % interval === 0;
}
