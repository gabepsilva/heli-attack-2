/**
 * Powerup drop & pickup system — issues #21 / #91.
 *
 * On heli kill (Flash `rthelis++` / `helis++`):
 * - Every {@link POWERUP_DROP.killsPerCrate} kills, always spawn a crate
 *   (Flash `if (helis == 3)`).
 * - Health crate when `rthelis >= nextHealth` (`nextHealth` starts at 15, then
 *   doubles — {@link HEALTH_PICKUP.firstThreshold}); health takes priority on
 *   the shared every-3-kills channel (#93).
 * - Otherwise weapon/ammo (or state-powerup frame) — always, not random-gated
 *   (#91). Pickup ammo is finite per {@link WEAPON_PICKUP_AMMO}.
 *
 * Crates fall on parachutes and are collected on player AABB overlap.
 * Timed state *effects* live in {@link ./powerupEffects} (#22) — this module
 * only rolls/stores `powerupOn` / `powerupTime` on collect.
 */

import {
  HEALTH_PICKUP,
  POWERUP,
  POWERUP_DROP,
  POWERUP_FRAMES,
  WORLD,
} from '../config/constants';
import { PREDATOR_WEAPON_INDEX, WEAPON_PICKUP_AMMO } from '../config/weapons';
import type { AabbBody } from '../world/aabbBody';
import { getTile, TILE_EMPTY, type TileMap } from '../world/tileMap';
import type { SpawnRng } from './helicopter';
import { healPlayer, type PlayerHealthState } from './playerHealth';
import { grantWeaponAmmo, type WeaponInventory } from './weaponInventory';

/** Kill-drop threshold tracker (Flash `nextHealth`). */
export type PowerupDropState = {
  /** Next kill count that forces a health crate. */
  nextHealth: number;
};

/** Timed state powerup slot (Flash `player.powerupOn` / `powerupTime`). */
export type PlayerPowerupState = {
  /** 0 = none; 1..5 = {@link POWERUP} ids. */
  powerupOn: number;
  /** Frames remaining while active. */
  powerupTime: number;
};

export type PowerupKind = 'health' | 'weapon' | 'state';

/** One parachuting crate in arena space. */
export type PowerupPickup = {
  active: boolean;
  x: number;
  y: number;
  yspeed: number;
  kind: PowerupKind;
  /**
   * Arsenal index when `kind === 'weapon'` (1..12). Unused otherwise.
   */
  weaponIndex: number;
  /** Flash `fall` — chute collapsing / free-fall after near-ground probe. */
  fall: boolean;
  /** Flash `chute._xscale` (0..100). */
  chuteScale: number;
  /** True after soft-landing on a solid tile. */
  stopped: boolean;
};

export type KillDropDecision =
  | { kind: 'health' }
  | { kind: 'weapon'; weaponIndex: number }
  | { kind: 'state' }
  | null;

export type PowerupCollectResult =
  | { kind: 'health'; amount: number }
  | {
      kind: 'weapon';
      /** Ammo granted (Flash `bullets = N`). */
      amount: number;
      /** Arsenal index 1..12 — used for pickup VO (#27). */
      weaponIndex: number;
    }
  | { kind: 'state'; amount: number };

export function createPowerupDropState(
  firstThreshold: number = HEALTH_PICKUP.firstThreshold,
): PowerupDropState {
  return { nextHealth: firstThreshold };
}

export function createPlayerPowerupState(): PlayerPowerupState {
  return { powerupOn: 0, powerupTime: 0 };
}

