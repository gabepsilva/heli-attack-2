/**
 * Heli variants & behavior polish — unit tests for issue #20 acceptance criteria.
 *
 * AC: Two behavior types are distinguishable in play
 * AC: Helis reposition rather than sitting still
 *
 * Spec / Flash values: `gotoAndStop(random(2)+1)`, `onscreen = 150+random(100)`,
 * exit `goto = random(10)` (<4 left, <8 right, else top), on-screen accel
 * `dx/200` `dy/100`, off-screen / leaving `dx/100` `dy/20`.
 */

import { describe, expect, it } from 'vitest';
import { HELI, HELI_LOOK_TINT } from '../config/constants';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import {
  behaviorForLook,
  createHelicopter,
  createSpawnRng,
  isHeliOffArena,
  pickHeliExitPath,
  spawnHelicopter,
  stepHelicopter,
  type HeliExitPath,
  type Helicopter,
} from './helicopter';

function stepMany(
  heli: Helicopter,
  frames: number,
  rng = createSpawnRng(1),
  playerX = LEVEL1_WIDTH_PX / 2,
  playerY = 400,
): void {
  for (let i = 0; i < frames; i += 1) {
    stepHelicopter(
      heli,
      1,
      playerX,
      playerY,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      rng,
    );
  }
}

