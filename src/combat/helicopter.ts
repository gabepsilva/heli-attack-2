/**
 * Helicopter enemy — plain sim matching HA2 `addEnemy` / `heliFrame` essentials.
 * Phaser only draws; hit tests use the baked alpha mask ({@link bulletHitsHeli}).
 * Enemy fire (#18): aimed gun + speed-7 bullets with ±5° spread.
 * Variants (#20): two looks/behaviors (hover vs strafe), Flash onscreen
 * reposition timer, and off-screen approach / exit paths.
 */

import { ENEMY_BULLET, HELI, WORLD } from '../config/constants';
import { aimAngleDeg, shortestAngleDelta } from './gunAim';
import type { BulletPool } from './bullet';
import type { EnemyBulletPool } from './enemyBullet';
import { stepSpecialBullet } from './specialProjectile';
import type { AabbBody } from '../world/aabbBody';
import type { TileMap } from '../world/tileMap';

/** Flash look 0 → hover; look 1 → strafe (#20). */
export type HeliBehavior = 'hover' | 'strafe';

/** Flash `gotoAndStop(random(2)+1)` frames, zero-indexed. */
export type HeliLook = 0 | 1;

/** Flash exit pick when `onscreen` expires: left / right / top. */
export type HeliExitPath = 'left' | 'right' | 'top';

export type Helicopter = {
  active: boolean;
  /** Center position in arena space (Flash `_x`, `_y`). */
  x: number;
  y: number;
  health: number;
  xspeed: number;
  yspeed: number;
  /** Hover / exit target X/Y (Flash `tx`, `ty`). */
  tx: number;
  ty: number;
  rotationDeg: number;
  /** Frames until off-screen reposition (Flash `onscreen`). */
  onScreen: number;
  /** Per-frame motion accumulator (Flash `stepc`). */
  stepAccum: number;
  /** Drift offset from player X (Flash `xdif`). */
  xDrift: number;
  frameCounter: number;
  /**
   * Sim frames of hit flash remaining (Flash white tint when
   * `lasthealth != health`). Scene swaps to `heli_hit` while > 0.
   */
  hitFlashRemaining: number;
  /** Aimed gun rotation in degrees (Flash `gun._rotation`). */
  gunRotationDeg: number;
  /** Fire cadence counter (Flash `shoot`). */
  shootCounter: number;
  /** Visual frame index (Flash `gotoAndStop(random(2)+1)` → 0|1). */
  look: HeliLook;
  /** Motion profile paired with look (#20). */
  behavior: HeliBehavior;
  /** True while flying off-arena after the onscreen timer (Flash `onScreen<=0`). */
  repositioning: boolean;
  /** Exit destination while repositioning (Flash `goto`). */
  exitPath: HeliExitPath | null;
};

/** Callback fired when a bullet damages a heli (#13 score + kill VFX). */
export type HeliHitEvent = {
  heli: Helicopter;
  /** Damage applied this hit (weapon damage). */
  damage: number;
  /** True when this hit reduced health to ≤ 0. */
  killed: boolean;
};

export type HeliExplosion = {
  active: boolean;
  x: number;
  y: number;
  /** Sim frames remaining (placeholder VFX lifetime). */
  age: number;
  maxAge: number;
};

export type SpawnRng = Readonly<{
  /** Returns [0, 1). */
  next(): number;
}>;

/** Deterministic RNG for tests and spawn replay. */
export function createSpawnRng(seed = 1): SpawnRng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    },
  };
}

function randomInt(rng: SpawnRng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

function pseudoRand(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0) / 0x1_0000_0000;
}

/** Map Flash look index to behavior (#20: look 0 hover, look 1 strafe). */
export function behaviorForLook(look: HeliLook): HeliBehavior {
  return look === 0 ? 'hover' : 'strafe';
}

/**
 * Flash exit pick: `goto = random(10)`; `<4` left, `<8` right, else top.
 */
export function pickHeliExitPath(
  rng: SpawnRng,
  gotoRange: number = HELI.exitGotoRange,
  leftMax: number = HELI.exitLeftMax,
  rightMax: number = HELI.exitRightMax,
): HeliExitPath {
  const goto = randomInt(rng, gotoRange);
  if (goto < leftMax) {
    return 'left';
  }
  if (goto < rightMax) {
    return 'right';
  }
  return 'top';
}

/** True when the heli center is outside the arena (approach / exit zone). */
export function isHeliOffArena(
  heli: Readonly<{ x: number; y: number }>,
  arenaW: number,
  arenaH: number,
  marginX: number = HELI.spriteW / 2,
  marginY: number = HELI.spriteH / 2,
): boolean {
  return (
    heli.x < -marginX ||
    heli.x > arenaW + marginX ||
    heli.y < -marginY ||
    heli.y > arenaH + marginY
  );
}

