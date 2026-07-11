/**
 * Helicopter enemy — plain sim matching HA2 `addEnemy` / `heliFrame` essentials.
 * Phaser only draws; hit tests use the baked alpha mask ({@link bulletHitsHeli}).
 * Enemy fire (#18): aimed gun + speed-7 bullets with ±5° spread.
 * Variants (#20): two looks (visual only — Flash `gotoAndStop`); shared
 * `heliFrame` motion, onscreen reposition timer, and off-screen approach / exit.
 */

import { ENEMY_BULLET, HELI, WORLD } from '../config/constants';
import { aimAngleDeg, shortestAngleDelta } from './gunAim';
import type { BulletPool } from './bullet';
import type { EnemyBulletPool } from './enemyBullet';
import { stepSpecialBullet } from './specialProjectile';
import type { AabbBody } from '../world/aabbBody';
import type { TileMap } from '../world/tileMap';

/**
 * Flash `gotoAndStop(random(2)+1)` frames, zero-indexed. Purely visual — both
 * looks fly the same `heliFrame` motion, so nothing in the sim branches on it.
 */
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
  /** Move-frame counter for xt/yt retarget periods (Flash `xt` / `yt`). */
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
  /**
   * True the first time this bullet damages any heli (#25 accuracy).
   * DoT / splash / multi-heli beams still score every tick, but accuracy
   * only credits the first contact so hits ≤ projectiles spawned.
   */
  firstContact: boolean;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
 * Flash camera visibility — the sprite box overlaps the view, grown by one tile.
 * The camera is fixed over the whole arena, so "in view" means "in the arena".
 * Gates `onscreen--` so the timer does not tick down while still approaching.
 */
export function isHeliInView(
  heli: Readonly<{ x: number; y: number }>,
  arenaW: number,
  arenaH: number,
  margin: number = WORLD.tile,
): boolean {
  const halfW = HELI.spriteW / 2;
  const halfH = HELI.spriteH / 2;
  return (
    heli.x + halfW >= -margin &&
    heli.x - halfW <= arenaW + margin &&
    heli.y + halfH >= -margin &&
    heli.y - halfH <= arenaH + margin
  );
}

/**
 * Flash exit-accel gate: `onscreen < 0`, or the heli center has left the camera
 * on the left / top / right (`_y < camTop || _x < camLeft || _x > camLeft+spw`).
 * Note Flash has no bottom test here — a heli under the floor still eases in.
 */
