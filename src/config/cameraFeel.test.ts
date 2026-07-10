/**
 * Issue #36 acceptance: camera-feel constants — shake scales with weapon
 * damage (big guns hit harder), hard-capped so effects stay non-nauseating,
 * and every effect respects the intensity toggle (including Off).
 */

import { describe, expect, it } from 'vitest';
import { WEAPONS } from './weapons';
import {
  CAMERA_FEEL,
  CAMERA_FEEL_INTENSITIES,
  cameraFeelEnabled,
  cameraFeelScale,
  cameraLeadTarget,
  damageNorm,
  easeCameraLead,
  hitFlashMsForDamage,
  hitStopMsForDamage,
  hurtFlashMs,
  leadMaxPx,
  nextCameraFeelIntensity,
  shakeDurationMsForDamage,
  shakeIntensityForDamage,
  vignetteStrengthIdle,
  vignetteStrengthOnHurt,
} from './cameraFeel';

describe('config/cameraFeel (#36)', () => {
  it('locks the intensity ladder and default (effects can be toggled)', () => {
    expect(CAMERA_FEEL_INTENSITIES).toEqual(['off', 'low', 'medium', 'high']);
    expect(CAMERA_FEEL.defaultIntensity).toBe('medium');
    expect(CAMERA_FEEL.storageKey).toBe('heli-attack-2.cameraFeelIntensity');
    expect(cameraFeelScale('off')).toBe(0);
    expect(cameraFeelScale('low')).toBe(0.45);
    expect(cameraFeelScale('medium')).toBe(1);
    expect(cameraFeelScale('high')).toBe(1.25);
    expect(cameraFeelEnabled('off')).toBe(false);
    expect(cameraFeelEnabled('medium')).toBe(true);
    expect(nextCameraFeelIntensity('off')).toBe('low');
    expect(nextCameraFeelIntensity('high')).toBe('off');
  });

  it('scales shake with weapon damage and caps intensity (not nauseating)', () => {
    expect(CAMERA_FEEL.shakeDamageRef).toBe(300);
    expect(CAMERA_FEEL.shakeMinDamage).toBe(15);
    expect(CAMERA_FEEL.shakeIntensityMax).toBe(0.011);
    expect(CAMERA_FEEL.shakeIntensityHardCap).toBe(0.016);
    expect(CAMERA_FEEL.killShakeMultiplier).toBe(1.3);
    expect(CAMERA_FEEL.shakeDurationMsMin).toBe(70);
    expect(CAMERA_FEEL.shakeDurationMsMax).toBe(220);

    // Tiny weapons (MachineGun 10, Flame 2) do not shake on non-fatal hits.
    expect(shakeIntensityForDamage(WEAPONS[0].damage, false)).toBe(0);
    expect(shakeIntensityForDamage(WEAPONS[8].damage, false)).toBe(0);
    expect(shakeDurationMsForDamage(WEAPONS[0].damage, false)).toBe(0);

    // Shotgun (15) is the lightest shaking weapon.
    const shotgun = shakeIntensityForDamage(WEAPONS[2].damage, false);
    expect(shotgun).toBeGreaterThan(0);
    expect(shakeDurationMsForDamage(WEAPONS[2].damage, false)).toBe(
      CAMERA_FEEL.shakeDurationMsMin,
    );

    // RocketLauncher (100) shakes harder than ShotgunRockets (40).
    const rockets = shakeIntensityForDamage(WEAPONS[3].damage, false);
    const rocketLauncher = shakeIntensityForDamage(WEAPONS[6].damage, false);
    expect(rocketLauncher).toBeGreaterThan(rockets);
    expect(rockets).toBeGreaterThan(shotgun);

    // A-Bomb / Grapple / ShoulderCannon (300) hit the damage ref peak.
    const abomb = shakeIntensityForDamage(WEAPONS[10].damage, false);
    expect(damageNorm(300)).toBe(1);
    expect(abomb).toBeCloseTo(CAMERA_FEEL.shakeIntensityMax, 10);
    expect(abomb).toBeGreaterThan(rocketLauncher);

    // Kill boost stays under the hard anti-nausea cap.
    const killShake = shakeIntensityForDamage(300, true);
    expect(killShake).toBeLessThanOrEqual(CAMERA_FEEL.shakeIntensityHardCap);
    expect(killShake).toBeGreaterThan(abomb);

    // Off intensity disables shake entirely.
    expect(shakeIntensityForDamage(300, true, 'off')).toBe(0);
    expect(shakeDurationMsForDamage(300, true, 'off')).toBe(0);

    // Low is a fraction of medium.
    expect(shakeIntensityForDamage(100, false, 'low')).toBeCloseTo(
      shakeIntensityForDamage(100, false, 'medium') * 0.45,
      10,
    );
  });

  it('gates hit-stop and hit-flash to bigger weapons with exact thresholds', () => {
    expect(CAMERA_FEEL.hitStopMinDamage).toBe(75);
    expect(CAMERA_FEEL.hitStopMsMin).toBe(28);
    expect(CAMERA_FEEL.hitStopMsMax).toBe(70);
    expect(CAMERA_FEEL.killHitStopMsFloor).toBe(40);
    expect(CAMERA_FEEL.hitFlashMinDamage).toBe(40);
    expect(CAMERA_FEEL.hitFlashDurationMsMin).toBe(40);
    expect(CAMERA_FEEL.hitFlashDurationMsMax).toBe(90);
    expect(CAMERA_FEEL.hitFlashRed).toBe(255);
    expect(CAMERA_FEEL.hitFlashGreen).toBe(255);
    expect(CAMERA_FEEL.hitFlashBlue).toBe(245);

    // Below thresholds: no hit-stop / flash on non-fatal hits.
    expect(hitStopMsForDamage(40, false)).toBe(0);
    expect(hitFlashMsForDamage(15, false)).toBe(0);

    // ShotgunRockets (40) flashes but does not hit-stop.
    expect(hitFlashMsForDamage(40, false)).toBe(
      CAMERA_FEEL.hitFlashDurationMsMin,
    );
    expect(hitStopMsForDamage(40, false)).toBe(0);

    // GrenadeLauncher (75) engages hit-stop at the min duration.
    expect(hitStopMsForDamage(75, false)).toBe(CAMERA_FEEL.hitStopMsMin);

    // A-Bomb (300) gets max hit-stop + max flash.
    expect(hitStopMsForDamage(300, false)).toBe(CAMERA_FEEL.hitStopMsMax);
    expect(hitFlashMsForDamage(300, false)).toBe(
      CAMERA_FEEL.hitFlashDurationMsMax,
    );

    // Kills with small weapons still get the kill hit-stop floor.
    expect(hitStopMsForDamage(10, true)).toBe(CAMERA_FEEL.killHitStopMsFloor);

    // Off disables both.
    expect(hitStopMsForDamage(300, true, 'off')).toBe(0);
    expect(hitFlashMsForDamage(300, true, 'off')).toBe(0);
  });

  it('defines damage vignette + hurt flash constants', () => {
    expect(CAMERA_FEEL.vignetteRadius).toBe(0.55);
    expect(CAMERA_FEEL.vignetteStrengthMax).toBe(0.42);
    expect(CAMERA_FEEL.vignetteStrengthIdle).toBe(0.06);
    expect(CAMERA_FEEL.vignetteFadeMs).toBe(420);
    expect(CAMERA_FEEL.vignetteHurtColor).toBe(0x6a0000);
    // #99: one Flash stage frame @ 30 fps (hitColor for lasthealth > health).
    expect(CAMERA_FEEL.hurtFlashDurationMs).toBe(33);
    expect(CAMERA_FEEL.hurtFlashDurationMs).toBe(Math.round(1000 / 30));
    // Flash hitColor rb=150 red offset → Phaser flash RGB (150, 0, 0).
    expect(CAMERA_FEEL.hurtFlashRed).toBe(150);
    expect(CAMERA_FEEL.hurtFlashGreen).toBe(0);
    expect(CAMERA_FEEL.hurtFlashBlue).toBe(0);

    expect(vignetteStrengthOnHurt('medium')).toBe(0.42);
    expect(vignetteStrengthIdle('medium')).toBe(0.06);
    expect(hurtFlashMs('medium')).toBe(33);
    expect(vignetteStrengthOnHurt('off')).toBe(0);
    expect(hurtFlashMs('off')).toBe(0);
  });

  it('hurt flash is a one-frame Flash blink scaled by intensity (#99)', () => {
    // Medium = exact Flash one-frame duration; must stay a quick blink.
    expect(hurtFlashMs('medium')).toBe(CAMERA_FEEL.hurtFlashDurationMs);
    expect(CAMERA_FEEL.hurtFlashDurationMs).toBeLessThan(50);
    // Former remake value (80 ms) was too long — assert we stayed snappy.
    expect(CAMERA_FEEL.hurtFlashDurationMs).toBeLessThan(80);

    // Intensity ladder: Off disables; Low/High scale the base blink.
    expect(hurtFlashMs('off')).toBe(0);
    expect(hurtFlashMs('low')).toBe(
      Math.round(CAMERA_FEEL.hurtFlashDurationMs * 0.45),
    );
    expect(hurtFlashMs('low')).toBe(15);
    expect(hurtFlashMs('high')).toBe(
      Math.round(CAMERA_FEEL.hurtFlashDurationMs * 1.25),
    );
    expect(hurtFlashMs('high')).toBe(41);

    // Low/High remain short blinks (not a long fade).
    expect(hurtFlashMs('low')).toBeGreaterThan(0);
    expect(hurtFlashMs('low')).toBeLessThan(CAMERA_FEEL.hurtFlashDurationMs);
    expect(hurtFlashMs('high')).toBeGreaterThan(
      CAMERA_FEEL.hurtFlashDurationMs,
    );
    expect(hurtFlashMs('high')).toBeLessThan(80);

    // Weapon-hit flash timings are unchanged by the hurt-flash retune.
    expect(CAMERA_FEEL.hitFlashDurationMsMin).toBe(40);
    expect(CAMERA_FEEL.hitFlashDurationMsMax).toBe(90);
    expect(CAMERA_FEEL.hitFlashRed).toBe(255);
    expect(CAMERA_FEEL.hitFlashGreen).toBe(255);
    expect(CAMERA_FEEL.hitFlashBlue).toBe(245);
  });

  it('keeps camera lead subtle and intensity-scaled', () => {
    expect(CAMERA_FEEL.leadMaxPx).toBe(22);
    expect(CAMERA_FEEL.leadLerpPerSec).toBe(6);
    expect(CAMERA_FEEL.leadVelocityScale).toBe(1.8);
    expect(CAMERA_FEEL.leadAimWeight).toBe(0.75);
    expect(leadMaxPx('medium')).toBe(22);
    expect(leadMaxPx('off')).toBe(0);

    const right = cameraLeadTarget(0, 0, 0, 'medium');
    expect(right.x).toBeCloseTo(22 * 0.75, 10);
    expect(right.y).toBeCloseTo(0, 10);

    const off = cameraLeadTarget(0, 5, 0, 'off');
    expect(off).toEqual({ x: 0, y: 0 });

    const eased = easeCameraLead(0, 0, 10, 0, 1 / 60, 'medium');
    expect(eased.x).toBeGreaterThan(0);
    expect(eased.x).toBeLessThan(10);
    expect(easeCameraLead(5, 5, 10, 10, 0.1, 'off')).toEqual({ x: 0, y: 0 });
  });
});
