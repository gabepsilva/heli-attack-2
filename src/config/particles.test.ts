/**
 * Issue #35 acceptance: pooled particle FX constants — exact burst counts,
 * emitter hard caps, Flash smoke/debris cadences, and a fixed particle budget
 * so 60fps holds under heavy simultaneous load.
 */

import { describe, expect, it } from 'vitest';
import {
  PARTICLE_FX,
  PARTICLE_FX_FRAMES,
  SMOKE_TRAIL_WEAPONS,
  particleBudgetCap,
  type ParticleFxKind,
} from './particles';

describe('config/particles (#35)', () => {
  it('locks Flash-accurate debris / blood / smoke cadences', () => {
    // Entity shards own the kill scrap count (HELI_DEATH.shardBurst).
    expect(PARTICLE_FX.debrisBurst).toBe(3);
    // Flash player hurt: 3 blood clips.
    expect(PARTICLE_FX.bloodBurst).toBe(3);
    // Flash rocket `!(r%2)` / smallrocket `!(r%4)` / jetpack `%5`.
    expect(PARTICLE_FX.smokeTrailIntervalRocket).toBe(2);
    expect(PARTICLE_FX.smokeTrailIntervalSmallRocket).toBe(4);
    expect(PARTICLE_FX.smokeTrailIntervalJetpack).toBe(5);
  });

  it('maps each FX kind to a hi-res atlas frame', () => {
    const kinds: ParticleFxKind[] = [
      'explosion',
      'impact',
      'smoke',
      'debris',
      'muzzle',
      'blood',
    ];
    expect(Object.keys(PARTICLE_FX_FRAMES).sort()).toEqual([...kinds].sort());
    expect(PARTICLE_FX_FRAMES.explosion).toBe('explosion');
    expect(PARTICLE_FX_FRAMES.impact).toBe('blood');
    expect(PARTICLE_FX_FRAMES.smoke).toBe('smoke');
    expect(PARTICLE_FX_FRAMES.debris).toBe('shard');
    expect(PARTICLE_FX_FRAMES.muzzle).toBe('muzzle_flash');
    expect(PARTICLE_FX_FRAMES.blood).toBe('blood');
  });

  it('gives rocket weapons Flash smoke-trail intervals', () => {
    expect(SMOKE_TRAIL_WEAPONS[3]).toBe(4); // ShotgunRockets
    expect(SMOKE_TRAIL_WEAPONS[5]).toBe(2); // RPG
    expect(SMOKE_TRAIL_WEAPONS[6]).toBe(2); // RocketLauncher
    expect(SMOKE_TRAIL_WEAPONS[7]).toBe(2); // Seeker
    expect(SMOKE_TRAIL_WEAPONS[10]).toBe(4); // A-Bomb
    expect(SMOKE_TRAIL_WEAPONS[0]).toBeUndefined(); // MachineGun — no trail
  });

  it('keeps a fixed particle budget under the heavy-load cap', () => {
    expect(PARTICLE_FX.eventQueueCapacity).toBe(128);
    expect(PARTICLE_FX.explosionMaxParticles).toBe(64);
    expect(PARTICLE_FX.impactMaxParticles).toBe(96);
    expect(PARTICLE_FX.smokeMaxParticles).toBe(128);
    expect(PARTICLE_FX.debrisMaxParticles).toBe(64);
    expect(PARTICLE_FX.muzzleMaxParticles).toBe(32);
    expect(PARTICLE_FX.bloodMaxParticles).toBe(48);
    // Peak simultaneous particles across all pooled emitters.
    expect(particleBudgetCap()).toBe(64 + 96 + 128 + 64 + 32 + 48);
    expect(particleBudgetCap()).toBe(432);
  });

  it('uses distinct burst sizes so kills read differently from impacts', () => {
    expect(PARTICLE_FX.explosionBurst).toBe(14);
    expect(PARTICLE_FX.impactBurst).toBe(6);
    expect(PARTICLE_FX.killSmokeBurst).toBe(5);
    expect(PARTICLE_FX.muzzleBurst).toBe(4);
    expect(PARTICLE_FX.smokeBurst).toBe(3);
    // Kill boom is larger than a non-fatal impact.
    expect(PARTICLE_FX.explosionBurst).toBeGreaterThan(PARTICLE_FX.impactBurst);
  });
});
