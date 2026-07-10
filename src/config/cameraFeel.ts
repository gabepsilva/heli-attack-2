/**
 * Camera feel / juice tunables (issue #36).
 *
 * Screen shake scales with weapon damage (big guns hit harder), with a hard
 * cap so effects stay punchy rather than nauseating. Hit-stop, hit flash,
 * damage vignette, and subtle aim/velocity lead share one intensity toggle.
 */

/** User-facing intensity ladder — Off disables every camera-feel effect. */
export type CameraFeelIntensity = 'off' | 'low' | 'medium' | 'high';

export const CAMERA_FEEL_INTENSITIES: readonly CameraFeelIntensity[] = [
  'off',
  'low',
  'medium',
  'high',
] as const;

/**
 * Exact juice constants (#36). Shake uses Phaser camera intensity (fraction of
 * view); durations are milliseconds; hit-stop is real-time freeze ms.
 */
export const CAMERA_FEEL = {
  /** `localStorage` key for the intensity preference. */
  storageKey: 'heli-attack-2.cameraFeelIntensity',
  /** Default when nothing is stored. */
  defaultIntensity: 'medium' as CameraFeelIntensity,

  /**
   * Multiplier applied to shake / flash / hit-stop / vignette / lead per
   * intensity. `off` is 0 so every effect is a no-op.
   */
  intensityScale: {
    off: 0,
    low: 0.45,
    medium: 1,
    high: 1.25,
  } as const satisfies Record<CameraFeelIntensity, number>,

  // --- Screen shake (scales with weapon damage) ---
  /** Damage that maps to peak shake (A-Bomb / Grapple / ShoulderCannon). */
  shakeDamageRef: 300,
  /**
   * Hits below this skip shake unless they kill (MachineGun 10, Flame 2).
   * Shotgun (15) is the lightest shaking weapon.
   */
  shakeMinDamage: 15,
  /** Peak Phaser shake intensity at {@link shakeDamageRef} — kept subtle. */
  shakeIntensityMax: 0.011,
  /** Floor fraction of max at {@link shakeMinDamage} (still readable). */
  shakeIntensityFloor: 0.28,
  /** Shake duration at min qualifying damage (ms). */
  shakeDurationMsMin: 70,
  /** Shake duration at {@link shakeDamageRef} (ms). */
  shakeDurationMsMax: 220,
  /** Extra multiplier when the hit kills the heli. */
  killShakeMultiplier: 1.3,
  /** Absolute cap after kill boost — never exceed this (anti-nausea). */
  shakeIntensityHardCap: 0.016,

  // --- Hit-stop (brief real-time freeze on big hits) ---
  /** Damage threshold before hit-stop engages (Grenade/RPG and up). */
  hitStopMinDamage: 75,
  /** Hit-stop at {@link hitStopMinDamage} (ms). */
  hitStopMsMin: 28,
  /** Hit-stop at {@link shakeDamageRef} (ms). */
  hitStopMsMax: 70,
  /** Kills always get at least this hit-stop (ms) when intensity > off. */
  killHitStopMsFloor: 40,

  // --- Hit flash (Phaser camera.flash) ---
  /** Damage threshold for a white hit flash. */
  hitFlashMinDamage: 40,
  hitFlashDurationMsMin: 40,
  hitFlashDurationMsMax: 90,
  /** RGB for weapon-hit flashes (near-white). */
  hitFlashRed: 255,
  hitFlashGreen: 255,
  hitFlashBlue: 245,
  /**
   * Player-hurt flash — Flash `heroAction` applies `hitColor` for exactly one
   * stage frame when `lasthealth > health`, then restores `normalColor`
   * (`reference/spec/heli2-actionscript.txt`). One frame at the Flash / sim
   * rate (30 fps) is `1000/30` ms → 33 ms for Phaser `cam.flash`.
   */
  hurtFlashDurationMs: 33,
  /**
   * Phaser flash RGB approximating Flash `hitColor`
   * `{ ra:100, rb:150, ga:100, gb:0, ba:100, bb:0 }` (red offset +150).
   */
  hurtFlashRed: 150,
  hurtFlashGreen: 0,
  hurtFlashBlue: 0,

  // --- Damage vignette (Phaser Filters.Vignette) ---
  vignetteRadius: 0.55,
  /** Peak strength when the player takes damage. */
  vignetteStrengthMax: 0.42,
  /** Idle strength (subtle always-on frame when intensity > off). */
  vignetteStrengthIdle: 0.06,
  /** Fade back to idle after hurt (ms). */
  vignetteFadeMs: 420,
  /** Red damage vignette tint. */
  vignetteHurtColor: 0x6a0000,

  // --- Subtle camera lead (aim + velocity) ---
  /** Max lead offset in px along aim / motion. */
  leadMaxPx: 22,
  /** How fast lead eases toward the target (per second). */
  leadLerpPerSec: 6,
  /** Velocity contribution scale (px lead per px/frame of speed). */
  leadVelocityScale: 1.8,
  /** Aim contribution as a fraction of {@link leadMaxPx}. */
  leadAimWeight: 0.75,
} as const;

