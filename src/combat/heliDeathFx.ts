/**
 * Flash heli kill aftermath — `HeliDestroyed` / `Shard` / `GuyBurned`.
 *
 * On fatal hit Flash spawns: 3 shards, a burned pilot, a falling wreck
 * (`heliFall`), and a boom. When the wreck hits a tile it bursts into 3 more
 * shards + boom. Shards bounce (`shardFrame`); the pilot tumbles (`guyFall`)
 * until soft landing.
 */

import { HELI_DEATH, WORLD } from '../config/constants';
import { isSolidAtWorld } from './specialProjectile';
import type { Helicopter, SpawnRng } from './helicopter';
import type { TileMap } from '../world/tileMap';

/** Falling wreck — Flash `HeliDestroyed` + `heliFall`. */
export type HeliWreck = {
  active: boolean;
  x: number;
  y: number;
  xspeed: number;
  yspeed: number;
  rotationDeg: number;
  /** Flash `stepc` gravity accumulator. */
  stepAccum: number;
};

/** Bouncing scrap — Flash `Shard` + `shardFrame`. */
export type HeliShard = {
  active: boolean;
  x: number;
  y: number;
  xspeed: number;
  yspeed: number;
  rotationDeg: number;
  stepAccum: number;
  /** Vertical bounce count — removed at ≥ {@link HELI_DEATH.shardMaxBounces}. */
  bounces: number;
  /** Visual variant (Flash `gotoAndStop(random(totalframes)+1)`). */
  look: number;
};

/** Burned gunner — Flash `GuyBurned` + `guyFall`. */
export type FallingPilot = {
  active: boolean;
  x: number;
  y: number;
  xspeed: number;
  yspeed: number;
  rotationDeg: number;
  stepAccum: number;
};

