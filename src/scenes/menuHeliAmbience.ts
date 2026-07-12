/**
 * Flash loading-screen heli (timeline frames 7–14): nested `gun` clip in the
 * doorway aims and fires. Reused on our main menu for visual parity — the
 * ActionScript menu frame itself is empty of heli, but the pre-menu intro
 * always showed the door gunner shooting.
 *
 * Pure sim (no Phaser): the scene renders {@link MenuHeliAmbienceState}.
 * Runs on the same 30 Hz fixed step as the game via
 * {@link FixedTimestepAccumulator}, so aim speed and fire cadence are identical
 * on a 30 Hz and a 144 Hz display.
 */

import {
  createHelicopter,
  createSpawnRng,
  heliGunnerWorldPose,
  heliGunWorldPose,
  stepHeliGunAim,
  tryHeliFire,
  type Helicopter,
  type HeliGunnerWorldPose,
  type HeliGunWorldPose,
  type SpawnRng,
} from '../combat/helicopter';
import {
  arenaCullBounds,
  isOutsideCullBounds,
  velocityFromRotation,
  type CullBounds,
} from '../combat/bullet';
import { HELI, SIM_HZ } from '../config/constants';
import { BG_ORIGINAL_H, BG_ORIGINAL_W } from '../config/art';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { FixedTimestepAccumulator } from '../core/fixedTimestep';

/** Flash PlaceObject for Heli on the loading frames: tx=40.35, ty=76.4. */
const FLASH_HELI_X = 40.35;
const FLASH_HELI_Y = 76.4;

/** Hover bob amplitude / period (cosmetic; not in AS — keeps the idle gunner alive). */
const BOB_AMPLITUDE = 6;
const BOB_HZ = 0.55;
const BOB_RADIANS_PER_FRAME = (BOB_HZ * 2 * Math.PI) / SIM_HZ;
/** Soft bank rides the bob (the Flash idle heli sat near 0°). */
const BOB_BANK_DEG = 3;

/** Fire slower than in-game level-0 ({@link HELI.fireIntervalFrames}) so the menu stays readable. */
const MENU_FIRE_INTERVAL = 20;

/** Gun starts aimed down-right, into the menu. */
const INITIAL_GUN_DEG = 35;

const COSMETIC_BULLET_POOL = 12;

export type MenuCosmeticBullet = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotationDeg: number;
};

export type MenuHeliAmbienceState = {
  readonly heli: Helicopter;
  readonly bullets: MenuCosmeticBullet[];
  readonly clock: FixedTimestepAccumulator;
  readonly cull: CullBounds;
  readonly rng: SpawnRng;
  readonly baseX: number;
  readonly baseY: number;
  /** Radians into the hover cycle. */
  bobPhase: number;
};

/** Flash loading-heli center mapped onto the full-size menu plate. */
export function menuHeliStagePosition(): { x: number; y: number } {
  return {
    x: (FLASH_HELI_X / BG_ORIGINAL_W) * GAME_WIDTH,
    y: (FLASH_HELI_Y / BG_ORIGINAL_H) * GAME_HEIGHT,
  };
}

export function createMenuHeliAmbience(
  poolSize: number = COSMETIC_BULLET_POOL,
): MenuHeliAmbienceState {
  const { x, y } = menuHeliStagePosition();
  const heli = createHelicopter(x, y, HELI.hp);
  heli.gunRotationDeg = INITIAL_GUN_DEG;
  heli.look = 0;
  return {
    heli,
    bullets: Array.from({ length: poolSize }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rotationDeg: 0,
    })),
    clock: new FixedTimestepAccumulator(),
    cull: arenaCullBounds(GAME_WIDTH, GAME_HEIGHT),
    rng: createSpawnRng(),
    baseX: x,
    baseY: y,
    bobPhase: 0,
  };
}

/**
 * Bank `dtSec` of wall time and run whole sim frames: bob the hull, ease the
 * gun toward `aimX/aimY`, fire on the Flash cadence, and fly the cosmetic
 * bullets. The scene reads the resulting state — nothing is returned.
 */
export function stepMenuHeliAmbience(
  state: MenuHeliAmbienceState,
  aimX: number,
  aimY: number,
  dtSec: number,
): void {
  const steps = state.clock.advance(dtSec);
  for (let i = 0; i < steps; i += 1) {
    stepMenuHeliFrame(state, aimX, aimY);
  }
}

/** One 30 Hz sim frame. */
function stepMenuHeliFrame(
  state: MenuHeliAmbienceState,
  aimX: number,
  aimY: number,
): void {
  const { heli } = state;

  state.bobPhase += BOB_RADIANS_PER_FRAME;
  const bob = Math.sin(state.bobPhase);
  heli.x = state.baseX;
  heli.y = state.baseY + bob * BOB_AMPLITUDE;
  heli.rotationDeg = bob * BOB_BANK_DEG;

  stepHeliGunAim(heli, aimX, aimY, 1, HELI.gunTurnDivisor);

  // `movedThisTick` is always true: the hull bobs every frame.
  const shot = tryHeliFire(heli, true, state.rng, MENU_FIRE_INTERVAL);
  if (shot) {
    spawnMenuCosmeticBullet(
      state,
      shot.x,
      shot.y,
      shot.rotationDeg,
      shot.speed,
    );
  }

  stepMenuCosmeticBullets(state);
}

/** Claim a free pool slot; drops the shot when the pool is full (cosmetic). */
function spawnMenuCosmeticBullet(
  state: MenuHeliAmbienceState,
  x: number,
  y: number,
  rotationDeg: number,
  speed: number,
): void {
  const slot = state.bullets.find((b) => !b.active);
  if (!slot) {
    return;
  }
  const { vx, vy } = velocityFromRotation(speed, rotationDeg);
  slot.active = true;
  slot.x = x;
  slot.y = y;
  slot.vx = vx;
  slot.vy = vy;
  slot.rotationDeg = rotationDeg;
}

/** Advance one sim frame at Flash speed (px/frame) and cull off-screen. */
function stepMenuCosmeticBullets(state: MenuHeliAmbienceState): void {
  for (const bullet of state.bullets) {
    if (!bullet.active) {
      continue;
    }
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    if (isOutsideCullBounds(bullet.x, bullet.y, state.cull)) {
      bullet.active = false;
    }
  }
}

/** Current door-gun pose for the renderer. */
export function menuHeliGunPose(
  state: MenuHeliAmbienceState,
): HeliGunWorldPose {
  return heliGunWorldPose(state.heli);
}

/** Door-gunner body (`enemyguy`) pose — fixed to the hull. */
export function menuHeliGunnerPose(
  state: MenuHeliAmbienceState,
): HeliGunnerWorldPose {
  return heliGunnerWorldPose(state.heli);
}