/**
 * Flash `addEnemy` spawn positions — mostly offscreen left/right, sometimes top.
 * Positions are in arena coordinates (0..arenaW, 0..arenaH).
 */
export function spawnHelicopter(
  health: number = HELI.hp,
  arenaW: number,
  _arenaH: number,
  rng: SpawnRng = createSpawnRng(),
): Helicopter {
  const w = HELI.spriteW;
  const h = HELI.spriteH;
  let x: number;
  let y: number;

  if (randomInt(rng, 3) !== 0) {
    // Side spawn (2/3): left or right edge, high in the sky.
    if (randomInt(rng, 2) === 0) {
      x = -w / 2;
    } else {
      x = arenaW + w / 2;
    }
    y = h;
  } else {
    // Top spawn (1/3): centered above the playfield.
    x = arenaW / 2;
    y = -h / 2;
  }

  return createHelicopter(x, y, health, rng);
}

export function createHelicopter(
  x: number,
  y: number,
  health: number = HELI.hp,
  rng: SpawnRng = createSpawnRng(),
  look?: HeliLook,
): Helicopter {
  const resolvedLook: HeliLook =
    look ?? (randomInt(rng, HELI.lookCount) as HeliLook);
  return {
    active: true,
    x,
    y,
    health,
    xspeed: 0,
    yspeed: 0,
    tx: x,
    ty: y,
    rotationDeg: 0,
    onScreen:
      HELI.onScreenFramesMin + randomInt(rng, HELI.onScreenFramesRand + 1),
    stepAccum: 0,
    xDrift: 0,
    frameCounter: 0,
    hitFlashRemaining: 0,
    gunRotationDeg: 0,
    shootCounter: 0,
    look: resolvedLook,
    behavior: behaviorForLook(resolvedLook),
    repositioning: false,
    exitPath: null,
  };
}

/**
 * Flash reposition complete: `addEnemy(this.health)` — keep HP, new look /
 * path / onscreen timer from a fresh edge/top spawn.
 */
export function respawnHelicopterKeepingHealth(
  heli: Helicopter,
  arenaW: number,
  arenaH: number,
  rng: SpawnRng,
): void {
  const health = heli.health;
  const fresh = spawnHelicopter(health, arenaW, arenaH, rng);
  Object.assign(heli, fresh);
}

export function createHeliExplosion(
  x: number,
  y: number,
  maxAge: number = HELI.explosionDurationFrames,
): HeliExplosion {
  return { active: true, x, y, age: 0, maxAge };
}

/** Apply weapon damage; returns true when the heli dies this hit. */
export function damageHelicopter(heli: Helicopter, amount: number): boolean {
  if (!heli.active || amount <= 0) {
    return false;
  }
  heli.health -= amount;
  heli.hitFlashRemaining = HELI.hitFlashFrames;
  if (heli.health <= 0) {
    heli.active = false;
    return true;
  }
  return false;
}

/** True while the heli should show the damaged flash sprite/tint. */
export function isHeliFlashing(heli: Helicopter): boolean {
  return heli.active && heli.hitFlashRemaining > 0;
}

function beginReposition(
  heli: Helicopter,
  arenaW: number,
  rng: SpawnRng,
): void {
  heli.repositioning = true;
  heli.exitPath = pickHeliExitPath(rng);
  const margin = HELI.spriteW * HELI.exitMarginMul;
  if (heli.exitPath === 'left') {
    heli.tx = -margin;
  } else if (heli.exitPath === 'right') {
    heli.tx = arenaW + margin;
  } else {
    heli.ty = -HELI.spriteH * HELI.exitMarginMul;
  }
}

function updateOnScreenTargets(
  heli: Helicopter,
  playerCenterX: number,
  playerY: number,
  arenaW: number,
  arenaH: number,
): void {
  const halfW = HELI.spriteW / 2;
  if (heli.behavior === 'hover') {
    if (heli.frameCounter % HELI.hoverDriftPeriod === 1) {
      const r = pseudoRand(heli.frameCounter);
      heli.xDrift = -arenaW / 4 + r * (arenaW / 2);
    }
    heli.tx = playerCenterX + heli.xDrift;
    heli.tx = Math.max(halfW, Math.min(arenaW - halfW, heli.tx));
    if (heli.frameCounter % HELI.hoverVertPeriod === 1) {
      const r = pseudoRand(heli.frameCounter + 17);
      heli.ty = playerY - arenaH / 4 + (Math.floor(r * 5) - 2) * 10;
    }
  } else {
    // Strafe: full-width lateral sweeps, retarget more often (#20).
    if (heli.frameCounter % HELI.strafeDriftPeriod === 1) {
      const r = pseudoRand(heli.frameCounter);
      heli.xDrift = -arenaW / 2 + r * arenaW;
    }
    heli.tx = playerCenterX + heli.xDrift;
    heli.tx = Math.max(halfW, Math.min(arenaW - halfW, heli.tx));
    if (heli.frameCounter % HELI.strafeVertPeriod === 1) {
      const r = pseudoRand(heli.frameCounter + 31);
      heli.ty = playerY - arenaH / 3 + (Math.floor(r * 7) - 3) * 12;
    }
  }
  heli.ty = Math.min(arenaH - WORLD.tile * 2, heli.ty);
}