describe('heli variants & behavior (issue #20)', () => {
  it('locks Flash look count, onscreen timer, and accel divisors to exact values', () => {
    expect(HELI.lookCount).toBe(2);
    expect(HELI.onScreenFramesMin).toBe(150);
    expect(HELI.onScreenFramesRand).toBe(100);
    expect(HELI.hoverAccelXDiv).toBe(200);
    expect(HELI.hoverAccelYDiv).toBe(100);
    expect(HELI.hoverDriftPeriod).toBe(75);
    expect(HELI.hoverVertPeriod).toBe(40);
    expect(HELI.strafeAccelXDiv).toBe(80);
    expect(HELI.strafeAccelYDiv).toBe(120);
    expect(HELI.exitAccelXDiv).toBe(100);
    expect(HELI.exitAccelYDiv).toBe(20);
    expect(HELI.exitGotoRange).toBe(10);
    expect(HELI.exitLeftMax).toBe(4);
    expect(HELI.exitRightMax).toBe(8);
    expect(HELI_LOOK_TINT).toHaveLength(2);
    expect(HELI_LOOK_TINT[0]).not.toBe(HELI_LOOK_TINT[1]);
  });

  it('maps look 0→hover and look 1→strafe (AC: two distinguishable behaviors)', () => {
    expect(behaviorForLook(0)).toBe('hover');
    expect(behaviorForLook(1)).toBe('strafe');

    const hover = createHelicopter(400, 200, HELI.hp, createSpawnRng(1), 0);
    const strafe = createHelicopter(400, 200, HELI.hp, createSpawnRng(1), 1);
    expect(hover.look).toBe(0);
    expect(hover.behavior).toBe('hover');
    expect(strafe.look).toBe(1);
    expect(strafe.behavior).toBe('strafe');
    expect(hover.behavior).not.toBe(strafe.behavior);
  });

  it('spawns with Flash onscreen = 150+random(100) and a look in {0,1}', () => {
    const seenLooks = new Set<number>();
    const timers: number[] = [];
    for (let seed = 1; seed <= 40; seed += 1) {
      const heli = spawnHelicopter(
        HELI.hp,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        createSpawnRng(seed),
      );
      seenLooks.add(heli.look);
      timers.push(heli.onScreen);
      expect(heli.onScreen).toBeGreaterThanOrEqual(HELI.onScreenFramesMin);
      expect(heli.onScreen).toBeLessThanOrEqual(
        HELI.onScreenFramesMin + HELI.onScreenFramesRand,
      );
      expect(heli.look === 0 || heli.look === 1).toBe(true);
      expect(heli.behavior).toBe(behaviorForLook(heli.look));
      expect(heli.repositioning).toBe(false);
    }
    expect(seenLooks.has(0)).toBe(true);
    expect(seenLooks.has(1)).toBe(true);
    expect(new Set(timers).size).toBeGreaterThan(1);
  });

  it('pickHeliExitPath matches Flash goto buckets (<4 left, <8 right, else top)', () => {
    // Deterministic: walk every goto value via a stub rng sequence.
    const sequence = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let i = 0;
    const rng = {
      next(): number {
        const v = sequence[i++]! / 10;
        return v;
      },
    };
    const paths: HeliExitPath[] = [];
    for (let n = 0; n < 10; n += 1) {
      paths.push(pickHeliExitPath(rng));
    }
    expect(paths.slice(0, 4).every((p) => p === 'left')).toBe(true);
    expect(paths.slice(4, 8).every((p) => p === 'right')).toBe(true);
    expect(paths.slice(8, 10).every((p) => p === 'top')).toBe(true);
  });

  it('hover and strafe produce distinguishable lateral motion (AC)', () => {
    const hover = createHelicopter(
      LEVEL1_WIDTH_PX / 2,
      150,
      HELI.hp,
      createSpawnRng(3),
      0,
    );
    const strafe = createHelicopter(
      LEVEL1_WIDTH_PX / 2,
      150,
      HELI.hp,
      createSpawnRng(3),
      1,
    );
    // Keep them on-screen long enough to sample drift (don't expire yet).
    hover.onScreen = 10_000;
    strafe.onScreen = 10_000;

    const playerX = LEVEL1_WIDTH_PX / 2;
    stepMany(hover, 200, createSpawnRng(9), playerX);
    stepMany(strafe, 200, createSpawnRng(9), playerX);

    // Spec: strafe is snappier laterally and retargets more often.
    expect(HELI.strafeAccelXDiv).toBeLessThan(HELI.hoverAccelXDiv);
    expect(HELI.strafeDriftPeriod).toBeLessThan(HELI.hoverDriftPeriod);
    // Same player / seed timeline → positions diverge (distinct behaviors).
    expect(Math.abs(strafe.x - hover.x)).toBeGreaterThan(20);
    expect(strafe.behavior).not.toBe(hover.behavior);
  });

  it('repositions after onscreen timer instead of sitting still (AC)', () => {
    const rng = createSpawnRng(42);
    const heli = createHelicopter(LEVEL1_WIDTH_PX / 2, 180, HELI.hp, rng, 0);
    heli.onScreen = 5;
    const startX = heli.x;
    const startY = heli.y;
    const health = heli.health;

    // Burn the timer → enter reposition (Flash onScreen<=0).
    stepMany(heli, 6, rng);
    expect(heli.repositioning).toBe(true);
    expect(heli.exitPath).not.toBeNull();
    expect(['left', 'right', 'top']).toContain(heli.exitPath);

    // Keep flying until off-arena respawn (Flash addEnemy(health)).
    let respawned = false;
    for (let i = 0; i < 600; i += 1) {
      stepHelicopter(
        heli,
        1,
        LEVEL1_WIDTH_PX / 2,
        400,
        LEVEL1_WIDTH_PX,
        LEVEL1_HEIGHT_PX,
        rng,
      );
      if (!heli.repositioning && heli.onScreen >= HELI.onScreenFramesMin) {
        // Fresh spawn after exit — health preserved, not a kill.
        expect(heli.health).toBe(health);
        expect(heli.active).toBe(true);
        expect(heli.exitPath).toBeNull();
        // New approach from an edge/top (varied path).
        const offLeft = heli.x < 0 || heli.x > LEVEL1_WIDTH_PX;
        const offTop = heli.y < 0;
        expect(offLeft || offTop).toBe(true);
        respawned = true;
        break;
      }
    }
    expect(respawned).toBe(true);
    // Must have moved away from the idle hover point during the exit.
    expect(Math.hypot(heli.x - startX, heli.y - startY)).toBeGreaterThan(50);
  });

  it('uses exit accel while off-arena / repositioning (Flash dx/100, dy/20)', () => {
    const heli = createHelicopter(
      -HELI.spriteW,
      100,
      HELI.hp,
      createSpawnRng(2),
      0,
    );
    heli.tx = LEVEL1_WIDTH_PX / 2;
    heli.ty = 200;
    heli.onScreen = 10_000;
    heli.stepAccum = 0;
    heli.xspeed = 0;
    heli.yspeed = 0;
    expect(isHeliOffArena(heli, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX)).toBe(true);

    const dxBefore = heli.tx - heli.x;
    const dyBefore = heli.ty - heli.y;
    // Partial timestep: apply accel without a discrete move/friction tick.
    stepHelicopter(
      heli,
      0.5,
      LEVEL1_WIDTH_PX / 2,
      400,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      createSpawnRng(2),
    );
    expect(heli.xspeed).toBeCloseTo(dxBefore / HELI.exitAccelXDiv, 5);
    expect(heli.yspeed).toBeCloseTo(dyBefore / HELI.exitAccelYDiv, 5);
    // Stronger than on-screen hover accel would have been.
    expect(Math.abs(dxBefore / HELI.exitAccelXDiv)).toBeGreaterThan(
      Math.abs(dxBefore / HELI.hoverAccelXDiv),
    );
  });

  it('does not count reposition respawn as sitting still — exit targets leave the arena', () => {
    const heli = createHelicopter(400, 200, HELI.hp, createSpawnRng(5), 1);
    heli.onScreen = 0;
    stepHelicopter(
      heli,
      1,
      400,
      400,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      createSpawnRng(5),
    );
    expect(heli.repositioning).toBe(true);
    if (heli.exitPath === 'left') {
      expect(heli.tx).toBeLessThan(0);
    } else if (heli.exitPath === 'right') {
      expect(heli.tx).toBeGreaterThan(LEVEL1_WIDTH_PX);
    } else {
      expect(heli.ty).toBeLessThan(0);
    }
  });
});
