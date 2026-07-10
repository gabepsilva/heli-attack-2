/**
 * Special-behavior weapons — unit tests for issue #16 acceptance criteria.
 *
 * AC: Flamethrower damages while held
 * AC: Seeker curves toward the nearest heli; railgun crosses screen near-instantly
 * Spec: Flash flameFrame / fireMinesFrame / railFrame / seekerFrame + WEAPONS table
 */

import { describe, expect, it } from 'vitest';
import {
  SIM_HZ,
  SPECIAL_PROJECTILE,
  WEAPONS,
  WORLD,
} from '../config/constants';
import { getWeaponDef } from '../config/weapons';
import { createTileMap } from '../world/tileMap';
import {
  BulletPool,
  activateBullet,
  arenaCullBounds,
  createInactiveBullet,
  velocityFromRotation,
} from './bullet';
import {
  FLAME_SPREAD_HALF_DEG,
  SPECIAL_WEAPON_INDICES,
  planFlameFire,
  planWeaponFire,
  type RandomInt,
} from './gunFire';
import { createHelicopter, stepBulletsVsHelis } from './helicopter';
import {
  aimDegToward,
  behaviorForWeapon,
  findNearestHeli,
  shortestAngleDeltaDeg,
  stepFlameBullet,
  stepMineBullet,
  stepRailBullet,
  stepSeekerBullet,
} from './specialProjectile';
import { stepWeaponFire, type WeaponState } from './weapon';

/** Exact special-weapon rows from HELIATTACK2-SPEC.md. */
const SPECIAL_SPEC = [
  {
    index: 7,
    name: 'SeekerLauncher',
    reload: 55,
    speed: 7,
    damage: 100,
    behavior: 'seeker' as const,
  },
  {
    index: 8,
    name: 'FlameThrower',
    reload: 1,
    speed: 8,
    damage: 2,
    hold: true,
    behavior: 'flame' as const,
  },
  {
    index: 9,
    name: 'FireMines',
    reload: 100,
    speed: 3,
    damage: 5,
    behavior: 'mine' as const,
  },
  {
    index: 11,
    name: 'RailGun',
    reload: 75,
    speed: 20,
    damage: 150,
    behavior: 'rail' as const,
  },
] as const;

const midRandom: RandomInt = (n) => Math.floor(n / 2);

function freshGun(type: number, bullets = 200): WeaponState {
  return {
    type,
    reloadTime: Number.POSITIVE_INFINITY,
    bullets,
    shots: 0,
  };
}

/** Tiny room: solid border, empty interior (tile 50). */
function solidFloorMap() {
  const cells = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ];
  return createTileMap(cells, WORLD.tile);
}

