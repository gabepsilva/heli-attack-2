/**
 * Timed state powerup effects — issue #22 acceptance criteria.
 *
 * Asserts exact spec values (×3 damage, 500-frame timer, jetpack −2/−32,
 * TimeRift player override) rather than merely exercising call paths.
 */

import { describe, expect, it } from 'vitest';
import {
  BULLET_TIME,
  PLAYER,
  POWERUP,
  POWERUP_EFFECTS,
  POWERUP_FRAMES,
} from '../config/constants';
import { PREDATOR_WEAPON_INDEX, WEAPONS } from '../config/weapons';
import {
  createPlayerHealth,
  damagePlayer,
} from './playerHealth';
import { createPlayerPowerupState } from './powerupDrop';
import {
  applyJetpackThrust,
  canSwitchWeapons,
  hasActivePowerup,
  isJetpackActive,
  isPowerupInvulnerable,
  playerPowerupAlpha,
  playerTimeStepForPowerup,
  powerupEffectsMatchSpec,
  powerupTimeFraction,
  predatorSpriteAlpha,
  stepPlayerPowerup,
  syncPredatorWeapon,
  weaponDamageMultiplier,
} from './powerupEffects';
import {
  createWeaponInventory,
  nextWeapon,
  selectWeapon,
  selectWeaponByDigitKey,
} from './weaponInventory';
import { SimSession } from '../core/simSession';
import {
  createSpawnRng,
  createHelicopter,
  stepHeliGunAim,
} from './helicopter';
import {
  EnemyBulletPool,
  stepEnemyBulletsVsPlayer,
} from './enemyBullet';
import { createAabbBody } from '../world/aabbBody';

