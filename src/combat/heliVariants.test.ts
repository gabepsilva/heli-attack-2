/**
 * Heli variants & Flash `heliFrame` motion parity — unit tests for #20.
 *
 * AC: Two looks (visual) — motion is identical (Flash gotoAndStop visual-only)
 * AC: Helis reposition rather than sitting still
 *
 * Spec / Flash: `onscreen = 150+random(100)`, exit `goto = random(10)`,
 * on-screen accel `dx/200` `dy/100`, off-view / `onScreen<0` `dx/100` `dy/20`,
 * view `spw=450` `sph=350`.
 */

import { describe, expect, it } from 'vitest';
import { HELI } from '../config/constants';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import {
  createHelicopter,
  createSpawnRng,
  isHeliInView,
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
  playerHjump = false,
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
      playerHjump,
    );
  }
}

describe('heli variants & Flash motion parity (issue #20)', () => {
  it('locks Flash look count, view size, onscreen timer, and accel divisors', () => {
    expect(HELI.lookCount).toBe(2);
    expect(HELI.viewW).toBe(450);
    expect(HELI.viewH).toBe(350);
    expect(HELI.onScreenFramesMin).toBe(150);
    expect(HELI.onScreenFramesRand).toBe(100);
    expect(HELI.chaseAccelXDiv).toBe(200);
    expect(HELI.chaseAccelYDiv).toBe(100);
    expect(HELI.chaseDriftPeriod).toBe(75);
    expect(HELI.chaseVertPeriod).toBe(40);
    expect(HELI.chaseVertJitterMin).toBe(-2);
    expect(HELI.chaseVertJitterRange).toBe(4);
    expect(HELI.chaseVertJitterStep).toBe(10);
    expect(HELI.hjumpDropBelowPlayer).toBe(50);
    expect(HELI.hjumpDropRand).toBe(50);
    expect(HELI.hjumpFloorMargin).toBe(100);
    expect(HELI.exitAccelXDiv).toBe(100);
    expect(HELI.exitAccelYDiv).toBe(20);
    expect(HELI.exitGotoRange).toBe(10);
    expect(HELI.exitLeftMax).toBe(4);
    expect(HELI.exitRightMax).toBe(8);
    expect(HELI.exitViewMulLeft).toBe(2);
    expect(HELI.exitViewMulRight).toBe(1);
    expect(HELI.exitViewMulTop).toBe(1);
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
      expect(heli.repositioning).toBe(false);
    }
    expect(seenLooks.has(0)).toBe(true);
    expect(seenLooks.has(1)).toBe(true);
    expect(new Set(timers).size).toBeGreaterThan(1);
  });

  it('pickHeliExitPath matches Flash goto buckets (<4 left, <8 right, else top)', () => {
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

  it('look 0 and look 1 share identical motion under the same seed timeline', () => {
    const look0 = createHelicopter(
      LEVEL1_WIDTH_PX / 2,
      150,
      HELI.hp,
      createSpawnRng(3),
      0,
    );
    const look1 = createHelicopter(
      LEVEL1_WIDTH_PX / 2,
      150,
      HELI.hp,
      createSpawnRng(3),
      1,
    );
    look0.onScreen = 10_000;
    look1.onScreen = 10_000;

    const playerX = LEVEL1_WIDTH_PX / 2;
    stepMany(look0, 200, createSpawnRng(9), playerX);
    stepMany(look1, 200, createSpawnRng(9), playerX);

    expect(look0.x).toBeCloseTo(look1.x, 5);
    expect(look0.y).toBeCloseTo(look1.y, 5);
    expect(look0.xspeed).toBeCloseTo(look1.xspeed, 5);
    expect(look0.yspeed).toBeCloseTo(look1.yspeed, 5);
  });

  it('uses Flash xdif formula against player._x (left edge)', () => {
    const rng = createSpawnRng(11);
    const heli = createHelicopter(400, 200, HELI.hp, rng, 0);
    heli.onScreen = 10_000;
    heli.stepAccum = 0;
    heli.frameCounter = 0;
    const playerX = 300;

    // First move frame: frameCounter becomes 1 → xt%75 == 1 retarget.
    stepHelicopter(
      heli,
      1,
      playerX,
      400,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      rng,
    );

    const span = Math.floor(HELI.viewW - HELI.spriteW / 2);
    expect(heli.xDrift).toBeGreaterThanOrEqual(
      -HELI.viewW / 2 + HELI.spriteW / 2,
    );
    expect(heli.xDrift).toBeLessThanOrEqual(
      -HELI.viewW / 2 + (span - 1) + HELI.spriteW / 2,
    );
    const halfW = HELI.spriteW / 2;
    const expectedTx = Math.max(
      halfW,
      Math.min(LEVEL1_WIDTH_PX - halfW, playerX + heli.xDrift),
    );
    expect(heli.tx).toBe(expectedTx);
  });

  it('sets Flash hjump ty every tick while hyper-jumping', () => {
    const draws = [0.1, 0.5, 0.9];
    let i = 0;
    const rng = {
      next(): number {
        return draws[i++ % draws.length]!;
      },
    };
    const heli = createHelicopter(400, 200, HELI.hp, createSpawnRng(1), 0);
    heli.onScreen = 10_000;
    const playerY = 500;

    stepHelicopter(
      heli,
      0.5, // no discrete move — hjump ty still updates every frame
      400,
      playerY,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      rng,
      true,
    );

    // randomInt(rng, 50) with next=0.1 → floor(5) = 5
    expect(heli.ty).toBe(
      Math.min(LEVEL1_HEIGHT_PX - HELI.viewH / 2 - 100, playerY + 50 + 5),
    );
  });

  it('does not decrement onScreen while off-arena (Flash camera-visible only)', () => {
    const heli = createHelicopter(
      -HELI.spriteW * 2,
      100,
      HELI.hp,
      createSpawnRng(2),
      0,
    );
    heli.onScreen = 200;
    expect(isHeliInView(heli, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX)).toBe(false);

    stepHelicopter(
      heli,
      1,
      LEVEL1_WIDTH_PX / 2,
      400,
      LEVEL1_WIDTH_PX,
      LEVEL1_HEIGHT_PX,
      createSpawnRng(2),
    );
    expect(heli.onScreen).toBe(200);
  });

  it('repositions after onscreen timer instead of sitting still (AC)', () => {
    const rng = createSpawnRng(42);
    const heli = createHelicopter(LEVEL1_WIDTH_PX / 2, 180, HELI.hp, rng, 0);
    heli.onScreen = 5;
    const startX = heli.x;
    const startY = heli.y;
    const health = heli.health;

    stepMany(heli, 6, rng);
    expect(heli.repositioning).toBe(true);
    expect(heli.exitPath).not.toBeNull();
    expect(['left', 'right', 'top']).toContain(heli.exitPath);

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
        expect(heli.health).toBe(health);
        expect(heli.active).toBe(true);
        expect(heli.exitPath).toBeNull();
        const offLeft = heli.x < 0 || heli.x > LEVEL1_WIDTH_PX;
        const offTop = heli.y < 0;
        expect(offLeft || offTop).toBe(true);
        respawned = true;
        break;
      }
    }
    expect(respawned).toBe(true);
    expect(Math.hypot(heli.x - startX, heli.y - startY)).toBeGreaterThan(50);
  });

  it('uses exit accel while off-arena / onScreen<0 (Flash dx/100, dy/20)', () => {
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
    expect(Math.abs(dxBefore / HELI.exitAccelXDiv)).toBeGreaterThan(
      Math.abs(dxBefore / HELI.chaseAccelXDiv),
    );
  });

  it('exit targets leave the arena using Flash view-relative offsets', () => {
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
      expect(heli.tx).toBe(-HELI.exitViewMulLeft * HELI.viewW);
    } else if (heli.exitPath === 'right') {
      expect(heli.tx).toBe(
        LEVEL1_WIDTH_PX + HELI.exitViewMulRight * HELI.viewW,
      );
    } else {
      expect(heli.ty).toBe(-HELI.exitViewMulTop * HELI.viewH);
    }
  });
});
