/**
 * Powerup drop & pickup — issue #21 acceptance criteria.
 *
 * AC: Health drops on threshold kills
 * AC: Weapon drops appear ~3% over many kills; touch collects
 *
 * Spec: nextHealth starts at 15 then doubles; random(100)%32==0 ≈ 3%;
 * health pickup +20 capped at 100; parachute fall then AABB collect.
 */

import { describe, expect, it } from 'vitest';
import {
  HEALTH_PICKUP,
  HELI,
  POWERUP_DROP,
  POWERUP_FRAMES,
  WORLD,
} from '../config/constants';
import { WEAPON_PICKUP_AMMO } from '../config/weapons';
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
  powerupDropMatchesSpec,
  powerupOverlapsPlayer,
  rollsWeaponDrop,
  spawnPowerup,
  stepPowerup,
  stepPowerups,
  trySpawnDropOnKill,
  type PowerupPickup,
} from './powerupDrop';
import { createPlayerHealth, healPlayer } from './playerHealth';
import { createWeaponInventory } from './weaponInventory';

describe('powerup drop & pickup (issue #21)', () => {
  it('locks drop chance, health threshold, and pickup amounts to exact spec', () => {
    expect(powerupDropMatchesSpec()).toBe(true);
    expect(HEALTH_PICKUP).toEqual({
      amount: 20,
      cap: 100,
      firstThreshold: 15,
    });
    expect(POWERUP_DROP.chanceRange).toBe(100);
    expect(POWERUP_DROP.chanceModulus).toBe(32);
    expect(POWERUP_DROP.nonHealthFrameCount).toBe(13);
    expect(POWERUP_DROP.crateW).toBe(33);
    expect(POWERUP_DROP.crateH).toBe(32);
    expect(POWERUP_DROP.chuteFallSpeed).toBe(2);
    expect(POWERUP_FRAMES).toBe(500);
  });

  it('rollsWeaponDrop matches Flash random(100)%32==0 (4 of 100 ≈ 3–4%)', () => {
    const hits: number[] = [];
    for (let roll = 0; roll < POWERUP_DROP.chanceRange; roll += 1) {
      if (rollsWeaponDrop(roll)) {
        hits.push(roll);
      }
    }
    expect(hits).toEqual([0, 32, 64, 96]);
    expect(hits.length / POWERUP_DROP.chanceRange).toBeCloseTo(0.04, 5);
  });

  it('health drops on doubling kill thresholds starting at 15 (AC)', () => {
    const dropState = createPowerupDropState();
    expect(dropState.nextHealth).toBe(15);

    // Force weapon-miss rolls so only thresholds spawn.
    const missRng = {
      next: (): number => 0.5, // floor(0.5*100)=50; 50%32!=0
    };

    expect(decideKillDrop(1, dropState, missRng)).toBeNull();
    expect(dropState.nextHealth).toBe(15);

    expect(decideKillDrop(14, dropState, missRng)).toBeNull();
    const at15 = decideKillDrop(15, dropState, missRng);
    expect(at15).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(30);

    expect(decideKillDrop(29, dropState, missRng)).toBeNull();
    expect(decideKillDrop(30, dropState, missRng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(60);

    expect(decideKillDrop(60, dropState, missRng)).toEqual({ kind: 'health' });
    expect(dropState.nextHealth).toBe(120);

    expect(decideKillDrop(120, dropState, missRng)).toEqual({
      kind: 'health',
    });
    expect(dropState.nextHealth).toBe(240);
  });

  it('weapon drops appear ~3–4% over many non-threshold kills (AC)', () => {
    const dropState = createPowerupDropState();
    // Keep nextHealth far away so health never wins.
    dropState.nextHealth = 1_000_000;

    const rng = createSpawnRng(42);
    const trials = 10_000;
    let drops = 0;
    let weapons = 0;
    let states = 0;
    for (let i = 0; i < trials; i += 1) {
      const d = decideKillDrop(i + 1, dropState, rng);
      if (d === null) {
        continue;
      }
      drops += 1;
      if (d.kind === 'weapon') {
        weapons += 1;
        expect(d.weaponIndex).toBeGreaterThanOrEqual(1);
        expect(d.weaponIndex).toBeLessThanOrEqual(12);
      } else if (d.kind === 'state') {
        states += 1;
      } else {
        expect.fail('health should not drop with nextHealth far away');
      }
    }

    const rate = drops / trials;
    // Spec ≈ 3%; Flash gate is exactly 4/100 = 4%. Allow sampling noise.
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.055);
    expect(weapons + states).toBe(drops);
    expect(weapons).toBeGreaterThan(states); // 12 weapon frames vs 1 state
  });

  it('health threshold takes priority over the weapon-drop roll', () => {
    const dropState = createPowerupDropState();
    // Always roll 0 → would be a weapon drop if health did not win.
    const alwaysHit = { next: (): number => 0 };
    expect(decideKillDrop(15, dropState, alwaysHit)).toEqual({
      kind: 'health',
    });
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

  it('trySpawnDropOnKill pushes health at threshold into the list', () => {
    const dropState = createPowerupDropState();
    const powerups: PowerupPickup[] = [];
    const missRng = { next: (): number => 0.5 };
    expect(
      trySpawnDropOnKill(14, dropState, powerups, 100, 200, missRng),
    ).toBeNull();
    expect(powerups).toHaveLength(0);

    const spawned = trySpawnDropOnKill(
      15,
      dropState,
      powerups,
      100,
      200,
      missRng,
    );
    expect(spawned?.kind).toBe('health');
    expect(powerups).toHaveLength(1);
    expect(powerups[0]!.x).toBe(100);
    expect(powerups[0]!.y).toBe(200);
    expect(dropState.nextHealth).toBe(30);
  });

  it('SimSession spawns a health crate on the 15th kill and collects on touch', () => {
    const session = new SimSession();
    session.reset();
    expect(session.powerupDrop.nextHealth).toBe(15);
    expect(session.powerups).toHaveLength(0);

    const miss = { next: (): number => 0.5 };
    for (let k = 1; k <= 14; k += 1) {
      trySpawnDropOnKill(k, session.powerupDrop, session.powerups, 0, 0, miss);
    }
    expect(session.powerups).toHaveLength(0);
    expect(session.powerupDrop.nextHealth).toBe(15);

    trySpawnDropOnKill(
      15,
      session.powerupDrop,
      session.powerups,
      400,
      100,
      miss,
    );
    expect(session.powerups).toHaveLength(1);
    expect(session.powerups[0]!.kind).toBe('health');

    session.playerHealth.health = 50;
    session.player.body.x = 400 - 5;
    session.player.body.y = 100 - 20;
    const collected = collectPowerups(
      session.powerups,
      session.player.body,
      session.playerHealth,
      session.inventory,
      session.playerPowerup,
      miss,
    );
    expect(collected).toEqual([{ kind: 'health', amount: 20 }]);
    expect(session.playerHealth.health).toBe(70);
    expect(session.powerups).toHaveLength(0);
  });

  it('SimSession kill path drops health at kill 15 and steps parachutes', () => {
    const session = new SimSession();
    session.reset();

    for (let k = 0; k < 15; k += 1) {
      const victim = session.helicopters.find((h) => h.active);
      expect(victim).toBeDefined();
      // Instant-kill via fatal damage, then one sim tick so the bullet-hit
      // path is not required — drive the same post-kill hooks SimSession uses.
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
    const healthCrates = session.powerups.filter((p) => p.kind === 'health');
    expect(healthCrates.length).toBe(1);

    const crate = healthCrates[0]!;
    const y0 = crate.y;
    stepPowerups(session.powerups, session.map, 1);
    // Parachute descent moves the crate downward.
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
