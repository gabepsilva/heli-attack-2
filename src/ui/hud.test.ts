/**
 * In-game HUD — unit tests for issue #23 acceptance criteria.
 *
 * AC: Every element updates correctly in real time
 * AC: Bullet-time meter drains/refills live; powerup indicator shows remaining time
 * AC: Reads clearly at 1080p (layout anchored to design resolution)
 */

import { describe, expect, it } from 'vitest';
import {
  BULLET_TIME,
  PLAYER,
  PLAYER_COMBAT,
  POWERUP,
  POWERUP_FRAMES,
  SCORE,
  WORLD,
} from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
  createPlayerHealth,
  healPlayer,
  damagePlayer,
} from '../combat/playerHealth';
import {
  createBulletTimeState,
  refillBulletTimeOnKill,
  stepBulletTime,
} from '../core/bulletTime';
import { createBoostState } from '../player/boostPhysics';
import { createMachineGunState } from '../combat/weapon';
import {
  PREDATOR_WEAPON_INDEX,
  WEAPON_COUNT,
  WEAPONS,
} from '../config/weapons';
import { WEAPON_HUD_ICON_FRAMES, weaponHudIconFrame } from '../art/catalog';
import {
  buildHudSnapshot,
  DEATH_AMMO_HUD,
  formatAmmoHud,
  HUD_LAYOUT,
  hudDesignAnchors,
  hudSpecSeeds,
  POWERUP_HUD_NAMES,
  powerupHudName,
  weaponHudIconDisplaySize,
  weaponReloadFraction,
  type HudBuildInput,
} from './hud';

function baseInput(overrides: Partial<HudBuildInput> = {}): HudBuildInput {
  return {
    score: 0,
    health: createPlayerHealth(),
    weapon: createMachineGunState(),
    weaponDef: WEAPONS[0],
    weaponIndex: 0,
    boost: createBoostState(),
    bulletTime: createBulletTimeState(),
    powerup: { powerupOn: 0, powerupTime: 0 },
    ...overrides,
  };
}

describe('HUD layout @ 1080p (issue #23)', () => {
  it('anchors layout to the 1920×1080 design resolution', () => {
    const seeds = hudSpecSeeds();
    expect(seeds.designWidth).toBe(1920);
    expect(seeds.designHeight).toBe(1080);
    expect(HUD_LAYOUT.designWidth).toBe(GAME_WIDTH);
    expect(HUD_LAYOUT.designHeight).toBe(GAME_HEIGHT);
    expect(GAME_WIDTH).toBe(1920);
    expect(GAME_HEIGHT).toBe(1080);
  });

  it('uses readable bar/font sizes for full-HD (not tiny Flash-stage leftovers)', () => {
    // Health / meter bars wide enough to read at 1080p.
    expect(HUD_LAYOUT.health.width).toBeGreaterThanOrEqual(280);
    expect(HUD_LAYOUT.health.height).toBeGreaterThanOrEqual(24);
    expect(HUD_LAYOUT.meters.width).toBeGreaterThanOrEqual(200);
    expect(HUD_LAYOUT.meters.height).toBeGreaterThanOrEqual(14);
    // Score / ammo / crate icon large enough to scan during play.
    expect(HUD_LAYOUT.score.fontSize).toBeGreaterThanOrEqual(40);
    expect(HUD_LAYOUT.weapon.ammoFontSize).toBeGreaterThanOrEqual(28);
    expect(HUD_LAYOUT.weapon.iconDisplayScale).toBeGreaterThanOrEqual(2);
    expect(HUD_LAYOUT.powerup.fontSize).toBeGreaterThanOrEqual(22);
    // Elements stay inside the design canvas with a margin.
    expect(HUD_LAYOUT.margin).toBe(40);
    expect(HUD_LAYOUT.health.x).toBe(HUD_LAYOUT.margin);
    expect(HUD_LAYOUT.score.x).toBe(GAME_WIDTH - HUD_LAYOUT.margin);
    expect(HUD_LAYOUT.weapon.y).toBeLessThan(GAME_HEIGHT);
    expect(HUD_LAYOUT.meters.y).toBeLessThan(GAME_HEIGHT);
  });

  it('locks exact design-space corner anchors for FIT scaling (#28)', () => {
    const a = hudDesignAnchors();
    expect(a.designWidth).toBe(GAME_WIDTH);
    expect(a.designHeight).toBe(GAME_HEIGHT);
    expect(a.margin).toBe(40);
    expect(a.health).toEqual({ x: 40, y: 40 });
    expect(a.score).toEqual({ x: GAME_WIDTH - 40, y: 36 });
    expect(a.weapon).toEqual({ x: 40, y: GAME_HEIGHT - 120 });
    expect(a.powerup).toEqual({ x: 40, y: 100 });
    expect(a.meters.y).toBe(GAME_HEIGHT - 56);
    expect(a.meters.hyperJumpX).toBe(GAME_WIDTH / 2 - 300);
    expect(a.meters.bulletTimeX).toBe(GAME_WIDTH / 2 + 20);
  });
});