function accelDivisors(
  heli: Helicopter,
  arenaW: number,
  arenaH: number,
): { xDiv: number; yDiv: number } {
  const leaving =
    heli.repositioning ||
    heli.onScreen < 0 ||
    isHeliOffArena(heli, arenaW, arenaH);
  if (leaving) {
    return { xDiv: HELI.exitAccelXDiv, yDiv: HELI.exitAccelYDiv };
  }
  if (heli.behavior === 'strafe') {
    return { xDiv: HELI.strafeAccelXDiv, yDiv: HELI.strafeAccelYDiv };
  }
  return { xDiv: HELI.hoverAccelXDiv, yDiv: HELI.hoverAccelYDiv };
}

/**
 * One sim tick of hover/strafe / reposition (Flash `heliFrame` motion).
 * Tracks the player while on-screen; when {@link Helicopter.onScreen} expires,
 * flies an exit path and respawns with the same health (Flash `addEnemy(health)`).
 * Returns true on a discrete move frame (Flash `move` after `stepc`) — used
 * by {@link tryHeliFire} so fire cadence matches the original.
 */
export function stepHelicopter(
  heli: Helicopter,
  timeStep: number,
  playerCenterX: number,
  playerY: number,
  arenaW: number,
  arenaH: number,
  rng: SpawnRng = createSpawnRng(),
): boolean {
  if (!heli.active) {
    return false;
  }

  // Expire prior-frame flash before motion (Flash clears after one heliFrame).
  if (heli.hitFlashRemaining > 0) {
    heli.hitFlashRemaining = Math.max(0, heli.hitFlashRemaining - timeStep);
  }

  heli.stepAccum += timeStep;
  let move = 0;
  if (heli.stepAccum >= 1) {
    move = 1;
    heli.stepAccum -= 1;
  }

  if (move) {
    heli.frameCounter += 1;
    if (heli.repositioning || heli.onScreen <= 0) {
      if (!heli.repositioning) {
        beginReposition(heli, arenaW, rng);
      }
    } else {
      updateOnScreenTargets(heli, playerCenterX, playerY, arenaW, arenaH);
    }
  }

  const { xDiv, yDiv } = accelDivisors(heli, arenaW, arenaH);
  const dx = heli.tx - heli.x;
  const dy = heli.ty - heli.y;
  heli.xspeed += dx / xDiv;
  heli.yspeed += dy / yDiv;

  if (move) {
    const r = Math.floor((heli.xspeed / 20) * 15);
    heli.rotationDeg = Math.abs(r) > 2 ? r : 0;
  }

  heli.x += heli.xspeed * timeStep;
  heli.y += heli.yspeed * timeStep;

  if (move) {
    heli.xspeed *= 0.9 * timeStep;
    heli.yspeed *= 0.9 * timeStep;
    if (!heli.repositioning) {
      heli.onScreen -= 1;
    }
  }

  // Flash: once far enough off-screen during exit, replace via addEnemy(health).
  if (heli.repositioning && isHeliOffArena(heli, arenaW, arenaH)) {
    respawnHelicopterKeepingHealth(heli, arenaW, arenaH, rng);
  }

  return move === 1;
}

/**
 * Flash heli gun aim toward the player:
 * `gunrotation = aim(heli→player) - heli._rotation`, then ease with
 * `dif/Math.max(1,10-level)` (level 0 → divisor 10).
 */
export function stepHeliGunAim(
  heli: Helicopter,
  playerCenterX: number,
  playerCenterY: number,
  timeStep: number,
  turnDivisor: number = HELI.gunTurnDivisor,
): void {
  if (!heli.active) {
    return;
  }
  const target =
    aimAngleDeg(heli.x, heli.y, playerCenterX, playerCenterY) -
    heli.rotationDeg;
  const dif = shortestAngleDelta(heli.gunRotationDeg, target);
  heli.gunRotationDeg += (dif / turnDivisor) * timeStep;
}

/**
 * Flash aim spread: `gun._rotation - 5 + random(10)` (±5°, width
 * {@link HELI.aimSpreadDeg}). `random(10)` → integer 0..9.
 */
