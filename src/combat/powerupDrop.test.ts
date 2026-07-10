/**
 * Powerup drop & pickup — issues #21 / #91 acceptance criteria.
 *
 * AC (#91): Weapon crate every 3 heli kills (deterministic cadence)
 * AC (#91): Pickup grants finite Flash ammo; MachineGun stays ∞-only
 * AC (#91): Empty limited weapons fall back / unselectable at 0 ammo
 * AC (#21): Health drops on doubling thresholds via the shared crate channel
 *
 * Spec: Flash `helis == 3` always attaches a crate; health when
 * `rthelis >= nextHealth` (15→30→60…); else weapon/state frame. Pickup ammo
 * from {@link WEAPON_PICKUP_AMMO}.
 */

import { describe, expect, it } from 'vitest';
import {
  HEALTH_PICKUP,
  HELI,
  POWERUP_DROP,
  POWERUP_FRAMES,
  WORLD,
} from '../config/constants';
import {
  PREDATOR_WEAPON_INDEX,
  WEAPONS,
  WEAPON_PICKUP_AMMO,
} from '../config/weapons';
import { SimSession } from '../core/simSession';
import { createAabbBody } from '../world/aabbBody';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import { createTileMap, TILE_EMPTY, TILE_SOLID } from '../world/tileMap';
import { createSpawnRng, damageHelicopter } from './helicopter';
import { ensureHeliPopulation, recordHeliKill } from './heliSpawn';
import {
  applyPowerupCollect,
  collectPowerups,
  createPlayerPowerupState,
  createPowerupDropState,
  decideKillDrop,
  isCrateKill,
  powerupDropMatchesSpec,
  powerupOverlapsPlayer,
  spawnPowerup,
  stepPowerup,
  stepPowerups,
  trySpawnDropOnKill,
  type PowerupPickup,
} from './powerupDrop';
import { createPlayerHealth, healPlayer } from './playerHealth';
import { stepWeaponFire } from './weapon';
import {
  createWeaponInventory,
  fallbackIfActiveEmpty,
  grantWeaponAmmo,
  isWeaponOwned,
  selectWeapon,
} from './weaponInventory';

