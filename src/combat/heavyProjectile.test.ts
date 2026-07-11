/**
 * Heavy / signature weapons — unit tests for issue #17 acceptance criteria.
 *
 * AC: A-Bomb one-shots a heli with a large blast + long reload
 * AC: Grapple demonstrably moves the player
 * Spec: Flash aBombFrame / grappleFrame / ShoulderCannon→railFrame + WEAPONS table
 */

import { describe, expect, it } from 'vitest';
import {
  HELI,
  HEAVY_PROJECTILE,
  SIM_HZ,
  WEAPONS,
  WORLD,
} from '../config/constants';
import { getWeaponDef } from '../config/weapons';
import { createAabbBody } from '../world/aabbBody';
import { createTileMap } from '../world/tileMap';
import {
  activateBullet,
  arenaCullBounds,
  createInactiveBullet,
} from './bullet';
import { HEAVY_WEAPON_INDICES, planWeaponFire } from './gunFire';
import { createHelicopter } from './helicopter';
import {
  applyAbombBlastDamage,
  applyAbombKnockback,
  applyGrapplePull,
  behaviorForWeapon,
  distance2d,
  stepAbombBullet,
  stepGrappleBullet,
  stepRailBullet,
} from './specialProjectile';
import { stepWeaponFire, type WeaponState } from './weapon';

/** Exact heavy-weapon rows from HELIATTACK2-SPEC.md. */
const HEAVY_SPEC = [
  {
    index: 10,
    name: 'ABombLauncher',
    reload: 150,
    speed: 3,
    damage: 300,
    behavior: 'abomb' as const,
  },
  {
    index: 12,
    name: 'GrappleCannon',
    reload: 250,
    speed: 20,
    damage: 300,
    behavior: 'grapple' as const,
  },
  {
    index: 13,
    name: 'ShoulderCannon',
    reload: 100,
    speed: 20,
    damage: 300,
    behavior: 'rail' as const,
  },
] as const;

const HELI_SPRITE_HALF_W = 212 / 2;
const HELI_SPRITE_HALF_H = 106 / 2;