function randomInt(rng: SpawnRng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

/** Flash `-10+random(20)` → integer in [-10, 9]. */
function flashRandSpeed(rng: SpawnRng, span = 20): number {
  return -10 + randomInt(rng, span);
}

/**
 * The one deliberate break from the reference. Flash writes `temp.yseed =
 * this.yspeed` — a typo, so `HeliDestroyed.yspeed` is never assigned and reads
 * as 0 under AVM1: the original wreck inherits the heli's horizontal drift but
 * always starts its fall from a vertical standstill. We carry `yspeed` across,
 * so a heli shot mid-climb arcs up before it drops.
 *
 * Set `yspeed: 0` to get the authentic Flash drop back.
 */
export function createHeliWreck(heli: Helicopter): HeliWreck {
  return {
    active: true,
    x: heli.x,
    y: heli.y,
    xspeed: heli.xspeed,
    yspeed: heli.yspeed,
    rotationDeg: heli.rotationDeg,
    stepAccum: 0,
  };
}

export function createFallingPilot(
  heli: Helicopter,
  rng: SpawnRng,
): FallingPilot {
  return {
    active: true,
    x: heli.x,
    y: heli.y,
    xspeed: flashRandSpeed(rng),
    yspeed: -10 + randomInt(rng, 15),
    rotationDeg: heli.rotationDeg,
    stepAccum: 0,
  };
}

/** Spawn `count` shards at (x, y) — Flash kill / ground-burst loops. */
export function createHeliShards(
  x: number,
  y: number,
  count: number,
  rng: SpawnRng,
): HeliShard[] {
  const shards: HeliShard[] = [];
  for (let i = 0; i < count; i += 1) {
    shards.push({
      active: true,
      x,
      y,
      xspeed: flashRandSpeed(rng),
      yspeed: flashRandSpeed(rng),
      rotationDeg: randomInt(rng, 360),
      stepAccum: 0,
      bounces: 0,
      look: randomInt(rng, HELI_DEATH.shardLookCount),
    });
  }
  return shards;
}

/**
 * Full Flash kill spawn payload (entities only — boom / SFX are separate).
 * Callers push wreck + pilot + shards and enqueue the initial boom.
 */
export function spawnHeliDeathEntities(
  heli: Helicopter,
  rng: SpawnRng,
): { wreck: HeliWreck; pilot: FallingPilot; shards: HeliShard[] } {
  return {
    wreck: createHeliWreck(heli),
    pilot: createFallingPilot(heli, rng),
    shards: createHeliShards(heli.x, heli.y, HELI_DEATH.shardBurst, rng),
  };
}

/**
 * Flash `heliFall` — gravity + spin, explode on first solid cell.
 * Returns true when the wreck should be removed.
 */
export function stepHeliWreck(
  wreck: HeliWreck,
  map: TileMap,
  timeStep: number,
  onGroundHit: (x: number, y: number) => void,
): boolean {
  if (!wreck.active) {
    return true;
  }
  wreck.stepAccum += timeStep;
  if (wreck.stepAccum >= 1) {
    wreck.yspeed += 1;
    wreck.stepAccum -= 1;
  }
  if (wreck.xspeed > 0) {
    wreck.rotationDeg += (wreck.yspeed * timeStep) / 4;
  } else {
    wreck.rotationDeg -= (wreck.yspeed * timeStep) / 4;
  }
  wreck.x += wreck.xspeed * timeStep;
  wreck.y += wreck.yspeed * timeStep;
  if (isSolidAtWorld(map, wreck.x, wreck.y)) {
    // Flash spawns shards at `y - tileWidth/2`.
    onGroundHit(wreck.x, wreck.y - WORLD.tile / 2);
    wreck.active = false;
    return true;
  }
  return false;
}

/**
 * Flash `if(!((sbounce++)%3))` — the clang is gated on a counter shared by
 * every live shard (Flash global `sbounce`), not a per-shard one, so a burst
 * rings a few times instead of once per fragment. Fires when the value *before*
 * the increment is a multiple of the interval.
 */
function ringMetal(
  metalBounceCounter: { value: number },
  rng: SpawnRng,
  onMetal: (index: number) => void,
): void {
  const n = metalBounceCounter.value;
  metalBounceCounter.value = n + 1;
  if (n % HELI_DEATH.metalBounceInterval === 0) {
    onMetal(randomInt(rng, HELI_DEATH.metalSoundCount));
  }
}

/**
 * Flash `shardFrame` — gravity, spin, bounce, cull after max bounces / OOB.
 * Returns true when the shard should be removed.
 *
 * Flash culls against the *viewport* (`worldpos`/`stw`/`sth`); we cull against
 * the map instead. Off-map cells are solid either way, so a shard can never
 * actually leave — the two only differ in how long an unseen shard keeps
 * bouncing, and a map-bounds test keeps the sim independent of where the camera
 * happens to be looking.
 */
export function stepHeliShard(
  shard: HeliShard,
  map: TileMap,
  timeStep: number,
  metalBounceCounter: { value: number },
  rng: SpawnRng,
  onMetal: (index: number) => void,
): boolean {
  if (!shard.active) {
    return true;
  }
  // Flash gates shard gravity on `stepc > 1` where the wreck and pilot use
  // `>= 1`. Faithful, not a typo on our side.
  shard.stepAccum += timeStep;
  if (shard.stepAccum > 1) {
    shard.yspeed += 1;
    shard.stepAccum -= 1;
  }
  shard.rotationDeg += shard.xspeed * timeStep * 4;

  shard.x += shard.xspeed * timeStep;
  if (isSolidAtWorld(map, shard.x, shard.y)) {
    shard.x -= shard.xspeed * timeStep;
    shard.xspeed *= -0.5;
    ringMetal(metalBounceCounter, rng, onMetal);
  }

  shard.y += shard.yspeed * timeStep;
  if (isSolidAtWorld(map, shard.x, shard.y)) {
    shard.y -= shard.yspeed * timeStep;
    shard.yspeed *= -0.5;
    shard.bounces += 1;
    ringMetal(metalBounceCounter, rng, onMetal);
  }

  // Flash reads the cull cell after both bounce reverts, so a shard is judged
  // on where it settled rather than on the solid tile it briefly overlapped.
  const col = Math.floor(shard.x / map.tileSize);
  const row = Math.floor(shard.y / map.tileSize);
  if (
    shard.bounces >= HELI_DEATH.shardMaxBounces ||
    col < -1 ||
    col > map.width ||
    row < -1 ||
    row > map.height
  ) {
    shard.active = false;
    return true;
  }
  return false;
}

/**
 * Flash `guyFall` — tumble with soft settle. Returns true when removed.
 */
export function stepFallingPilot(
  pilot: FallingPilot,
  map: TileMap,
  timeStep: number,
): boolean {
  if (!pilot.active) {
    return true;
  }
  pilot.stepAccum += timeStep;
  if (pilot.stepAccum >= 1) {
    pilot.yspeed += 1;
    pilot.stepAccum -= 1;
  }
  pilot.rotationDeg += Math.abs(pilot.xspeed + pilot.yspeed) * timeStep;
  pilot.x += pilot.xspeed * timeStep;
  if (isSolidAtWorld(map, pilot.x, pilot.y)) {
    pilot.x -= pilot.xspeed * timeStep;
    pilot.xspeed *= -0.5;
  }
  pilot.y += pilot.yspeed * timeStep;
  if (isSolidAtWorld(map, pilot.x, pilot.y)) {
    if (pilot.yspeed < HELI_DEATH.pilotSettleSpeed) {
      pilot.active = false;
      return true;
    }
    pilot.y -= pilot.yspeed * timeStep;
    pilot.yspeed *= -0.2;
  }
  return false;
}