function usesExitAccel(heli: Helicopter, arenaW: number): boolean {
  return heli.onScreen < 0 || heli.y < 0 || heli.x < 0 || heli.x > arenaW;
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

/**
 * Width of the Flash `xdif` draw window: `random(spw - width/2)`.
 * Both terms are compile-time constants, so the span is too.
 */
const X_DRIFT_SPAN = Math.max(1, Math.floor(HELI.viewW - HELI.spriteW / 2));

/** Everything a motion tick reads about the world, so helpers take one arg. */
type HeliStepContext = {
  /** Flash `player._x` — the player's left edge, not its center. */
  playerX: number;
  playerY: number;
  /** Flash `player.hjump` — the heli dives below a hyper-jumping player. */
  playerHjump: boolean;
  arenaW: number;
  arenaH: number;
  rng: SpawnRng;
  /** True on a discrete move frame (Flash `move` after `stepc`). */
  move: boolean;
};

/**
 * Flash exit targets, with the fixed camera sitting over the whole arena:
 * left `camLeft - 2*spw`, right `camLeft + arenaW + spw`, top `camTop - sph`.
 */
function applyExitTargets(heli: Helicopter, arenaW: number): void {
  if (heli.exitPath === 'left') {
    heli.tx = -HELI.exitViewMulLeft * HELI.viewW;
  } else if (heli.exitPath === 'right') {
    heli.tx = arenaW + HELI.exitViewMulRight * HELI.viewW;
  } else if (heli.exitPath === 'top') {
    heli.ty = -HELI.exitViewMulTop * HELI.viewH;
  }
}

/** Flash `onscreen <= 0`: pick an exit and aim at it. Targets then stay put. */
function beginReposition(heli: Helicopter, ctx: HeliStepContext): void {
  heli.repositioning = true;
  heli.exitPath = pickHeliExitPath(ctx.rng);
  applyExitTargets(heli, ctx.arenaW);
}

/**
 * Flash on-screen chase: `tx = player._x + xdif` with a periodic `xdif` redraw,
 * `ty` at hover height on its own period, or diving below a hyper-jumping
 * player. Only `hjump` retargets every frame; the rest are move-frame only.
 */
function updateChaseTargets(heli: Helicopter, ctx: HeliStepContext): void {
  const halfW = HELI.spriteW / 2;

  // Flash: xdif = -spw/2 + random(spw - width/2) + width/2
  if (ctx.move && heli.frameCounter % HELI.chaseDriftPeriod === 1) {
    heli.xDrift =
      -HELI.viewW / 2 + randomInt(ctx.rng, X_DRIFT_SPAN) + halfW;
  }
  heli.tx = clamp(ctx.playerX + heli.xDrift, halfW, ctx.arenaW - halfW);

  if (ctx.playerHjump) {
    // Flash: ty = min(mapH - sph/2 - 100, player._y + 50 + random(50))
    heli.ty = Math.min(
      ctx.arenaH - HELI.viewH / 2 - HELI.hjumpFloorMargin,
      ctx.playerY +
        HELI.hjumpDropBelowPlayer +
        randomInt(ctx.rng, HELI.hjumpDropRand),
    );
  } else if (ctx.move && heli.frameCounter % HELI.chaseVertPeriod === 1) {
    // Flash: ty = player._y - sph/2 - (-2 + random(4)) * 10
    const jitter =
      HELI.chaseVertJitterMin + randomInt(ctx.rng, HELI.chaseVertJitterRange);
    heli.ty =
      ctx.playerY - HELI.viewH / 2 - jitter * HELI.chaseVertJitterStep;
  }
}

/** Flash `dx/100, dy/20` once off-view or past the timer, else `dx/200, dy/100`. */
function accelDivisors(
  heli: Helicopter,
  arenaW: number,
): { xDiv: number; yDiv: number } {
  return usesExitAccel(heli, arenaW)
    ? { xDiv: HELI.exitAccelXDiv, yDiv: HELI.exitAccelYDiv }
    : { xDiv: HELI.chaseAccelXDiv, yDiv: HELI.chaseAccelYDiv };
}

/**
 * One sim tick of Flash `heliFrame` motion (shared by both looks — the look
 * only picks art). Chases the player while on-screen; when
 * {@link Helicopter.onScreen} expires, flies an exit path and respawns with the
 * same health (Flash `addEnemy(health)`).
 * `playerX` is Flash `player._x` (left edge), not the player center.
 * Returns true on a discrete move frame (Flash `move` after `stepc`) — used
 * by {@link tryHeliFire} so fire cadence matches the original.
 */
export function stepHelicopter(
  heli: Helicopter,
  timeStep: number,
  playerX: number,
  playerY: number,
  arenaW: number,
  arenaH: number,
  rng: SpawnRng = createSpawnRng(),
  playerHjump = false,
): boolean {
  if (!heli.active) {
    return false;
  }

  // Expire prior-frame flash before motion (Flash clears after one heliFrame).
  if (heli.hitFlashRemaining > 0) {
    heli.hitFlashRemaining = Math.max(0, heli.hitFlashRemaining - timeStep);
  }

  heli.stepAccum += timeStep;
  const move = heli.stepAccum >= 1;
  if (move) {
    heli.stepAccum -= 1;
    heli.frameCounter += 1;
  }

  const ctx: HeliStepContext = {
    playerX,
    playerY,
    playerHjump,
    arenaW,
    arenaH,
    rng,
    move,
  };

  if (heli.onScreen <= 0) {
    if (!heli.repositioning) {
      beginReposition(heli, ctx);
    }
    // Flash: once far enough off-screen during exit, replace via addEnemy(health).
    if (isHeliOffArena(heli, arenaW, arenaH)) {
      respawnHelicopterKeepingHealth(heli, arenaW, arenaH, rng);
      return move;
    }
  } else {
    updateChaseTargets(heli, ctx);
  }

  const { xDiv, yDiv } = accelDivisors(heli, arenaW);
  heli.xspeed += (heli.tx - heli.x) / xDiv;
  heli.yspeed += (heli.ty - heli.y) / yDiv;

  if (move) {
    const r = Math.floor((heli.xspeed / 20) * 15);
    heli.rotationDeg = Math.abs(r) > 2 ? r : 0;
  }

  heli.x += heli.xspeed * timeStep;
  heli.y += heli.yspeed * timeStep;

  if (move) {
    heli.xspeed *= 0.9 * timeStep;
    heli.yspeed *= 0.9 * timeStep;
    // Flash: onscreen-- only while camera-visible (incl. during the exit run).
    if (isHeliInView(heli, arenaW, arenaH)) {
      heli.onScreen -= 1;
    }
  }

  return move;
}

/**
 * Flash heli gun aim toward the player:
 * `gunrotation = aim(heli→player) - heli._rotation`, then ease with
 * `dif/Math.max(1,10-level)` (level 0 → divisor 10).
 *
 * PredatorMode (#22): aim at a random X across a screen-width window centered
 * on the player (Flash `playerX - spw/2 + random(spw)`), so enemies cannot
 * track. Returns the target gun angle (pre-ease) so fire can snap to it.
 */
export function stepHeliGunAim(
  heli: Helicopter,
  playerCenterX: number,
  playerCenterY: number,
  timeStep: number,
  turnDivisor: number = HELI.gunTurnDivisor,
  predatorMode: boolean = false,
  rng?: SpawnRng,
  screenWidth: number = 1920,
): number {
  if (!heli.active) {
    return heli.gunRotationDeg;
  }
  let aimX = playerCenterX;
  if (predatorMode && rng) {
    // Flash: player._x + width/2 - spw/2 + random(spw).
    aimX = playerCenterX - screenWidth / 2 + randomInt(rng, screenWidth);
  }
  const target =
    aimAngleDeg(heli.x, heli.y, aimX, playerCenterY) - heli.rotationDeg;
  const dif = shortestAngleDelta(heli.gunRotationDeg, target);
  heli.gunRotationDeg += (dif / turnDivisor) * timeStep;
  return target;
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
 * `predatorMode` randomizes aim so enemies cannot track the invisible player.
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
  predatorMode = false,
): HeliFireShot | null {
  const turnDivisor = Math.max(
    HELI.gunTurnDivisorMin,
    HELI.gunTurnDivisor - Math.max(0, level),
  );
  const fireInterval = Math.max(
    HELI.fireIntervalMin,
    HELI.fireIntervalFrames - Math.max(0, level),
  );
  const aimTarget = stepHeliGunAim(
    heli,
    playerCenterX,
    playerCenterY,
    timeStep,
    turnDivisor,
    predatorMode,
    rng,
  );
  // Flash: under PredatorMode, snap gun._rotation = gunrotation before spawn.
  const willFire =
    heli.active &&
    movedThisTick &&
    (heli.shootCounter + 1) % fireInterval === 1;
  if (predatorMode && willFire) {
    heli.gunRotationDeg = aimTarget;
  }
  const shot = tryHeliFire(heli, movedThisTick, rng, fireInterval);
  if (!shot) {
    return null;
  }
  enemyBullets.acquire(shot.x, shot.y, shot.rotationDeg, {
    speed: shot.speed,
    damage: shot.damage,
  });
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