describe('powerup effects (issue #22)', () => {
  it('matches portable spec constants', () => {
    expect(powerupEffectsMatchSpec()).toBe(true);
    expect(POWERUP_FRAMES).toBe(500);
    expect(POWERUP_EFFECTS.triDamageMultiplier).toBe(3);
    expect(POWERUP_EFFECTS.jetpackThrust).toBe(2);
    expect(POWERUP_EFFECTS.jetpackMaxUpSpeed).toBe(-32);
    expect(POWERUP_EFFECTS.jetpackMaxUpSpeed).toBe(PLAYER.boostVel);
  });

  it('TriDamage multiplies weapon damage by exactly 3', () => {
    expect(weaponDamageMultiplier(POWERUP.TriDamage)).toBe(3);
    expect(weaponDamageMultiplier(0)).toBe(1);
    expect(weaponDamageMultiplier(POWERUP.Invulnerability)).toBe(1);

    const session = new SimSession();
    session.playerPowerup.powerupOn = POWERUP.TriDamage;
    session.playerPowerup.powerupTime = POWERUP_FRAMES;
    session.fireHeld = true;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;

    const before = session.bullets.activeCount;
    session.update(1000 / 30);
    expect(session.bullets.activeCount).toBeGreaterThan(before);

    const mgDamage = WEAPONS[0].damage;
    expect(mgDamage).toBe(10);
    let found = false;
    for (const slot of session.bullets.slots) {
      if (slot.active) {
        expect(slot.damage).toBe(mgDamage * 3);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('Invulnerability blocks all player damage (powerupon != 2 gate)', () => {
    expect(isPowerupInvulnerable(POWERUP.Invulnerability)).toBe(true);
    expect(isPowerupInvulnerable(POWERUP.TriDamage)).toBe(false);

    const health = createPlayerHealth();
    const body = createAabbBody(100, 200, 10, 42);
    const pool = new EnemyBulletPool(4);
    const bounds = { minX: -100, minY: -100, maxX: 2000, maxY: 2000 };
    // speed 0 so motion does not leave the hitbox before the overlap test.
    pool.acquire(105, 220, 0, 0, 10);

    stepEnemyBulletsVsPlayer(
      pool,
      body,
      health,
      bounds,
      1,
      undefined,
      undefined,
      POWERUP.Invulnerability,
    );
    expect(health.health).toBe(100);
    expect(pool.activeCount).toBe(0); // bullet still consumed

    // Without the powerup, same setup deals damage.
    const health2 = createPlayerHealth();
    pool.acquire(105, 220, 0, 0, 10);
    stepEnemyBulletsVsPlayer(pool, body, health2, bounds, 1);
    expect(health2.health).toBe(90);
  });

  it('PredatorMode forces predator gun, locks switching, and hides the player', () => {
    expect(canSwitchWeapons(POWERUP.PredatorMode)).toBe(false);
    expect(canSwitchWeapons(0)).toBe(true);
    expect(playerPowerupAlpha(POWERUP.PredatorMode, 0)).toBe(0);
    expect(predatorSpriteAlpha(4)).toBe(0.1);
    expect(predatorSpriteAlpha(8)).toBe(0.04);

    const inv = createWeaponInventory({ testGrant: true });
    expect(selectWeapon(inv, 2)).toBe(true);
    expect(inv.activeIndex).toBe(2);

    syncPredatorWeapon(inv, POWERUP.PredatorMode);
    expect(inv.activeIndex).toBe(PREDATOR_WEAPON_INDEX);

    expect(nextWeapon(inv, POWERUP.PredatorMode)).toBe(false);
    expect(selectWeapon(inv, 1, POWERUP.PredatorMode)).toBe(false);
    expect(selectWeaponByDigitKey(inv, 3, POWERUP.PredatorMode)).toBe(false);
    expect(inv.activeIndex).toBe(PREDATOR_WEAPON_INDEX);

    syncPredatorWeapon(inv, 0, POWERUP.PredatorMode);
    expect(inv.activeIndex).toBe(0);
  });

  it('PredatorMode randomizes heli aim away from the player', () => {
    const heli = createHelicopter(400, 200);
    heli.gunRotationDeg = 0;
    const rng = createSpawnRng(42);
    const playerX = 400;
    const playerY = 400;

    // Normal aim tracks the player (down).
    const normalTarget = stepHeliGunAim(heli, playerX, playerY, 1);
    expect(normalTarget).toBeCloseTo(90, 0); // straight down

    // Predator aim with fixed rng should not stay locked on player X.
    heli.gunRotationDeg = 0;
    const targets = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      heli.gunRotationDeg = 0;
      const t = stepHeliGunAim(
        heli,
        playerX,
        playerY,
        1,
        10,
        true,
        rng,
        800,
      );
      targets.add(Math.round(t));
    }
    expect(targets.size).toBeGreaterThan(1);
    expect(targets.has(90)).toBe(true); // still can roll near player by chance
  });

  it('TimeRift slows the world but not the player, without draining the meter', () => {
    expect(playerTimeStepForPowerup(0.2, POWERUP.TimeRift)).toBe(1);
    expect(playerTimeStepForPowerup(0.2, 0)).toBe(0.2);

    const session = new SimSession();
    session.playerPowerup.powerupOn = POWERUP.TimeRift;
    session.playerPowerup.powerupTime = POWERUP_FRAMES;
    session.bulletTimeHeld = false;
    const meterBefore = session.bulletTime.meter;

    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.timeScale.timeStep).toBe(0.2);
    expect(session.bulletTime.meter).toBe(meterBefore);
    expect(session.bulletTime.meter).toBe(BULLET_TIME.maxFrames);

    // Player walks at full speed (timeStep 1) through the slowed world.
    for (let i = 0; i < 40; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.player.body.onGround).toBe(true);
    session.player.body.vx = PLAYER.walkCap;
    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    const x0 = session.player.body.x;
    session.update(1000 / 30);
    expect(session.timeScale.timeStep).toBe(0.2);
    expect(session.player.body.x - x0).toBeCloseTo(PLAYER.walkCap * 1, 10);
  });

  it('Jetpack enables free flight: hold jump → yspeed = max(yspeed-2, -32)', () => {
    expect(isJetpackActive(POWERUP.Jetpack, true)).toBe(true);
    expect(isJetpackActive(POWERUP.Jetpack, false)).toBe(false);
    expect(applyJetpackThrust(0)).toBe(-2);
    expect(applyJetpackThrust(-30)).toBe(-32);
    expect(applyJetpackThrust(-32)).toBe(-32);
    expect(applyJetpackThrust(10)).toBe(8);

    // Pure thrust loop reaches the Flash −32 floor.
    let vy = 0;
    for (let i = 0; i < 20; i += 1) {
      vy = applyJetpackThrust(vy);
    }
    expect(vy).toBe(-32);

    const session = new SimSession();
    session.playerPowerup.powerupOn = POWERUP.Jetpack;
    session.playerPowerup.powerupTime = POWERUP_FRAMES;
    // Place high in open air so tile collision does not cancel ascent.
    session.player.placeAt(200, 400);
    session.player.body.onGround = false;
    session.player.body.vy = 0;
    session.player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    const y0 = session.player.body.y;
    session.update(1000 / 30);
    // One frame: jetpack −2, then gravity +1 → vy = −1, moves up.
    expect(session.player.body.vy).toBe(-1);
    expect(session.player.body.y).toBeLessThan(y0);
    expect(session.player.jumpState.jump).toBe(true);
    expect(session.player.jumpState.jump2).toBe(true);

    // A few more hold frames: thrust outruns gravity (net −1/frame).
    for (let i = 0; i < 5; i += 1) {
      session.player.input.jump = true;
      session.update(1000 / 30);
    }
    expect(session.player.body.onGround).toBe(false);
    expect(session.player.body.vy).toBe(-6);
    expect(session.player.body.y).toBeLessThan(y0 - 10);
  });

  it('all timed effects expire after POWERUP_FRAMES and clear powerupOn', () => {
    const state = createPlayerPowerupState();
    state.powerupOn = POWERUP.TriDamage;
    state.powerupTime = POWERUP_FRAMES;
    expect(hasActivePowerup(state)).toBe(true);
    expect(powerupTimeFraction(state)).toBe(1);

    for (let i = 0; i < POWERUP_FRAMES - 1; i += 1) {
      const r = stepPlayerPowerup(state);
      expect(r.expired).toBe(0);
      expect(state.powerupOn).toBe(POWERUP.TriDamage);
    }
    expect(state.powerupTime).toBe(1);
    expect(powerupTimeFraction(state)).toBeCloseTo(1 / POWERUP_FRAMES, 10);

    const last = stepPlayerPowerup(state);
    expect(last.expired).toBe(POWERUP.TriDamage);
    expect(state.powerupOn).toBe(0);
    expect(state.powerupTime).toBe(0);
    expect(hasActivePowerup(state)).toBe(false);
    expect(powerupTimeFraction(state)).toBe(0);
  });

  it('SimSession expires Jetpack and restores PredatorMode weapon', () => {
    const session = new SimSession();
    session.playerPowerup.powerupOn = POWERUP.PredatorMode;
    session.playerPowerup.powerupTime = 2;
    session.update(1000 / 30);
    expect(session.playerPowerup.powerupOn).toBe(POWERUP.PredatorMode);
    expect(session.inventory.activeIndex).toBe(PREDATOR_WEAPON_INDEX);
    expect(session.playerPowerup.powerupTime).toBe(1);

    session.update(1000 / 30);
    expect(session.playerPowerup.powerupOn).toBe(0);
    expect(session.playerPowerup.powerupTime).toBe(0);
    expect(session.inventory.activeIndex).toBe(0);
  });

  it('damagePlayer still works when Invulnerability is off', () => {
    const health = createPlayerHealth();
    const result = damagePlayer(health, 10);
    expect(result.applied).toBe(10);
    expect(health.health).toBe(90);
  });
});