function freshGun(type: number, bullets = 10): WeaponState {
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

describe('heavy / signature weapons (issue #17)', () => {
  it('locks each heavy weapon to exact spec reload/speed/damage', () => {
    expect(HEAVY_WEAPON_INDICES).toEqual([10, 12, 13]);

    for (const row of HEAVY_SPEC) {
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

    expect(HEAVY_PROJECTILE.abombBlastRadius).toBe(300);
    expect(HEAVY_PROJECTILE.abombKnockbackX).toBe(24);
    expect(HEAVY_PROJECTILE.abombKnockbackY).toBe(64);
    expect(HEAVY_PROJECTILE.grapplePullAccel).toBe(8);
    expect(HELI.hp).toBe(300);
  });

  it('A-Bomb long reload is 150 frames (~5s @30Hz) — one shot then wait', () => {
    const gun = freshGun(10);
    const def = getWeaponDef(10);
    expect(def.reload).toBe(150);
    expect(150 / SIM_HZ).toBe(5);

    expect(stepWeaponFire(gun, true, def)).toBe(true);
    expect(gun.reloadTime).toBe(0);
    expect(gun.bullets).toBe(9);

    // 149 more frames of held fire — still reloading.
    for (let i = 0; i < 149; i += 1) {
      expect(stepWeaponFire(gun, true, def)).toBe(false);
    }
    expect(gun.reloadTime).toBe(149);
    // Frame 150 of recharge → fire again.
    expect(stepWeaponFire(gun, true, def)).toBe(true);
    expect(gun.shots).toBe(2);
  });

  it('A-Bomb one-shots a heli with a large blast (AC) — damage 300, radius 300', () => {
    const near = createHelicopter(100, 100, HELI.hp);
    const far = createHelicopter(
      100 + HEAVY_PROJECTILE.abombBlastRadius + 1,
      100,
      HELI.hp,
    );
    const edge = createHelicopter(
      100 + HEAVY_PROJECTILE.abombBlastRadius,
      100,
      HELI.hp,
    );

    const hits = applyAbombBlastDamage(100, 100, WEAPONS[10].damage, [
      near,
      far,
      edge,
    ]);

    expect(WEAPONS[10].damage).toBe(HELI.hp);
    expect(hits).toBe(2); // near + edge, not far
    expect(near.active).toBe(false);
    expect(near.health).toBeLessThanOrEqual(0);
    expect(edge.active).toBe(false);
    expect(far.active).toBe(true);
    expect(far.health).toBe(HELI.hp);
  });

  it('A-Bomb detonates on solid and knocks the player (Flash dist<300)', () => {
    const map = solidFloorMap();
    const player = createAabbBody(100, 100, 10, 42);
    player.vx = 0;
    player.vy = 0;

    const bullet = createInactiveBullet(0);
    // Aim into the right solid wall (col 5).
    activateBullet(bullet, 200, 125, 0, {
      speed: WEAPONS[10].speed,
      damage: 300,
      maxLifetime: 300,
      behavior: 'abomb',
    });
    const bounds = arenaCullBounds(2000, 2000);

    let detonated = false;
    for (let i = 0; i < 80; i += 1) {
      if (stepAbombBullet(bullet, [], 1, bounds, map, player)) {
        detonated = true;
        break;
      }
    }
    expect(detonated).toBe(true);
    // Player was inside blast radius of the wall impact → knockback applied.
    expect(Math.abs(player.vx) + Math.abs(player.vy)).toBeGreaterThan(0);
    expect(player.onGround).toBe(false);
  });

  it('A-Bomb knockback uses Flash peak 24/64 and falloff by distance', () => {
    const atEpicenter = createAabbBody(0, -42, 10, 42); // feet at (5, 0)
    applyAbombKnockback(atEpicenter, 5, 0);
    // dist≈0 → mult=1 → full peak (angle-dependent; magnitude must be large).
    expect(Math.hypot(atEpicenter.vx, atEpicenter.vy)).toBeGreaterThanOrEqual(
      20,
    );

    const outside = createAabbBody(400, -42, 10, 42);
    outside.vx = 0;
    outside.vy = 0;
    applyAbombKnockback(outside, 5, 0);
    expect(outside.vx).toBe(0);
    expect(outside.vy).toBe(0);

    expect(distance2d(0, 0, HEAVY_PROJECTILE.abombBlastRadius, 0)).toBe(
      HEAVY_PROJECTILE.abombBlastRadius,
    );
  });

  it('planWeaponFire spawns A-Bomb / Grapple / Shoulder with correct behavior', () => {
    const abomb = planWeaponFire(10, 0, 0, 45);
    expect(abomb).toHaveLength(1);
    expect(abomb[0]).toMatchObject({
      speed: 3,
      damage: 300,
      behavior: 'abomb',
      rotationDeg: 45,
    });

    const grapple = planWeaponFire(12, 10, 20, 0);
    expect(grapple[0]).toMatchObject({
      speed: 20,
      damage: 300,
      behavior: 'grapple',
    });

    const shoulder = planWeaponFire(13, 0, 0, 90);
    expect(shoulder[0]).toMatchObject({
      speed: 20,
      damage: 300,
      behavior: 'rail',
      maxLifetime: 3,
    });
  });

  it('Grapple demonstrably moves the player (AC) when latched to a solid', () => {
    const map = solidFloorMap();
    const player = createAabbBody(100, 100, 10, 42);
    player.vx = 0;
    player.vy = 0;
    const vx0 = player.vx;
    const vy0 = player.vy;
    const x0 = player.x;

    const bullet = createInactiveBullet(0);
    // Fire right toward the solid wall.
    activateBullet(bullet, 200, 125, 0, {
      speed: WEAPONS[12].speed,
      damage: 300,
      maxLifetime: 300,
      behavior: 'grapple',
    });
    const bounds = arenaCullBounds(2000, 2000);

    let attached = false;
    for (let i = 0; i < 40; i += 1) {
      stepGrappleBullet(bullet, [], 1, bounds, map, player);
      if (bullet.grappleAttached) {
        attached = true;
        break;
      }
    }
    expect(attached).toBe(true);

    // Several pull frames — player velocity must change toward the hook.
    for (let i = 0; i < 5; i += 1) {
      stepGrappleBullet(bullet, [], 1, bounds, map, player);
    }

    expect(player.vx).not.toBe(vx0);
    expect(Math.abs(player.vx) + Math.abs(player.vy)).toBeGreaterThan(0);
    // Hook is to the right of the player → positive X pull.
    expect(player.vx).toBeGreaterThan(0);
    expect(player.onGround).toBe(false);

    // applyGrapplePull alone also moves velocity by exact accel.
    const solo = createAabbBody(0, 0, 10, 42);
    const delta = applyGrapplePull(solo, 100, 21, 1);
    expect(delta.dvx).toBeCloseTo(HEAVY_PROJECTILE.grapplePullAccel, 10);
    expect(solo.vx).toBe(delta.dvx);
    void x0;
    void vy0;
  });

  it('Grapple damages a heli for 300 on latch (one-shot)', () => {
    const heli = createHelicopter(200, 100, HELI.hp);
    const hitX = heli.x - HELI_SPRITE_HALF_W + 22;
    const hitY = heli.y - HELI_SPRITE_HALF_H + 2;
    const player = createAabbBody(50, 80, 10, 42);

    const bullet = createInactiveBullet(0);
    activateBullet(bullet, hitX, hitY, 0, {
      speed: 20,
      damage: 300,
      maxLifetime: 300,
      behavior: 'grapple',
    });
    bullet.vx = 0;
    bullet.vy = 0;

    const bounds = arenaCullBounds(2000, 2000);
    const cull = stepGrappleBullet(
      bullet,
      [heli],
      1,
      bounds,
      undefined,
      player,
    );

    expect(cull).toBe(false);
    expect(bullet.grappleAttached).toBe(true);
    expect(heli.health).toBeLessThanOrEqual(0);
    expect(heli.active).toBe(false);
    expect(Math.abs(player.vx) + Math.abs(player.vy)).toBeGreaterThan(0);
  });

  it('ShoulderCannon is a rail hitscan with damage 300 / reload 100', () => {
    const def = getWeaponDef(13);
    expect(def.reload).toBe(100);
    expect(def.speed).toBe(20);
    expect(def.damage).toBe(300);
    expect(behaviorForWeapon(13)).toBe('rail');

    const heli = createHelicopter(400, 100, HELI.hp);
    const hitX = heli.x - HELI_SPRITE_HALF_W + 22;
    const hitY = heli.y - HELI_SPRITE_HALF_H + 2;

    const bullet = createInactiveBullet(0);
    activateBullet(bullet, hitX - 50, hitY, 0, {
      speed: 20,
      damage: 300,
      maxLifetime: 3,
      behavior: 'rail',
    });
    const bounds = arenaCullBounds(2000, 2000);

    const cull = stepRailBullet(bullet, [heli], 1, bounds);
    expect(heli.health).toBeLessThanOrEqual(0);
    expect(heli.active).toBe(false);
    expect(cull).toBe(false); // linger remains
    expect(bullet.railFired).toBe(true);
  });
});
