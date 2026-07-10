/**
 * Central game constants seeded from the reverse-engineered HA2 spec.
 * Speeds / reloads are per sim frame at {@link SIM_HZ} (original Flash ~30 fps).
 *
 * {@link WORLD.timeStep} is only the **initial default** (1) used to seed a
 * live {@link TimeScale} instance. Entity motion must multiply by the live
 * `timeScale.timeStep` — never by `WORLD.timeStep` directly — or bullet-time
 * / TimeRift will silently no-op for that entity.
 *
 * {@link WORLD} and {@link PLAYER} are **mutable** so the debug tuning harness
 * (#8) can edit gravity / jump / walk values at runtime. Spec seeds live in
 * {@link WORLD_DEFAULTS} / {@link PLAYER_DEFAULTS}; call
 * {@link resetPhysicsConstants} to restore them.
 */

/** Fixed simulation rate matching the original Flash stage framerate. */
export const SIM_HZ = 30;

/** Duration of one sim tick in seconds. */
export const SIM_DT = 1 / SIM_HZ;

/** Duration of one sim tick in milliseconds (for Phaser delta conversion). */
export const SIM_DT_MS = 1000 / SIM_HZ;

/** Immutable spec seed for world physics (issue #8 reset target). */
export const WORLD_DEFAULTS = {
  tile: 50,
  gravity: 1,
  terminal: 50,
  /**
   * Initial time-scale seed (default 1). Not the live factor — entities must
   * read `TimeScale.timeStep` from their scene's SimSession / TimeScale.
   */
  timeStep: 1,
} as const;

/** Immutable spec seed for player physics (issue #8 reset target). */
export const PLAYER_DEFAULTS = {
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

/** Live world constants — numeric fields are mutable for the tuning harness. */
export type WorldConstants = {
  tile: number;
  gravity: number;
  terminal: number;
  timeStep: number;
};

/** Live player constants — numeric fields are mutable for the tuning harness. */
export type PlayerConstants = {
  health: number;
  walkAccel: number;
  walkCap: number;
  hardCap: number;
  friction: number;
  jumpVel: number;
  jumpHoldFrames: number;
  doubleJump: boolean;
  boostVel: number;
  boostChargeFrames: number;
  boxW: number;
  boxH: number;
  spriteW: number;
  spriteH: number;
  duckScale: number;
};

/** Live world constants — mutated by the physics tuning harness. */
export const WORLD: WorldConstants = { ...WORLD_DEFAULTS };

/** Live player constants — mutated by the physics tuning harness. */
export const PLAYER: PlayerConstants = { ...PLAYER_DEFAULTS };

/** Restore {@link WORLD} and {@link PLAYER} to the exact spec seeds. */
export function resetPhysicsConstants(): void {
  Object.assign(WORLD, WORLD_DEFAULTS);
  Object.assign(PLAYER, PLAYER_DEFAULTS);
}

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