describe('special-behavior weapons (issue #16)', () => {
  it('locks each special weapon to exact spec reload/speed/damage', () => {
    expect(SPECIAL_WEAPON_INDICES).toEqual([7, 8, 9, 11]);

    for (const row of SPECIAL_SPEC) {
      const def = getWeaponDef(row.index);
      expect(def.name).toBe(row.name);
      expect(def.reload).toBe(row.reload);
      expect(def.speed).toBe(row.speed);
      expect(def.damage).toBe(row.damage);
      expect(behaviorForWeapon(row.index)).toBe(row.behavior);
      expect(WEAPONS[row.index]).toMatchObject({
        reload: row.reload,
        speed: row.speed,
        damage: row.damage,
      });
    }

    expect(WEAPONS[8].hold).toBe(true);
    expect(SPECIAL_PROJECTILE.flameSpreadHalfDeg).toBe(10);
    expect(SPECIAL_PROJECTILE.seekerTurnDivisor).toBe(15);
    expect(SPECIAL_PROJECTILE.mineGravity).toBe(1);
    expect(SPECIAL_PROJECTILE.mineActiveFrames).toBe(40);
  });

  it('FlameThrower hold-to-fire: reload 1 streams a shot every sim frame', () => {
    const flame = freshGun(8);
    const def = WEAPONS[8];
    expect(def.reload).toBe(1);
    expect(def.damage).toBe(2);
    expect(def.hold).toBe(true);

    for (let frame = 0; frame < SIM_HZ; frame += 1) {
      stepWeaponFire(flame, true, def);
    }
    // Starting ready: fires on every frame for 30 frames.
    expect(flame.shots).toBe(SIM_HZ);
    expect(flame.shots).toBe(30);
  });

  it('FlameThrower spawn uses Flash ±10° jitter and flame behavior', () => {
    expect(FLAME_SPREAD_HALF_DEG).toBe(10);
    // random(20) → 10 → aim offset 0.
    const spawns = planFlameFire(10, 20, 90, 8, 2, midRandom);
    expect(spawns).toEqual([
      {
        x: 10,
        y: 20,
        rotationDeg: 90,
        speed: 8,
        damage: 2,
        behavior: 'flame',
        maxLifetime: SPECIAL_PROJECTILE.flameLifetimeFrames,
      },
    ]);

    const jittered = planFlameFire(0, 0, 0, 8, 2, () => 0);
    expect(jittered[0]!.rotationDeg).toBe(-FLAME_SPREAD_HALF_DEG);
  });

  it('Flamethrower damages while held (AC) — continuous DoT without recycling on hit', () => {
    const heli = createHelicopter(200, 100, 300);
    const hitX = heli.x - HELI_SPRITE_HALF_W + 22;
    const hitY = heli.y - HELI_SPRITE_HALF_H + 2;

    const bullet = createInactiveBullet(0);
    activateBullet(
      bullet,
      hitX,
      hitY,
      0,
      WEAPONS[8].speed,
      WEAPONS[8].damage,
      SPECIAL_PROJECTILE.flameLifetimeFrames,
      'flame',
    );
    // Hold the particle on the opaque pixel so DoT is measurable (stream
    // motion is covered by the hold-to-fire reload test above).
    bullet.vx = 0;
    bullet.vy = 0;

    const bounds = arenaCullBounds(2000, 2000);
    const healthBefore = heli.health;

    for (let i = 0; i < 5; i += 1) {
      const cull = stepFlameBullet(bullet, [heli], 1, bounds);
      expect(cull).toBe(false);
      expect(bullet.active).toBe(true);
    }

    expect(heli.health).toBeLessThan(healthBefore);
    // After each step age is 1..5 → factors (1 - age/10) = 0.9 .. 0.5
    const expected = [0.9, 0.8, 0.7, 0.6, 0.5].reduce(
      (sum, f) => sum + 2 * f,
      0,
    );
    expect(heli.health).toBeCloseTo(healthBefore - expected, 10);
    expect(bullet.active).toBe(true);
  });

  it('Seeker curves toward the nearest heli (AC) at Flash dif/15 turn rate', () => {
    const heli = createHelicopter(400, 100, 300);
    const bullet = createInactiveBullet(0);
    // Fired upward (−90°) while target is to the right → must yaw toward 0°.
    activateBullet(bullet, 100, 100, -90, WEAPONS[7].speed, 100, 300, 'seeker');

    const bounds = arenaCullBounds(2000, 2000);
    const nearest = findNearestHeli(bullet.x, bullet.y, [heli]);
    expect(nearest).toBe(heli);

    const desired0 = aimDegToward(bullet.x, bullet.y, heli.x, heli.y);
    expect(desired0).toBeCloseTo(0, 5);

    const before = bullet.rotationDeg;
    const err0 = Math.abs(
      shortestAngleDeltaDeg(
        ((before % 360) + 360) % 360,
        ((desired0 % 360) + 360) % 360,
      ),
    );
    expect(err0).toBeCloseTo(90, 5);

    stepSeekerBullet(bullet, [heli], 1, bounds);
    const dif = shortestAngleDeltaDeg(
      ((before % 360) + 360) % 360,
      ((desired0 % 360) + 360) % 360,
    );
    expect(bullet.rotationDeg).toBeCloseTo(
      before + dif / SPECIAL_PROJECTILE.seekerTurnDivisor,
      10,
    );
    // Curves — does not snap to the bearing in one frame.
    expect(
      Math.abs(
        shortestAngleDeltaDeg(
          ((bullet.rotationDeg % 360) + 360) % 360,
          ((desired0 % 360) + 360) % 360,
        ),
      ),
    ).toBeGreaterThan(1);

    // Freeze translation so we only measure steering convergence.
    // err' ≈ err * 14/15 per frame → ~45 frames to drop 90° under 5°.
    for (let i = 0; i < 50; i += 1) {
      const x = bullet.x;
      const y = bullet.y;
      stepSeekerBullet(bullet, [heli], 1, bounds);
      bullet.x = x;
      bullet.y = y;
    }
    const aimed = ((bullet.rotationDeg % 360) + 360) % 360;
    const targetAim =
      ((aimDegToward(bullet.x, bullet.y, heli.x, heli.y) % 360) + 360) % 360;
    const err = Math.abs(shortestAngleDeltaDeg(aimed, targetAim));
    expect(err).toBeLessThan(5);
    expect(err).toBeLessThan(err0);
  });

  it('RailGun crosses the screen near-instantly via hitscan (AC)', () => {
    const heli = createHelicopter(800, 100, 300);
    const hitX = heli.x - HELI_SPRITE_HALF_W + 22;
    const hitY = heli.y - HELI_SPRITE_HALF_H + 2;

    const bullet = createInactiveBullet(0);
    activateBullet(
      bullet,
      50,
      hitY,
      0,
      WEAPONS[11].speed,
      WEAPONS[11].damage,
      SPECIAL_PROJECTILE.railLingerFrames,
      'rail',
    );

    expect(WEAPONS[11].speed).toBe(20);
    expect(WEAPONS[11].damage).toBe(150);
    const ballisticFrames = (hitX - 50) / WEAPONS[11].speed;
    expect(ballisticFrames).toBeGreaterThan(10);

    const bounds = arenaCullBounds(2000, 2000);
    const healthBefore = heli.health;
    const cull = stepRailBullet(bullet, [heli], 1, bounds);
    expect(heli.health).toBe(healthBefore - 150);
    expect(bullet.railFired).toBe(true);
    expect(cull).toBe(false);
    // Beam origin stays put — damage is hitscan, not a crawling projectile.
    expect(bullet.x).toBe(50);
  });

  it('FireMines lob, plant on solid floor, and deal persistent DoT', () => {
    const map = solidFloorMap();
    // Floor is row 4 → y in [200, 250). Drop a mine above the open cell.
    const bullet = createInactiveBullet(0);
    activateBullet(bullet, 125, 60, 90, 3, 5, 300, 'mine');
    // Aim straight down so it falls onto the floor.
    const { vx, vy } = velocityFromRotation(3, 90);
    bullet.vx = vx;
    bullet.vy = vy;

    const heli = createHelicopter(125, 199, 300);
    // Place heli so its mask overlaps the planted mine near the floor.
    heli.x = 125;
    heli.y = 180;

    const bounds = arenaCullBounds(2000, 2000);
    let planted = false;
    for (let i = 0; i < 80; i += 1) {
      stepMineBullet(bullet, [heli], 1, bounds, map);
      if (bullet.mineActive > 0) {
        planted = true;
        break;
      }
    }
    expect(planted).toBe(true);
    expect(bullet.vx).toBe(0);
    expect(bullet.vy).toBe(0);

    // While planted and overlapping, damage accumulates each tick.
    // Force overlap at the mine point.
    const mineX = bullet.x;
    const mineY = bullet.y;
    // Reposition heli so a known opaque pixel sits on the mine.
    heli.x = mineX - 22 + HELI_SPRITE_HALF_W;
    heli.y = mineY - 2 + HELI_SPRITE_HALF_H;
    heli.health = 300;
    heli.active = true;

    const before = heli.health;
    stepMineBullet(bullet, [heli], 1, bounds, map);
    // Planted DoT: damage * timeStep = 5.
    expect(heli.health).toBe(before - WEAPONS[9].damage);
    expect(bullet.mineActive).toBeGreaterThan(0);
  });

  it('planWeaponFire tags each special index with the correct behavior', () => {
    for (const row of SPECIAL_SPEC) {
      const def = getWeaponDef(row.index);
      const spawns = planWeaponFire(row.index, 1, 2, 0, def, midRandom);
      expect(spawns).toHaveLength(1);
      expect(spawns[0]!.behavior).toBe(row.behavior);
      expect(spawns[0]!.speed).toBe(row.speed);
      expect(spawns[0]!.damage).toBe(row.damage);
    }
  });

  it('pool + stepBulletsVsHelis applies rail hitscan end-to-end', () => {
    const pool = new BulletPool(4);
    const heli = createHelicopter(600, 100, 300);
    const hitY = heli.y - HELI_SPRITE_HALF_H + 2;
    const b = pool.acquire(
      40,
      hitY,
      0,
      20,
      150,
      SPECIAL_PROJECTILE.railLingerFrames,
      'rail',
    );
    expect(b).not.toBeNull();

    const bounds = arenaCullBounds(2000, 2000);
    const before = heli.health;
    stepBulletsVsHelis(pool, [heli], bounds, 1);
    expect(heli.health).toBe(before - 150);
  });
});

/** HELI.spriteW/H halves — avoid importing HELI just for mask probe math. */
const HELI_SPRITE_HALF_W = 212 / 2;
const HELI_SPRITE_HALF_H = 106 / 2;