describe('HUD spec seeds (issue #23)', () => {
  it('locks meter capacities to exact Flash / portable-config values', () => {
    const seeds = hudSpecSeeds();
    expect(seeds.scoreDisplayScale).toBe(100);
    expect(seeds.scoreDisplayScale).toBe(SCORE.displayScale);
    expect(seeds.maxHealth).toBe(100);
    expect(seeds.maxHealth).toBe(PLAYER_COMBAT.maxHealth);
    expect(seeds.boostChargeFrames).toBe(150);
    expect(seeds.boostChargeFrames).toBe(PLAYER.boostChargeFrames);
    expect(seeds.bulletTimeMaxFrames).toBe(250);
    expect(seeds.bulletTimeMaxFrames).toBe(BULLET_TIME.maxFrames);
    expect(seeds.powerupFrames).toBe(500);
    expect(seeds.powerupFrames).toBe(POWERUP_FRAMES);
  });

  it('maps Flash powerup HUD labels 1..5', () => {
    expect(POWERUP_HUD_NAMES[POWERUP.TriDamage]).toBe('TriDamage');
    expect(POWERUP_HUD_NAMES[POWERUP.Invulnerability]).toBe('Invulnerability');
    expect(POWERUP_HUD_NAMES[POWERUP.PredatorMode]).toBe('PredatorMode');
    expect(POWERUP_HUD_NAMES[POWERUP.TimeRift]).toBe('TimeRift');
    expect(POWERUP_HUD_NAMES[POWERUP.Jetpack]).toBe('Jetpack');
    expect(powerupHudName(0)).toBe('');
    expect(powerupHudName(99)).toBe('');
  });
});