/** Intensity multiplier, or 0 for unknown values. */
export function cameraFeelScale(intensity: CameraFeelIntensity): number {
  return CAMERA_FEEL.intensityScale[intensity] ?? 0;
}

/** True when the stored/selected intensity enables juice. */
export function cameraFeelEnabled(intensity: CameraFeelIntensity): boolean {
  return cameraFeelScale(intensity) > 0;
}

/**
 * Normalize damage into 0..1 against {@link CAMERA_FEEL.shakeDamageRef}.
 */
export function damageNorm(damage: number): number {
  if (!Number.isFinite(damage) || damage <= 0) {
    return 0;
  }
  return Math.min(1, damage / CAMERA_FEEL.shakeDamageRef);
}

/**
 * 0 at `minDamage`, 1 at {@link CAMERA_FEEL.shakeDamageRef} — used so
 * threshold hits get the min duration and peak weapons get the max.
 */
export function thresholdNorm(damage: number, minDamage: number): number {
  if (!Number.isFinite(damage) || damage < minDamage) {
    return 0;
  }
  const span = CAMERA_FEEL.shakeDamageRef - minDamage;
  if (span <= 0) {
    return 1;
  }
  return Math.min(1, (damage - minDamage) / span);
}

/**
 * Phaser shake intensity for a weapon hit — scales with damage, capped so
 * big weapons feel heavier without becoming nauseating.
 */
export function shakeIntensityForDamage(
  damage: number,
  killed: boolean,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  if (!killed && damage < CAMERA_FEEL.shakeMinDamage) {
    return 0;
  }
  const effectiveDamage = killed
    ? Math.max(damage, CAMERA_FEEL.shakeMinDamage)
    : damage;
  const t = thresholdNorm(effectiveDamage, CAMERA_FEEL.shakeMinDamage);
  const base =
    CAMERA_FEEL.shakeIntensityMax *
    (CAMERA_FEEL.shakeIntensityFloor +
      (1 - CAMERA_FEEL.shakeIntensityFloor) * t);
  const boosted = killed ? base * CAMERA_FEEL.killShakeMultiplier : base;
  return Math.min(CAMERA_FEEL.shakeIntensityHardCap, boosted) * scale;
}

/** Shake duration (ms) for a weapon hit. */
export function shakeDurationMsForDamage(
  damage: number,
  killed: boolean,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  if (shakeIntensityForDamage(damage, killed, intensity) <= 0) {
    return 0;
  }
  const t = thresholdNorm(
    Math.max(damage, CAMERA_FEEL.shakeMinDamage),
    CAMERA_FEEL.shakeMinDamage,
  );
  const ms =
    CAMERA_FEEL.shakeDurationMsMin +
    (CAMERA_FEEL.shakeDurationMsMax - CAMERA_FEEL.shakeDurationMsMin) * t;
  return Math.round(ms);
}

/** Hit-stop freeze duration (ms); 0 when below threshold or intensity off. */
export function hitStopMsForDamage(
  damage: number,
  killed: boolean,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  if (!killed && damage < CAMERA_FEEL.hitStopMinDamage) {
    return 0;
  }
  if (killed && damage < CAMERA_FEEL.hitStopMinDamage) {
    return Math.round(CAMERA_FEEL.killHitStopMsFloor * scale);
  }
  const t = thresholdNorm(damage, CAMERA_FEEL.hitStopMinDamage);
  const ms =
    CAMERA_FEEL.hitStopMsMin +
    (CAMERA_FEEL.hitStopMsMax - CAMERA_FEEL.hitStopMsMin) * t;
  const floored = killed ? Math.max(ms, CAMERA_FEEL.killHitStopMsFloor) : ms;
  return Math.round(floored * scale);
}

