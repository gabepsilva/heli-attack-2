/**
 * Central game constants seeded from the reverse-engineered HA2 spec.
 * Speeds / reloads are per sim frame at {@link SIM_HZ} (original Flash ~30 fps).
 * Every entity update multiplies motion by the global {@link WORLD.timeStep}.
 */

/** Fixed simulation rate matching the original Flash stage framerate. */
export const SIM_HZ = 30;

/** Duration of one sim tick in seconds. */
export const SIM_DT = 1 / SIM_HZ;

/** Duration of one sim tick in milliseconds (for Phaser delta conversion). */
export const SIM_DT_MS = 1000 / SIM_HZ;

export const WORLD = {
  tile: 50,
  gravity: 1,
  terminal: 50,
  /** Per-frame time-scale multiplier; default 1. Bullet-time / TimeRift scale this. */
  timeStep: 1,
} as const;

export const PLAYER = {
  health: 100,
  walkAccel: 1,
  walkCap: 5,
  hardCap: 6,
  friction: 1,
  jumpVel: -8,
  jumpHoldFrames: 6,
  doubleJump: true,
  boostVel: -32,
  boostChargeFrames: 150,
  boxW: 10,
  boxH: 42,
  spriteW: 48,
  spriteH: 48,
  duckScale: 2 / 3,
} as const;

export const HELI = {
  hp: 300,
  bulletSpeed: 7,
  aimSpreadDeg: 10,
} as const;

/** Timed "state" powerups each last this many sim frames (~16.7s @30Hz). */
export const POWERUP_FRAMES = 500;

export const POWERUP = {
  TriDamage: 1,
  Invulnerability: 2,
  PredatorMode: 3,
  TimeRift: 4,
  Jetpack: 5,
} as const;

export const HEALTH_PICKUP = {
  amount: 20,
  cap: 100,
  firstThreshold: 15,
} as const;

export const BULLET_TIME = {
  maxFrames: 250,
  refillPerKill: 250 / 3,
  minScale: 0.2,
  easePerFrame: 0.1,
} as const;