describe('powerup drop & pickup (issues #21 / #91)', () => {
  it('locks every-3 cadence, health threshold, and pickup amounts to exact spec', () => {
    expect(powerupDropMatchesSpec()).toBe(true);
    expect(HEALTH_PICKUP).toEqual({
      amount: 20,
      cap: 100,
      firstThreshold: 15,
    });
    expect(POWERUP_DROP.killsPerCrate).toBe(3);
    expect(POWERUP_DROP.nonHealthFrameCount).toBe(13);
    expect(POWERUP_DROP.crateW).toBe(33);
    expect(POWERUP_DROP.crateH).toBe(32);
    expect(POWERUP_DROP.chuteFallSpeed).toBe(2);
    expect(POWERUP_FRAMES).toBe(500);
    // Finite Flash pickup ammo for limited guns 1..12 — never Infinity.
    expect(WEAPON_PICKUP_AMMO).toEqual({
      1: 50,
      2: 14,
      3: 8,
      4: 12,
      5: 10,
      6: 8,
      7: 6,
      8: 150,
      9: 3,
      10: 2,
      11: 3,
      12: 2,
    });
    for (const ammo of Object.values(WEAPON_PICKUP_AMMO)) {
      expect(Number.isFinite(ammo)).toBe(true);
      expect(ammo).toBeGreaterThan(0);
    }
  });

  it('isCrateKill matches Flash helis==3 every-N cadence', () => {
    expect(isCrateKill(0)).toBe(false);
    expect(isCrateKill(1)).toBe(false);
    expect(isCrateKill(2)).toBe(false);
    expect(isCrateKill(3)).toBe(true);
    expect(isCrateKill(4)).toBe(false);
    expect(isCrateKill(6)).toBe(true);
    expect(isCrateKill(15)).toBe(true);
    expect(isCrateKill(3, POWERUP_DROP.killsPerCrate)).toBe(true);
  });

  it('spawns a weapon crate every 3 heli kills — deterministic cadence (AC #91)', () => {
    const dropState = createPowerupDropState();
    // Keep nextHealth far away so health never wins the shared channel.
    dropState.nextHealth = 1_000_000;
    const rng = createSpawnRng(42);

    const decisions = [];
    for (let k = 1; k <= 30; k += 1) {
      decisions.push(decideKillDrop(k, dropState, rng));
    }

    // Non-multiples of 3 never drop.
    for (const k of [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16]) {
      expect(decisions[k - 1]).toBeNull();
    }

    // Every 3rd kill always drops weapon or state (never null, never health).
    for (let k = 3; k <= 30; k += 3) {
      const d = decisions[k - 1] ?? null;
      expect(d).not.toBeNull();
      expect(d).not.toBeUndefined();
      if (d === null) {
        continue;
      }
      expect(d.kind === 'weapon' || d.kind === 'state').toBe(true);
      if (d.kind === 'weapon') {
        expect(d.weaponIndex).toBeGreaterThanOrEqual(1);
        expect(d.weaponIndex).toBeLessThanOrEqual(12);
      }
    }

    // Exactly 10 crates across 30 kills (30/3).
    const crates = decisions.filter((d) => d !== null);
    expect(crates).toHaveLength(10);
  });

  it('health drops on doubling kill thresholds via the every-3 channel (AC #21/#93)', () => {
    const dropState = createPowerupDropState();
    expect(dropState.nextHealth).toBe(15);
    const rng = createSpawnRng(1);

    // Off-cadence kills never drop, even past a threshold conceptually.
    expect(decideKillDrop(1, dropState, rng)).toBeNull();
    expect(decideKillDrop(14, dropState, rng)).toBeNull();
    expect(dropState.nextHealth).toBe(15);

    // Kill 15 is both every-3 and first health threshold.
    expect(decideKillDrop(15, dropState, rng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(30);

    expect(decideKillDrop(18, dropState, rng)?.kind).not.toBe('health');
    expect(decideKillDrop(30, dropState, rng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(60);

    expect(decideKillDrop(60, dropState, rng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(120);

    expect(decideKillDrop(120, dropState, rng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(240);
  });

  it('health threshold takes priority over weapon on the shared every-3 slot', () => {
    const dropState = createPowerupDropState();
    const rng = createSpawnRng(99);
    expect(decideKillDrop(15, dropState, rng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(30);
  });

  it('healPlayer applies +20 capped at 100 (Flash health pickup)', () => {
    const health = createPlayerHealth();
    health.health = 90;
    expect(healPlayer(health)).toBe(10);
    expect(health.health).toBe(100);
    expect(healPlayer(health)).toBe(0);
    health.health = 50;
    expect(healPlayer(health, HEALTH_PICKUP.amount, HEALTH_PICKUP.cap)).toBe(
      20,
    );
    expect(health.health).toBe(70);
  });

  it('weapon pickup grants finite Flash ammo — never infinite on limited guns (AC #91)', () => {
    const health = createPlayerHealth();
    const inventory = createWeaponInventory();
    const powerupState = createPlayerPowerupState();
    const rng = createSpawnRng(7);

    // MachineGun starts infinite and is the only ∞ slot in normal play.
    expect(inventory.slots[0]!.bullets).toBe(Number.POSITIVE_INFINITY);
    for (let i = 1; i < PREDATOR_WEAPON_INDEX; i += 1) {
      expect(inventory.slots[i]!.bullets).toBe(0);
      expect(isWeaponOwned(inventory, i)).toBe(false);
    }

    for (const [indexStr, expectedAmmo] of Object.entries(WEAPON_PICKUP_AMMO)) {
      const weaponIndex = Number(indexStr);
      const crate = spawnPowerup(0, 0, { kind: 'weapon', weaponIndex });
      const before = inventory.slots[weaponIndex]!.bullets;
      const result = applyPowerupCollect(
        crate,
        health,
        inventory,
        powerupState,
        rng,
      );
      expect(result).toEqual({
        kind: 'weapon',
        amount: expectedAmmo,
        weaponIndex,
      });
      expect(Number.isFinite(result.amount)).toBe(true);
      expect(inventory.slots[weaponIndex]!.bullets).toBe(before + expectedAmmo);
      expect(Number.isFinite(inventory.slots[weaponIndex]!.bullets)).toBe(true);
      expect(isWeaponOwned(inventory, weaponIndex)).toBe(true);
    }

    // MachineGun still infinite; predator slot untouched by weapon pickups.
    expect(inventory.slots[0]!.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(inventory.slots[PREDATOR_WEAPON_INDEX]!.bullets).toBe(
      Number.POSITIVE_INFINITY,
    );

    // grantWeaponAmmo refuses to top up MG / predator / non-finite amounts.
    grantWeaponAmmo(inventory, 0, 99);
    expect(inventory.slots[0]!.bullets).toBe(Number.POSITIVE_INFINITY);
    grantWeaponAmmo(inventory, 2, Number.POSITIVE_INFINITY);
    expect(inventory.slots[2]!.bullets).toBe(WEAPON_PICKUP_AMMO[2]);
  });

  it('empty limited weapons fall back to MachineGun and become unselectable (AC #91)', () => {
    const inv = createWeaponInventory();
    grantWeaponAmmo(inv, 2, 1);
    expect(selectWeapon(inv, 2)).toBe(true);
    expect(inv.activeIndex).toBe(2);

    // Spend the last shot.
    expect(stepWeaponFire(inv.slots[2]!, true, WEAPONS[2])).toBe(true);
    expect(inv.slots[2]!.bullets).toBe(0);
    fallbackIfActiveEmpty(inv);
    expect(inv.activeIndex).toBe(0);
    expect(isWeaponOwned(inv, 2)).toBe(false);
    expect(selectWeapon(inv, 2)).toBe(false);
    expect(inv.activeIndex).toBe(0);
  });

  it('touch collects health and weapon crates (AC)', () => {
    const health = createPlayerHealth();
    health.health = 40;
    const inventory = createWeaponInventory();
    const powerupState = createPlayerPowerupState();
    const rng = createSpawnRng(7);
    const body = createAabbBody(100, 200, 10, 42);

    const healthCrate = spawnPowerup(105, 220, { kind: 'health' });
    expect(powerupOverlapsPlayer(healthCrate, body)).toBe(true);
    const healthResult = applyPowerupCollect(
      healthCrate,
      health,
      inventory,
      powerupState,
      rng,
    );
    expect(healthResult).toEqual({ kind: 'health', amount: 20 });
    expect(health.health).toBe(60);
    expect(healthCrate.active).toBe(false);

    const weaponCrate = spawnPowerup(105, 220, {
      kind: 'weapon',
      weaponIndex: 2,
    });
    const before = inventory.slots[2]!.bullets;
    const weaponResult = applyPowerupCollect(
      weaponCrate,
      health,
      inventory,
      powerupState,
      rng,
    );
    expect(weaponResult.kind).toBe('weapon');
    expect(weaponResult.amount).toBe(WEAPON_PICKUP_AMMO[2]);
    if (weaponResult.kind === 'weapon') {
      expect(weaponResult.weaponIndex).toBe(2);
    }
    expect(inventory.slots[2]!.bullets).toBe(before + WEAPON_PICKUP_AMMO[2]!);
  });

  it('state crate rolls powerupOn 1..5 and POWERUP_FRAMES timer', () => {
    const health = createPlayerHealth();
    const inventory = createWeaponInventory();
    const powerupState = createPlayerPowerupState();
    const rng = createSpawnRng(99);
    const crate = spawnPowerup(0, 0, { kind: 'state' });
    const result = applyPowerupCollect(
      crate,
      health,
      inventory,
      powerupState,
      rng,
    );
    expect(result.kind).toBe('state');
    expect(result.amount).toBeGreaterThanOrEqual(1);
    expect(result.amount).toBeLessThanOrEqual(5);
    expect(powerupState.powerupOn).toBe(result.amount);
    expect(powerupState.powerupTime).toBe(POWERUP_FRAMES);
  });

  it('parachuting crates descend slowly then land on solid tiles', () => {
    // 3×4 map: air above, solid floor on row 3.
    const map = createTileMap([
      [TILE_EMPTY, TILE_EMPTY, TILE_EMPTY],
      [TILE_EMPTY, TILE_EMPTY, TILE_EMPTY],
      [TILE_EMPTY, TILE_EMPTY, TILE_EMPTY],
      [TILE_SOLID, TILE_SOLID, TILE_SOLID],
    ]);
    const pickup = spawnPowerup(WORLD.tile * 1.5, 10, { kind: 'health' });
    expect(pickup.fall).toBe(false);
    expect(pickup.yspeed).toBe(POWERUP_DROP.chuteFallSpeed);

    // While chute is open, descent is the slow chute speed.
    for (let i = 0; i < 5; i += 1) {
      const yBefore = pickup.y;
      stepPowerup(pickup, map, 1);
      if (!pickup.fall && !pickup.stopped) {
        expect(pickup.y - yBefore).toBeCloseTo(POWERUP_DROP.chuteFallSpeed, 5);
        expect(pickup.chuteScale).toBeGreaterThan(0);
      }
    }

    // Drive until stopped on the floor.
    for (let i = 0; i < 200 && !pickup.stopped; i += 1) {
      stepPowerup(pickup, map, 1);
    }
    expect(pickup.stopped).toBe(true);
    expect(pickup.yspeed).toBe(0);
    expect(pickup.y).toBeLessThan(WORLD.tile * 4);
  });

  it('collectPowerups removes crates on player overlap', () => {
    const health = createPlayerHealth();
    health.health = 80;
    const inventory = createWeaponInventory();
    const powerupState = createPlayerPowerupState();
    const body = createAabbBody(50, 50, 10, 42);
    const powerups: PowerupPickup[] = [
      spawnPowerup(55, 60, { kind: 'health' }),
      spawnPowerup(500, 500, { kind: 'weapon', weaponIndex: 1 }),
    ];
    const results = collectPowerups(
      powerups,
      body,
      health,
      inventory,
      powerupState,
      createSpawnRng(1),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.kind).toBe('health');
    expect(powerups).toHaveLength(1);
    expect(powerups[0]!.kind).toBe('weapon');
    expect(health.health).toBe(100);
  });

  it('trySpawnDropOnKill pushes a weapon crate on kill 3 and health on kill 15', () => {
    const dropState = createPowerupDropState();
    const powerups: PowerupPickup[] = [];
    const rng = createSpawnRng(3);

    expect(
      trySpawnDropOnKill(1, dropState, powerups, 100, 200, rng),
    ).toBeNull();
    expect(
      trySpawnDropOnKill(2, dropState, powerups, 100, 200, rng),
    ).toBeNull();
    expect(powerups).toHaveLength(0);

    const at3 = trySpawnDropOnKill(3, dropState, powerups, 100, 200, rng);
    expect(at3).not.toBeNull();
    expect(at3!.kind === 'weapon' || at3!.kind === 'state').toBe(true);
    expect(powerups).toHaveLength(1);
    expect(powerups[0]!.x).toBe(100);
    expect(powerups[0]!.y).toBe(200);

    // Advance to health threshold (kills 6..14 off-cadence or weapon slots).
    for (let k = 6; k <= 12; k += 3) {
      trySpawnDropOnKill(k, dropState, powerups, 0, 0, rng);
    }
    const healthSpawn = trySpawnDropOnKill(
      15,
      dropState,
      powerups,
      50,
      60,
      rng,
    );
    expect(healthSpawn?.kind).toBe('health');
    expect(dropState.nextHealth).toBe(30);
  });

  it('SimSession spawns a health crate on the 15th kill and collects on touch', () => {
    const session = new SimSession();
    session.reset();
    expect(session.powerupDrop.nextHealth).toBe(15);
    expect(session.powerups).toHaveLength(0);

    const rng = createSpawnRng(1);
    for (let k = 1; k <= 14; k += 1) {
      trySpawnDropOnKill(k, session.powerupDrop, session.powerups, 0, 0, rng);
    }
    // Kills 3,6,9,12 each drop a weapon/state crate; not health yet.
    expect(session.powerups.every((p) => p.kind !== 'health')).toBe(true);
    expect(session.powerupDrop.nextHealth).toBe(15);

    trySpawnDropOnKill(
      15,
      session.powerupDrop,
      session.powerups,
      400,
      100,
      rng,
    );
    const healthCrates = session.powerups.filter((p) => p.kind === 'health');
    expect(healthCrates).toHaveLength(1);

    session.playerHealth.health = 50;
    session.player.body.x = 400 - 5;
    session.player.body.y = 100 - 20;
    // Collect only the health crate at the player.
    const collected = collectPowerups(
      session.powerups,
      session.player.body,
      session.playerHealth,
      session.inventory,
      session.playerPowerup,
      rng,
    );
    expect(collected.some((c) => c.kind === 'health' && c.amount === 20)).toBe(
      true,
    );
    expect(session.playerHealth.health).toBe(70);
  });

  it('SimSession kill path drops a crate every 3 kills and health at 15', () => {
    const session = new SimSession();
    session.reset();

    for (let k = 0; k < 15; k += 1) {
      const victim = session.helicopters.find((h) => h.active);
      expect(victim).toBeDefined();
      damageHelicopter(victim!, HELI.hp);
      recordHeliKill(session.heliSpawn, session.score.value + HELI.hp);
      session.score.value += HELI.hp;
      trySpawnDropOnKill(
        session.heliSpawn.kills,
        session.powerupDrop,
        session.powerups,
        victim!.x,
        victim!.y,
        session.spawnRng,
      );
      ensureHeliPopulation(
        session.helicopters,
        session.heliSpawn,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        session.spawnRng,
      );
    }

    expect(session.heliSpawn.kills).toBe(15);
    expect(session.powerupDrop.nextHealth).toBe(30);
    // 5 every-3 slots (3,6,9,12,15) — last is health.
    expect(session.powerups).toHaveLength(5);
    const healthCrates = session.powerups.filter((p) => p.kind === 'health');
    expect(healthCrates.length).toBe(1);

    const crate = healthCrates[0]!;
    const y0 = crate.y;
    stepPowerups(session.powerups, session.map, 1);
    expect(crate.y).toBeGreaterThan(y0);
  });

  it('stepPowerup no-ops when stopped; collect skips non-overlapping crates', () => {
    const map = createTileMap([[TILE_SOLID]]);
    const stopped = spawnPowerup(10, 10, { kind: 'health' });
    stopped.stopped = true;
    const y = stopped.y;
    stepPowerup(stopped, map, 1);
    expect(stopped.y).toBe(y);

    const health = createPlayerHealth();
    const inventory = createWeaponInventory();
    const powerupState = createPlayerPowerupState();
    const far = spawnPowerup(900, 900, { kind: 'health' });
    const body = createAabbBody(0, 0, 10, 42);
    expect(
      collectPowerups(
        [far],
        body,
        health,
        inventory,
        powerupState,
        createSpawnRng(1),
      ),
    ).toEqual([]);
    expect(far.active).toBe(true);
  });
});