describe('HUD live updates (issue #23 AC)', () => {
  it('updates score, health, weapon/ammo, and hyper-jump from live values', () => {
    const health = createPlayerHealth();
    const weapon = createMachineGunState();
    const boost = createBoostState();

    let snap = buildHudSnapshot(baseInput({ score: 0, health, weapon, boost }));
    expect(snap.scoreText).toBe('Score: 0');
    expect(snap.displayedScore).toBe(0);
    expect(snap.healthFraction).toBe(1);
    expect(snap.healthLabel).toBe('Health: 100/100');
    expect(snap.weaponName).toBe('MachineGun');
    expect(snap.weaponIndex).toBe(0);
    expect(snap.weaponIconFrame).toBe('powermachinegun');
    expect(snap.ammoText).toBe('Infinite x');
    expect(snap.reloadFraction).toBe(1);
    expect(snap.reloadReady).toBe(true);
    expect(snap.hyperJumpFraction).toBe(1);
    expect(snap.powerupVisible).toBe(false);
    expect(snap.showDeath).toBe(false);

    // Score: Flash floor(score)*100
    snap = buildHudSnapshot(baseInput({ score: 42.7, health, weapon, boost }));
    expect(snap.scoreText).toBe('Score: 4200');
    expect(snap.displayedScore).toBe(4200);

    // Health bar drains to exact fraction after a 10-damage hit.
    damagePlayer(health, 10);
    snap = buildHudSnapshot(baseInput({ score: 42.7, health, weapon, boost }));
    expect(snap.healthFraction).toBe(0.9);
    expect(snap.healthLabel).toBe('Health: 90/100');
    expect(snap.healthAlive).toBe(true);

    healPlayer(health, 20);
    snap = buildHudSnapshot(baseInput({ health, weapon, boost }));
    expect(snap.healthFraction).toBe(1);
    expect(snap.healthLabel).toBe('Health: 100/100');

    // Weapon / ammo switch (finite ammo + partial reload).
    const shotgun = {
      type: 2,
      reloadTime: 10,
      bullets: 17,
      shots: 3,
    };
    snap = buildHudSnapshot(
      baseInput({
        health,
        weapon: shotgun,
        weaponDef: WEAPONS[2],
        weaponIndex: 2,
        boost,
      }),
    );
    expect(snap.weaponName).toBe('Shotgun');
    expect(snap.weaponIndex).toBe(2);
    expect(snap.weaponIconFrame).toBe('powershotgun');
    expect(snap.ammoText).toBe('17 x');
    expect(formatAmmoHud(17)).toBe('17 x');
    expect(WEAPONS[2].reload).toBe(25);
    expect(snap.reloadFraction).toBe(10 / 25);
    expect(weaponReloadFraction(shotgun, WEAPONS[2])).toBe(0.4);
    expect(snap.reloadReady).toBe(false);

    // Hyper-jump meter: empty after boost fire, full at 150.
    boost.charge = 0;
    snap = buildHudSnapshot(baseInput({ health, weapon, boost }));
    expect(snap.hyperJumpFraction).toBe(0);
    boost.charge = 75;
    snap = buildHudSnapshot(baseInput({ health, weapon, boost }));
    expect(snap.hyperJumpFraction).toBe(0.5);
    boost.charge = PLAYER.boostChargeFrames;
    snap = buildHudSnapshot(baseInput({ health, weapon, boost }));
    expect(snap.hyperJumpFraction).toBe(1);
  });

  it('shows death state when health hits 0', () => {
    const health = createPlayerHealth();
    // 10 hits × 10 damage with i-frames cleared between hits.
    for (let i = 0; i < 10; i += 1) {
      health.iFramesRemaining = 0;
      damagePlayer(health, 10);
    }
    const snap = buildHudSnapshot(baseInput({ health }));
    expect(snap.healthFraction).toBe(0);
    expect(snap.healthAlive).toBe(false);
    expect(snap.healthLabel).toBe('Health: DEAD');
    expect(snap.showDeath).toBe(true);
    // Flash heroDie: HUD.ammo = "0 x "
    expect(snap.ammoText).toBe(DEATH_AMMO_HUD);
    expect(snap.ammoText).toBe('0 x');
  });
});

describe('HUD bullet-time + powerup meters (issue #23 AC)', () => {
  it('drains and refills the bullet-time meter live (exact Flash 250 / ÷3)', () => {
    const bt = createBulletTimeState();
    expect(BULLET_TIME.maxFrames).toBe(250);
    expect(BULLET_TIME.refillPerKill).toBe(250 / 3);

    let snap = buildHudSnapshot(baseInput({ bulletTime: bt }));
    expect(snap.bulletTimeFraction).toBe(1);

    // Hold 50 frames → meter 200 → fraction 200/250 = 0.8
    let timeStep = WORLD.timeStep;
    for (let i = 0; i < 50; i += 1) {
      timeStep = stepBulletTime(bt, timeStep, {
        keyHeld: true,
        gameOver: false,
        timeRiftActive: false,
      });
    }
    expect(bt.meter).toBe(200);
    snap = buildHudSnapshot(baseInput({ bulletTime: bt }));
    expect(snap.bulletTimeFraction).toBeCloseTo(200 / 250, 10);

    // Empty the rest.
    for (let i = 0; i < 200; i += 1) {
      timeStep = stepBulletTime(bt, timeStep, {
        keyHeld: true,
        gameOver: false,
        timeRiftActive: false,
      });
    }
    expect(bt.meter).toBe(0);
    snap = buildHudSnapshot(baseInput({ bulletTime: bt }));
    expect(snap.bulletTimeFraction).toBe(0);

    // Kill refill: +⅓ max, capped at 250.
    refillBulletTimeOnKill(bt);
    expect(bt.meter).toBeCloseTo(BULLET_TIME.refillPerKill, 10);
    snap = buildHudSnapshot(baseInput({ bulletTime: bt }));
    expect(snap.bulletTimeFraction).toBeCloseTo(1 / 3, 10);

    refillBulletTimeOnKill(bt);
    refillBulletTimeOnKill(bt);
    refillBulletTimeOnKill(bt);
    expect(bt.meter).toBe(BULLET_TIME.maxFrames);
    snap = buildHudSnapshot(baseInput({ bulletTime: bt }));
    expect(snap.bulletTimeFraction).toBe(1);
  });

  it('shows active powerup name and remaining-time bar (500-frame duration)', () => {
    expect(POWERUP_FRAMES).toBe(500);

    let snap = buildHudSnapshot(
      baseInput({ powerup: { powerupOn: 0, powerupTime: 0 } }),
    );
    expect(snap.powerupVisible).toBe(false);
    expect(snap.powerupName).toBe('');
    expect(snap.powerupFraction).toBe(0);

    snap = buildHudSnapshot(
      baseInput({
        powerup: { powerupOn: POWERUP.TriDamage, powerupTime: POWERUP_FRAMES },
      }),
    );
    expect(snap.powerupVisible).toBe(true);
    expect(snap.powerupName).toBe('TriDamage');
    expect(snap.powerupFraction).toBe(1);

    // Halfway through the timed effect.
    snap = buildHudSnapshot(
      baseInput({
        powerup: {
          powerupOn: POWERUP.TimeRift,
          powerupTime: POWERUP_FRAMES / 2,
        },
      }),
    );
    expect(snap.powerupName).toBe('TimeRift');
    expect(snap.powerupFraction).toBe(0.5);

    // Near expiry.
    snap = buildHudSnapshot(
      baseInput({
        powerup: { powerupOn: POWERUP.Jetpack, powerupTime: 1 },
      }),
    );
    expect(snap.powerupName).toBe('Jetpack');
    expect(snap.powerupFraction).toBeCloseTo(1 / POWERUP_FRAMES, 10);

    // Expired / cleared.
    snap = buildHudSnapshot(
      baseInput({
        powerup: { powerupOn: POWERUP.Invulnerability, powerupTime: 0 },
      }),
    );
    expect(snap.powerupVisible).toBe(false);
    expect(snap.powerupFraction).toBe(0);
  });
});