/** Flash `random(n)` → integer in `[0, n)`. */
function randomInt(rng: SpawnRng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

/**
 * True when this cumulative kill count is on the Flash every-N crate cadence
 * (`helis == killsPerCrate` after increment).
 */
export function isCrateKill(
  kills: number,
  every: number = POWERUP_DROP.killsPerCrate,
): boolean {
  return kills > 0 && every > 0 && kills % every === 0;
}

/**
 * Decide whether this kill (already counted in `kills`) spawns a crate.
 * Mutates `dropState.nextHealth` when a health threshold is crossed.
 *
 * Flash: only the every-3rd kill attaches a crate; health wins when
 * `rthelis >= nextHealth`, else a weapon/state frame always drops.
 */
export function decideKillDrop(
  kills: number,
  dropState: PowerupDropState,
  rng: SpawnRng,
): KillDropDecision {
  if (!isCrateKill(kills)) {
    return null;
  }
  if (kills >= dropState.nextHealth) {
    dropState.nextHealth *= 2;
    return { kind: 'health' };
  }
  // Flash: `gotoAndStop(random(totalframes-1)+2)` → frames 2..14.
  const frame = randomInt(rng, POWERUP_DROP.nonHealthFrameCount) + 2;
  const gun = frame - 1;
  if (gun >= PREDATOR_WEAPON_INDEX) {
    return { kind: 'state' };
  }
  return { kind: 'weapon', weaponIndex: gun };
}

/** Spawn a crate at the destroyed heli position. */
export function spawnPowerup(
  x: number,
  y: number,
  decision: Exclude<KillDropDecision, null>,
): PowerupPickup {
  return {
    active: true,
    x,
    y,
    yspeed: POWERUP_DROP.chuteFallSpeed,
    kind: decision.kind,
    weaponIndex: decision.kind === 'weapon' ? decision.weaponIndex : 0,
    fall: false,
    chuteScale: 0,
    stopped: false,
  };
}

/**
 * Record a kill drop: decide + optionally push a new crate.
 * Returns the spawned pickup, or null when the roll misses.
 */
export function trySpawnDropOnKill(
  kills: number,
  dropState: PowerupDropState,
  powerups: PowerupPickup[],
  x: number,
  y: number,
  rng: SpawnRng,
): PowerupPickup | null {
  const decision = decideKillDrop(kills, dropState, rng);
  if (decision === null) {
    return null;
  }
  const pickup = spawnPowerup(x, y, decision);
  powerups.push(pickup);
  return pickup;
}

/** AABB overlap between crate (centered) and player collision box. */
export function powerupOverlapsPlayer(
  pickup: Readonly<PowerupPickup>,
  body: AabbBody,
): boolean {
  const halfW = POWERUP_DROP.crateW / 2;
  const halfH = POWERUP_DROP.crateH / 2;
  const left = pickup.x - halfW;
  const right = pickup.x + halfW;
  const top = pickup.y - halfH;
  const bottom = pickup.y + halfH;
  return !(
    body.x + body.w <= left ||
    body.x >= right ||
    body.y + body.h <= top ||
    body.y >= bottom
  );
}

/**
 * Apply Flash collection: health +20 cap 100, weapon ammo grant, or roll a
 * timed state id into {@link PlayerPowerupState} (effects in #22).
 */
export function applyPowerupCollect(
  pickup: PowerupPickup,
  health: PlayerHealthState,
  inventory: WeaponInventory,
  powerupState: PlayerPowerupState,
  rng: SpawnRng,
): PowerupCollectResult {
  pickup.active = false;
  if (pickup.kind === 'health') {
    const healed = healPlayer(health, HEALTH_PICKUP.amount, HEALTH_PICKUP.cap);
    return { kind: 'health', amount: healed };
  }
  if (pickup.kind === 'weapon') {
    const ammo = WEAPON_PICKUP_AMMO[pickup.weaponIndex] ?? 0;
    grantWeaponAmmo(inventory, pickup.weaponIndex, ammo);
    return {
      kind: 'weapon',
      amount: ammo,
      weaponIndex: pickup.weaponIndex,
    };
  }
  // Flash: `p = 1+random(5)` → TriDamage..Jetpack.
  const p = 1 + randomInt(rng, 5);
  powerupState.powerupOn = p;
  powerupState.powerupTime = POWERUP_FRAMES;
  return { kind: 'state', amount: p };
}

/**
 * One parachute / fall tick (Flash `powerupFrame` motion subset).
 * Does not handle collection — call {@link collectPowerups} separately.
 */
export function stepPowerup(
  pickup: PowerupPickup,
  map: TileMap,
  timeStep: number,
): void {
  if (!pickup.active || pickup.stopped) {
    return;
  }

  if (pickup.fall) {
    pickup.yspeed += POWERUP_DROP.fallGravity * timeStep;
    pickup.chuteScale = Math.max(
      0,
      pickup.chuteScale - POWERUP_DROP.chuteScaleRate * timeStep,
    );
  } else {
    pickup.yspeed = POWERUP_DROP.chuteFallSpeed;
    pickup.chuteScale = Math.min(
      100,
      pickup.chuteScale + POWERUP_DROP.chuteScaleRate * timeStep,
    );
  }

  pickup.y += pickup.yspeed * timeStep;

  const tile = WORLD.tile;
  const col = Math.floor(pickup.x / tile);
  const footRow = Math.floor((pickup.y + POWERUP_DROP.crateH / 2) / tile);

  if (!pickup.fall) {
    const lookRow = Math.floor(
      (pickup.y + POWERUP_DROP.groundLookaheadPx) / tile,
    );
    if (getTile(map, col, lookRow) !== TILE_EMPTY) {
      pickup.fall = true;
    }
    return;
  }

  if (getTile(map, col, footRow) === TILE_EMPTY) {
    return;
  }

  if (pickup.yspeed < POWERUP_DROP.softLandSpeed) {
    pickup.y = footRow * tile - POWERUP_DROP.crateH / 2 + 2;
    pickup.yspeed = 0;
    pickup.stopped = true;
    pickup.chuteScale = 0;
  } else {
    pickup.y = footRow * tile - POWERUP_DROP.crateH / 2 - 2;
    pickup.yspeed *= POWERUP_DROP.bounceScale;
    pickup.y += pickup.yspeed * timeStep;
  }
}

/** Step every active crate. */
export function stepPowerups(
  powerups: PowerupPickup[],
  map: TileMap,
  timeStep: number,
): void {
  for (let i = 0; i < powerups.length; i += 1) {
    stepPowerup(powerups[i]!, map, timeStep);
  }
}

/**
 * Collect any overlapping active crates. Removes inactive entries afterward.
 * Returns collect results in encounter order.
 */
export function collectPowerups(
  powerups: PowerupPickup[],
  body: AabbBody,
  health: PlayerHealthState,
  inventory: WeaponInventory,
  powerupState: PlayerPowerupState,
  rng: SpawnRng,
): PowerupCollectResult[] {
  const results: PowerupCollectResult[] = [];
  for (let i = 0; i < powerups.length; i += 1) {
    const pickup = powerups[i]!;
    if (!pickup.active) {
      continue;
    }
    if (!powerupOverlapsPlayer(pickup, body)) {
      continue;
    }
    results.push(
      applyPowerupCollect(pickup, health, inventory, powerupState, rng),
    );
  }
  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    if (!powerups[i]!.active) {
      powerups.splice(i, 1);
    }
  }
  return results;
}

/** Spec sanity — health threshold / every-3 cadence / state ids match config. */
export function powerupDropMatchesSpec(): boolean {
  return (
    HEALTH_PICKUP.firstThreshold === 15 &&
    HEALTH_PICKUP.amount === 20 &&
    HEALTH_PICKUP.cap === 100 &&
    POWERUP_DROP.killsPerCrate === 3 &&
    POWERUP_FRAMES === 500 &&
    POWERUP.TriDamage === 1 &&
    POWERUP.Jetpack === 5
  );
}
