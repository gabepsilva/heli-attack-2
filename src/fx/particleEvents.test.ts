/**
 * Issue #35 acceptance: kills and impacts produce distinct particle FX events
 * with exact burst counts; builders stay Phaser-free and unit-testable.
 */

import { describe, expect, it } from 'vitest';
import { POWERUP } from '../config/constants';
import { PARTICLE_FX as FX } from '../config/particles';
import {
  buildBloodFx,
  buildImpactFx,
  buildKillFx,
  buildMuzzleFx,
  buildSmokeFx,
  burstForKind,
  shouldEmitJetpackSmoke,
  smokeTrailIntervalForWeapon,
} from './particleEvents';
import {
  allEmitterSpecs,
  emitterSpecFor,
  PARTICLE_FX_KINDS,
} from './particleEmitterSpec';
import { shouldEmitSmokeTrail } from './smokeTrail';

describe('fx/particleEvents (#35)', () => {
  it('kill FX is smoke plume — boom/shards/wreck are sim entities', () => {
    const kill = buildKillFx(100, 200);
    expect(kill).toEqual([
      { kind: 'smoke', x: 100, y: 200, count: FX.killSmokeBurst },
    ]);

    const impact = buildImpactFx(50, 60);
    expect(impact).toEqual([
      { kind: 'impact', x: 50, y: 60, count: FX.impactBurst },
    ]);
    // Distinct kinds — kill never emits 'impact', impact never emits 'smoke'.
    expect(kill.map((e) => e.kind)).not.toContain('impact');
    expect(impact.map((e) => e.kind)).not.toContain('smoke');
  });

  it('muzzle / smoke / blood builders use Flash-accurate counts', () => {
    expect(buildMuzzleFx(10, 20, 45)).toEqual([
      { kind: 'muzzle', x: 10, y: 20, count: FX.muzzleBurst, angleDeg: 45 },
    ]);
    expect(buildSmokeFx(1, 2)).toEqual([
      { kind: 'smoke', x: 1, y: 2, count: FX.smokeBurst },
    ]);
    expect(buildBloodFx(3, 4)).toEqual([
      { kind: 'blood', x: 3, y: 4, count: FX.bloodBurst },
    ]);
    expect(FX.bloodBurst).toBe(3);
  });

  it('burstForKind matches PARTICLE_FX for every emitter kind', () => {
    expect(burstForKind('explosion')).toBe(FX.explosionBurst);
    expect(burstForKind('impact')).toBe(FX.impactBurst);
    expect(burstForKind('smoke')).toBe(FX.smokeBurst);
    expect(burstForKind('debris')).toBe(FX.debrisBurst);
    expect(burstForKind('muzzle')).toBe(FX.muzzleBurst);
    expect(burstForKind('blood')).toBe(FX.bloodBurst);
  });

  it('smoke trail intervals match Flash rocket cadences', () => {
    expect(smokeTrailIntervalForWeapon(3)).toBe(4);
    expect(smokeTrailIntervalForWeapon(6)).toBe(2);
    expect(smokeTrailIntervalForWeapon(7)).toBe(2);
    expect(smokeTrailIntervalForWeapon(0)).toBe(0);
  });

  it('jetpack smoke fires every 5 frames while jumping under Jetpack', () => {
    expect(shouldEmitJetpackSmoke(POWERUP.Jetpack, true, 0)).toBe(true);
    expect(shouldEmitJetpackSmoke(POWERUP.Jetpack, true, 5)).toBe(true);
    expect(shouldEmitJetpackSmoke(POWERUP.Jetpack, true, 1)).toBe(false);
    expect(shouldEmitJetpackSmoke(POWERUP.Jetpack, false, 0)).toBe(false);
    expect(shouldEmitJetpackSmoke(0, true, 0)).toBe(false);
    expect(FX.smokeTrailIntervalJetpack).toBe(5);
  });
});

describe('fx/smokeTrail (#35)', () => {
  it('emits on Flash !(r%N) boundaries after age advances', () => {
    expect(shouldEmitSmokeTrail(2, 1, 2)).toBe(true);
    expect(shouldEmitSmokeTrail(1, 1, 2)).toBe(false);
    expect(shouldEmitSmokeTrail(4, 1, 4)).toBe(true);
    expect(shouldEmitSmokeTrail(3, 1, 4)).toBe(false);
    expect(shouldEmitSmokeTrail(0, 1, 2)).toBe(false);
    expect(shouldEmitSmokeTrail(2, 1, 0)).toBe(false);
  });
});

describe('fx/particleEmitterSpec (#35)', () => {
  it('builds one on-demand emitter spec per kind with hard maxParticles', () => {
    expect(PARTICLE_FX_KINDS).toEqual([
      'explosion',
      'impact',
      'smoke',
      'debris',
      'muzzle',
      'blood',
    ]);
    const specs = allEmitterSpecs();
    expect(specs).toHaveLength(6);
    for (const spec of specs) {
      expect(spec.maxParticles).toBeGreaterThan(0);
      expect(spec.frequency).toBe(-1);
      expect(spec.emitting).toBe(false);
      expect(spec.textureKey).toBe('game-atlas');
      expect(spec.lifespanMs).toBeGreaterThan(0);
    }
    expect(emitterSpecFor('explosion').maxParticles).toBe(
      FX.explosionMaxParticles,
    );
    expect(emitterSpecFor('explosion').burst).toBe(FX.explosionBurst);
    expect(emitterSpecFor('debris').gravityY).toBe(FX.debrisGravityY);
    expect(emitterSpecFor('muzzle').blendMode).toBe('ADD');
    expect(emitterSpecFor('smoke').blendMode).toBe('NORMAL');
    expect(emitterSpecFor('explosion').lifespanMs).toBe(FX.explosionLifespanMs);
  });
});