describe('HUD weapon crate + ammo (issue #105 AC)', () => {
  it('maps every cgun slot to a Flash HUD.weapon crate frame (gotoAndStop(cgun+1))', () => {
    expect(WEAPON_COUNT).toBe(14);
    expect(WEAPON_HUD_ICON_FRAMES).toHaveLength(WEAPON_COUNT);
    expect(PREDATOR_WEAPON_INDEX).toBe(13);

    // Exact Flash power*.png → arsenal index mapping.
    expect(WEAPON_HUD_ICON_FRAMES[0]).toBe('powermachinegun');
    expect(WEAPON_HUD_ICON_FRAMES[1]).toBe('poweruzi');
    expect(WEAPON_HUD_ICON_FRAMES[2]).toBe('powershotgun');
    expect(WEAPON_HUD_ICON_FRAMES[3]).toBe('powershotgunrocket');
    expect(WEAPON_HUD_ICON_FRAMES[4]).toBe('powergen');
    expect(WEAPON_HUD_ICON_FRAMES[5]).toBe('powerrpg');
    expect(WEAPON_HUD_ICON_FRAMES[6]).toBe('powerrocketlauncher');
    expect(WEAPON_HUD_ICON_FRAMES[7]).toBe('powerseeker');
    expect(WEAPON_HUD_ICON_FRAMES[8]).toBe('powerflamethrower');
    expect(WEAPON_HUD_ICON_FRAMES[9]).toBe('powermine');
    expect(WEAPON_HUD_ICON_FRAMES[10]).toBe('powerabomb');
    expect(WEAPON_HUD_ICON_FRAMES[11]).toBe('powerrail');
    expect(WEAPON_HUD_ICON_FRAMES[12]).toBe('powergrapple');
    expect(WEAPON_HUD_ICON_FRAMES[13]).toBe('powershouldercannon');

    for (let cgun = 0; cgun < WEAPON_COUNT; cgun += 1) {
      expect(weaponHudIconFrame(cgun)).toBe(WEAPON_HUD_ICON_FRAMES[cgun]);
    }
    // Out-of-range falls back to MachineGun crate (frame 1).
    expect(weaponHudIconFrame(-1)).toBe('powermachinegun');
    expect(weaponHudIconFrame(99)).toBe('powermachinegun');
  });

  it('formats ammo exactly like Flash HUD.ammo (Infinite x / N x)', () => {
    expect(formatAmmoHud(Number.POSITIVE_INFINITY)).toBe('Infinite x');
    expect(formatAmmoHud(50)).toBe('50 x');
    expect(formatAmmoHud(14)).toBe('14 x');
    expect(formatAmmoHud(0)).toBe('0 x');
    expect(formatAmmoHud(-3)).toBe('0 x');
    expect(DEATH_AMMO_HUD).toBe('0 x');
  });

  it('updates weapon crate icon + ammo live when switching or spending ammo', () => {
    // Start: MachineGun infinite.
    let snap = buildHudSnapshot(
      baseInput({
        weapon: createMachineGunState(),
        weaponDef: WEAPONS[0],
        weaponIndex: 0,
      }),
    );
    expect(snap.weaponIconFrame).toBe('powermachinegun');
    expect(snap.weaponIndex).toBe(0);
    expect(snap.ammoText).toBe('Infinite x');

    // Switch to Shotgun with 14 rounds (Flash pickup amount).
    snap = buildHudSnapshot(
      baseInput({
        weapon: { type: 2, reloadTime: 25, bullets: 14, shots: 0 },
        weaponDef: WEAPONS[2],
        weaponIndex: 2,
      }),
    );
    expect(snap.weaponIconFrame).toBe('powershotgun');
    expect(snap.ammoText).toBe('14 x');

    // Spend one round.
    snap = buildHudSnapshot(
      baseInput({
        weapon: { type: 2, reloadTime: 0, bullets: 13, shots: 1 },
        weaponDef: WEAPONS[2],
        weaponIndex: 2,
      }),
    );
    expect(snap.weaponIconFrame).toBe('powershotgun');
    expect(snap.ammoText).toBe('13 x');

    // Gain ammo (pickup).
    snap = buildHudSnapshot(
      baseInput({
        weapon: { type: 2, reloadTime: 25, bullets: 27, shots: 1 },
        weaponDef: WEAPONS[2],
        weaponIndex: 2,
      }),
    );
    expect(snap.ammoText).toBe('27 x');

    // Switch to FlameThrower.
    snap = buildHudSnapshot(
      baseInput({
        weapon: { type: 8, reloadTime: 1, bullets: 150, shots: 0 },
        weaponDef: WEAPONS[8],
        weaponIndex: 8,
      }),
    );
    expect(snap.weaponIconFrame).toBe('powerflamethrower');
    expect(snap.ammoText).toBe('150 x');
  });

  it('forces Flash heroDie ammo "0 x" on death even with infinite MG', () => {
    const health = createPlayerHealth();
    for (let i = 0; i < 10; i += 1) {
      health.iFramesRemaining = 0;
      damagePlayer(health, 10);
    }
    const snap = buildHudSnapshot(
      baseInput({
        health,
        weapon: createMachineGunState(),
        weaponDef: WEAPONS[0],
        weaponIndex: 0,
      }),
    );
    expect(snap.healthAlive).toBe(false);
    expect(Number.isFinite(createMachineGunState().bullets)).toBe(false);
    expect(snap.ammoText).toBe('0 x');
    // Crate still reflects last cgun (Flash keeps HUD.weapon frame).
    expect(snap.weaponIconFrame).toBe('powermachinegun');
  });

  it('lays out a bottom-left crate+ammo cluster (not a free-floating text chip)', () => {
    const seeds = hudSpecSeeds();
    expect(seeds.weaponIconW).toBe(33);
    expect(seeds.weaponIconH).toBe(32);
    expect(HUD_LAYOUT.weapon.iconW).toBe(33);
    expect(HUD_LAYOUT.weapon.iconH).toBe(32);

    const icon = weaponHudIconDisplaySize();
    expect(icon).toEqual({
      w: 33 * HUD_LAYOUT.weapon.iconDisplayScale,
      h: 32 * HUD_LAYOUT.weapon.iconDisplayScale,
    });
    expect(icon.w).toBe(99);
    expect(icon.h).toBe(96);

    // Cluster sits in the bottom-left margin, icon then ammo gap.
    expect(HUD_LAYOUT.weapon.x).toBe(HUD_LAYOUT.margin);
    expect(HUD_LAYOUT.weapon.y).toBe(GAME_HEIGHT - 120);
    expect(HUD_LAYOUT.weapon.iconTextGap).toBe(16);
    expect(HUD_LAYOUT.weapon.ammoFontSize).toBe(32);
    // Reload bar sits under the crate (same x as icon).
    expect(HUD_LAYOUT.weapon.reloadWidth).toBe(280);
  });
});