export function heliFireSpreadDeg(
  gunRotationDeg: number,
  rng: SpawnRng,
  spreadDeg: number = HELI.aimSpreadDeg,
): number {
  const half = spreadDeg / 2;
  const jitter = randomInt(rng, spreadDeg);
  return gunRotationDeg - half + jitter;
}

/** Muzzle point along the barrel from heli center. */
export function heliMuzzlePosition(
  heli: Helicopter,
  offset: number = HELI.muzzleOffset,
): { x: number; y: number } {
  const rad = (heli.gunRotationDeg * Math.PI) / 180;
  return {
    x: heli.x + Math.cos(rad) * offset,
    y: heli.y + Math.sin(rad) * offset,
  };
}

export type HeliFireShot = {
  x: number;
  y: number;
  rotationDeg: number;
  speed: number;
  damage: number;
};

/**
 * Flash fire gate: on a discrete move frame, when
 * `(shoot++ % fireInterval) == 1`, spawn an aimed bullet with spread.
 * `fireInterval` defaults to level-0 {@link HELI.fireIntervalFrames}; pass
 * {@link heliFireInterval}(level) for the difficulty ramp (#19).
 * Returns the shot descriptor, or null when not firing this tick.
 */
export function tryHeliFire(
  heli: Helicopter,
  movedThisTick: boolean,
  rng: SpawnRng,
  fireInterval: number = HELI.fireIntervalFrames,
): HeliFireShot | null {
  if (!heli.active || !movedThisTick) {
    return null;
  }
  heli.shootCounter += 1;
  if (heli.shootCounter % fireInterval !== 1) {
    return null;
  }
  const muzzle = heliMuzzlePosition(heli);
  return {
    x: muzzle.x,
    y: muzzle.y,
    rotationDeg: heliFireSpreadDeg(heli.gunRotationDeg, rng),
    speed: HELI.bulletSpeed,
    damage: ENEMY_BULLET.damage,
  };
}

/**
 * Aim + optional fire into an enemy-bullet pool. `movedThisTick` should be
 * true on discrete move frames (Flash `move` after `stepc`).
 * `level` drives Flash `Math.max(10,16-level)` fire cadence and
 * `Math.max(1,10-level)` gun turn (#19 difficulty ramp).
 */
export function stepHeliCombat(
  heli: Helicopter,
  timeStep: number,
  playerCenterX: number,
  playerCenterY: number,
  enemyBullets: EnemyBulletPool,
  rng: SpawnRng,
  movedThisTick = true,
  level = 0,
): HeliFireShot | null {
  const turnDivisor = Math.max(
    HELI.gunTurnDivisorMin,
    HELI.gunTurnDivisor - Math.max(0, level),
  );
  const fireInterval = Math.max(
    HELI.fireIntervalMin,
    HELI.fireIntervalFrames - Math.max(0, level),
  );
  stepHeliGunAim(heli, playerCenterX, playerCenterY, timeStep, turnDivisor);
  const shot = tryHeliFire(heli, movedThisTick, rng, fireInterval);
  if (!shot) {
    return null;
  }
  enemyBullets.acquire(
    shot.x,
    shot.y,
    shot.rotationDeg,
    shot.speed,
    shot.damage,
  );
  return shot;
}

export function stepHeliExplosion(
  explosion: HeliExplosion,
  timeStep: number,
): boolean {
  if (!explosion.active) {
    return false;
  }
  explosion.age += timeStep;
  if (explosion.age >= explosion.maxAge) {
    explosion.active = false;
    return true;
  }
  return false;
}

/**
 * Advance bullets, pixel-test against active helis, apply damage, recycle on hit.
 * Mirrors Flash `bulletFrame` enemy loop (point vs `hit` clip), plus #16/#17
 * special behaviors (flame DoT, mines, rail hitscan, seeker, A-Bomb, grapple).
 * {@link onHit} receives damage dealt so callers can add score (#13).
 * {@link map} enables FireMines / A-Bomb solid / grapple latch.
 * {@link player} enables A-Bomb knockback and Grapple pull (#17).
 */
export function stepBulletsVsHelis(
  pool: BulletPool,
  helis: readonly Helicopter[],
  bounds: Parameters<BulletPool['stepAll']>[1],
  timeStep: number,
  onHit?: (event: HeliHitEvent) => void,
  map?: TileMap,
  player?: AabbBody,
): void {
  for (let i = 0; i < pool.slots.length; i += 1) {
    const bullet = pool.slots[i]!;
    if (!bullet.active) {
      continue;
    }

    const shouldCull = stepSpecialBullet(
      bullet,
      helis,
      timeStep,
      bounds,
      map,
      onHit,
      player,
    );
    if (shouldCull) {
      pool.release(bullet);
    }
  }
}