/** Hit-flash duration (ms) for a weapon hit; 0 when below threshold. */
export function hitFlashMsForDamage(
  damage: number,
  killed: boolean,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  if (!killed && damage < CAMERA_FEEL.hitFlashMinDamage) {
    return 0;
  }
  const t = thresholdNorm(
    Math.max(damage, CAMERA_FEEL.hitFlashMinDamage),
    CAMERA_FEEL.hitFlashMinDamage,
  );
  const ms =
    CAMERA_FEEL.hitFlashDurationMsMin +
    (CAMERA_FEEL.hitFlashDurationMsMax - CAMERA_FEEL.hitFlashDurationMsMin) * t;
  return Math.round(ms * scale);
}

/**
 * Hurt-flash duration (ms) when the player takes damage.
 * Medium intensity = one Flash frame (`hurtFlashDurationMs`); Off disables;
 * Low / High scale the blink while keeping it a short snappy flash (#99).
 */
export function hurtFlashMs(
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  return Math.round(CAMERA_FEEL.hurtFlashDurationMs * scale);
}

/** Peak vignette strength after the player is hurt. */
export function vignetteStrengthOnHurt(
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  return CAMERA_FEEL.vignetteStrengthMax * scale;
}

/** Idle vignette strength (subtle frame). */
export function vignetteStrengthIdle(
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  const scale = cameraFeelScale(intensity);
  if (scale <= 0) {
    return 0;
  }
  return CAMERA_FEEL.vignetteStrengthIdle * scale;
}

/** Lead distance cap for the current intensity. */
export function leadMaxPx(
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): number {
  return CAMERA_FEEL.leadMaxPx * cameraFeelScale(intensity);
}

/**
 * Target camera lead offset from aim angle (degrees) and velocity.
 * Pure — GameCameraFeel eases toward this each frame.
 */
export function cameraLeadTarget(
  aimDeg: number,
  vx: number,
  vy: number,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): Readonly<{ x: number; y: number }> {
  const max = leadMaxPx(intensity);
  if (max <= 0) {
    return { x: 0, y: 0 };
  }
  const rad = (aimDeg * Math.PI) / 180;
  const aimX = Math.cos(rad) * max * CAMERA_FEEL.leadAimWeight;
  const aimY = Math.sin(rad) * max * CAMERA_FEEL.leadAimWeight;
  const velX = vx * CAMERA_FEEL.leadVelocityScale;
  const velY = vy * CAMERA_FEEL.leadVelocityScale;
  let x = aimX + velX;
  let y = aimY + velY;
  const mag = Math.hypot(x, y);
  if (mag > max && mag > 0) {
    x = (x / mag) * max;
    y = (y / mag) * max;
  }
  return { x, y };
}

/**
 * Ease current lead toward target. `dtSec` is render-frame delta in seconds.
 */
export function easeCameraLead(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  dtSec: number,
  intensity: CameraFeelIntensity = CAMERA_FEEL.defaultIntensity,
): Readonly<{ x: number; y: number }> {
  if (cameraFeelScale(intensity) <= 0) {
    return { x: 0, y: 0 };
  }
  const t = 1 - Math.exp(-CAMERA_FEEL.leadLerpPerSec * Math.max(0, dtSec));
  return {
    x: currentX + (targetX - currentX) * t,
    y: currentY + (targetY - currentY) * t,
  };
}

/** Cycle Off → Low → Medium → High → Off. */
export function nextCameraFeelIntensity(
  current: CameraFeelIntensity,
): CameraFeelIntensity {
  const idx = CAMERA_FEEL_INTENSITIES.indexOf(current);
  const next = (idx + 1) % CAMERA_FEEL_INTENSITIES.length;
  return CAMERA_FEEL_INTENSITIES[next]!;
}

export function isCameraFeelIntensity(
  value: string,
): value is CameraFeelIntensity {
  return (CAMERA_FEEL_INTENSITIES as readonly string[]).includes(value);
}
