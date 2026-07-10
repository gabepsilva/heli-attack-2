/**
 * Central game constants seeded from the reverse-engineered HA2 spec.
 * Speeds / reloads are per sim frame at {@link SIM_HZ} (original Flash ~30 fps).
 *
 * {@link WORLD.timeStep} is only the **initial default** (1) used to seed a
 * live {@link TimeScale} instance. Entity motion must multiply by the live
 * `timeScale.timeStep` — never by `WORLD.timeStep` directly — or bullet-time
 * / TimeRift will silently no-op for that entity.
 *
 * {@link WORLD} and {@link PLAYER} are **mutable** so the debug tuning harness
 * (#8) can edit gravity / jump / walk values at runtime. Spec seeds live in
 * {@link WORLD_DEFAULTS} / {@link PLAYER_DEFAULTS}; call
 * {@link resetPhysicsConstants} to restore them.
 */

import { WEAPONS } from './weapons';

/** Full 14-weapon arsenal — see {@link ./weapons}. */
export {
  MACHINE_GUN,
  PREDATOR_WEAPON_INDEX,
  WEAPONS,
  WEAPON_COUNT,
  WEAPON_PICKUP_AMMO,
  getWeaponDef,
  type WeaponDef,
} from './weapons';

/** Fixed simulation rate matching the original Flash stage framerate. */
export const SIM_HZ = 30;

/** Duration of one sim tick in seconds. */
export const SIM_DT = 1 / SIM_HZ;

/** Duration of one sim tick in milliseconds (for Phaser delta conversion). */
export const SIM_DT_MS = 1000 / SIM_HZ;

/** Immutable spec seed for world physics (issue #8 reset target). */
export const WORLD_DEFAULTS = {
  tile: 50,
  gravity: 1,
  terminal: 50,
  /**
   * Initial time-scale seed (default 1). Not the live factor — entities must
   * read `TimeScale.timeStep` from their scene's SimSession / TimeScale.
   */
  timeStep: 1,
} as const;

/** Immutable spec seed for player physics (issue #8 reset target). */
export const PLAYER_DEFAULTS = {
  health: 100,
  walkAccel: 1,
  walkCap: 5,
  hardCap: 6,
  friction: 1,
  jumpVel: -8,
  jumpHoldFrames: 6,
  doubleJump: true,
  boostVel: -32,
  boostChargeFrames: 150,
  boxW: 10,
  boxH: 42,
  spriteW: 48,
  spriteH: 48,
  duckScale: 2 / 3,
} as const;

/** Live world constants — numeric fields are mutable for the tuning harness. */
export type WorldConstants = {
  tile: number;
  gravity: number;
  terminal: number;
  timeStep: number;
};

/** Live player constants — numeric fields are mutable for the tuning harness. */
export type PlayerConstants = {
  health: number;
  walkAccel: number;
  walkCap: number;
  hardCap: number;
  friction: number;
  jumpVel: number;
  jumpHoldFrames: number;
  doubleJump: boolean;
  boostVel: number;
  boostChargeFrames: number;
  boxW: number;
  boxH: number;
  spriteW: number;
  spriteH: number;
  duckScale: number;
};

/** Live world constants — mutated by the physics tuning harness. */
export const WORLD: WorldConstants = { ...WORLD_DEFAULTS };

/** Live player constants — mutated by the physics tuning harness. */
export const PLAYER: PlayerConstants = { ...PLAYER_DEFAULTS };

/** Restore {@link WORLD} and {@link PLAYER} to the exact spec seeds. */
export function resetPhysicsConstants(): void {
  Object.assign(WORLD, WORLD_DEFAULTS);
  Object.assign(PLAYER, PLAYER_DEFAULTS);
}

export const HELI = {
  hp: 300,
  bulletSpeed: 7,
  /**
   * Aim jitter width in degrees (Flash `gun._rotation-5+random(10)` → ±5°).
   * Spec portable config: `aimSpreadDeg: 10`.
   */
  aimSpreadDeg: 10,
  /** Flash `heli.png` logical size (game-space pixels). */
  spriteW: 212,
  spriteH: 106,
  /** Flash `onscreen = 150+random(100)` spawn timer. */
  onScreenFramesMin: 150,
  onScreenFramesRand: 100,
  /**
   * Flash `gotoAndStop(random(2)+1)` — two visual frames / looks (#20).
   */
  lookCount: 2,
  /**
   * Hover (look 0): soft player track — Flash on-screen `dx/200`, `dy/100`.
   */
  hoverAccelXDiv: 200,
  hoverAccelYDiv: 100,
  /** Hover X retarget period (Flash `xt++%75 == 1`). */
  hoverDriftPeriod: 75,
  /** Hover Y retarget period (Flash `yt++%40 == 1`). */
  hoverVertPeriod: 40,
  /**
   * Strafe (look 1): snappier lateral sweeps — distinguishable from hover (#20).
   * Wider X chase, more frequent retarget, slightly softer vertical.
   */
  strafeAccelXDiv: 80,
  strafeAccelYDiv: 120,
  strafeDriftPeriod: 40,
  strafeVertPeriod: 55,
  /**
   * Flash off-screen / leaving accel: `dx/100`, `dy/20` when outside the
   * viewport or after the onscreen timer expires.
   */
  exitAccelXDiv: 100,
  exitAccelYDiv: 20,
  /**
   * Flash exit pick: `goto = random(10)`; `<4` left, `<8` right, else top.
   */
  exitGotoRange: 10,
  exitLeftMax: 4,
  exitRightMax: 8,
  /** How far past the arena edge exit targets sit (sprite widths). */
  exitMarginMul: 2,
  /** Placeholder boom VFX lifetime (sim frames). */
  explosionDurationFrames: 20,
  /**
   * Hit-flash duration in sim frames. Flash applies a white tint for the
   * single heliFrame where `lasthealth != health` after a bullet hit.
   */
  hitFlashFrames: 1,
  /**
   * Fire cadence at level 0 (Flash `shoot++%Math.max(10,16-level)`).
   * Fires when the counter modulo this equals 1.
   */
  fireIntervalFrames: 16,
  /**
   * Floor of Flash `Math.max(10,16-level)` — fire never faster than this.
   */
  fireIntervalMin: 10,
  /** Flash gun turn: `dif/Math.max(1,10-level)` at level 0. */
  gunTurnDivisor: 10,
  /** Floor of Flash `Math.max(1,10-level)`. */
  gunTurnDivisorMin: 1,
  /** Muzzle distance from heli center along the barrel (px). */
  muzzleOffset: 40,
} as const;

/**
 * Scene tints for the two Flash heli looks (#20). Look 0 = hover (warm),
 * look 1 = strafe (cool) so the behaviors read as distinct on screen.
 */
export const HELI_LOOK_TINT = [0xf4a261, 0x4cc9f0] as const;

/**
 * Replacement spawn treadmill + difficulty ramp (#19 / #109).
 *
 * Flash always calls `addEnemy(300)` on kill / fly-off (1:1 replacement) and
 * raises `level` when `score > nextLevel` (starts at 10000, doubles). Living
 * combat population stays at exactly one heli — the every-3-kills crate
 * cadence (`POWERUP_DROP.killsPerCrate`) does not grow on-screen count (#109).
 */
export const HELI_SPAWN = {
  /** Opening concurrent population (first `addEnemy` after drop-in). */
  initialConcurrent: 1,
  /** Flash parity: never more than one living combat heli (#109). */
  maxConcurrent: 1,
  /** Flash `nextLevel = 10000` — first score threshold for `level++`. */
  firstLevelScore: 10000,
} as const;

/**
 * Enemy projectiles (#18) — Flash `addEnemyBullet` / `enemyBulletFrame`.
 * Damage is a flat 10 (not weapon-table driven).
 */
export const ENEMY_BULLET = {
  /** Flash `player.health -= 10` on hit. */
  damage: 10,
  /** Same as {@link HELI.bulletSpeed}. */
  speed: 7,
  poolCapacity: 64,
  maxLifetimeFrames: 300,
  cullMargin: WORLD_DEFAULTS.tile,
  /** Placeholder draw radius (px). */
  radius: 3,
} as const;

/**
 * Player combat vitals (#18). Max health matches {@link PLAYER_DEFAULTS.health}.
 * I-frames are a brief post-hit window called out in the ticket — the original
 * stacks every bullet; i-frames prevent same-volley instant death while staying
 * shorter than {@link HELI.fireIntervalFrames} so successive heli shots still land.
 */
export const PLAYER_COMBAT = {
  maxHealth: 100,
  /** Brief post-hit invulnerability in sim frames. */
  iFrameFrames: 10,
} as const;

/**
 * Score display (#13). Internal score accumulates damage dealt; the HUD
 * multiplies by {@link SCORE.displayScale} (Flash `Math.floor(score)*100`).
 */
export const SCORE = {
  displayScale: 100,
} as const;

/**
 * Local high-score table (#25). Flash stored a single SharedObject `highscore`
 * (`hs = Math.floor(score)`); we keep a ranked local table in `localStorage`
 * and still compare with floor(score) like Flash `Math.floor(score) > hs`.
 */
export const HIGH_SCORES = {
  /** `localStorage` key for the persisted table + career stats. */
  storageKey: 'heli-attack-2.highScores',
  /** Max ranked rows kept locally (menu / game-over table). */
  maxEntries: 10,
} as const;

/**
 * Session loop / game states (#24). Flash `gameover++` each frame while dead;
 * stats screen when `gameover > 200`. Pause key default is ASCII 80 (`P`).
 * (Flash also opens stats when enemy/entity arrays are empty — omitted here;
 * replacement spawns keep the heli treadmill populated.)
 */
export const GAME_FLOW = {
  /** Flash: show stats when `gameover > 200`. */
  gameOverDelayFrames: 200,
  /** Flash default `pauseKey = 80` (`P`) — scenes bind via `keyboard.addKey`. */
  pauseKeyCode: 80,
} as const;

/**
 * Held starting gun (machine gun). Size/pivot match Flash `machineGun.png`
 * (29×16, grip at 0.2×0.5). Attach is the grip offset from the player AABB
 * top-left (chest mount). Aim turn rate matches Flash `dif/2*timeStep`.
 */
export const GUN = {
  /** Grip offset from player AABB top-left → gun pivot (world, unrotated). */
  attachX: 5,
  attachY: 16,
  /** Machine-gun draw size (Flash `machineGun.png`). */
  spriteW: 29,
  spriteH: 16,
  /** Normalized Phaser origin — grip-biased. */
  pivotX: 0.2,
  pivotY: 0.5,
  /**
   * Muzzle tip in gun-local space relative to the grip pivot, along +X barrel.
   * `(1 - pivotX) * spriteW` = distance from grip to the sprite's right edge.
   */
  muzzleLocalX: (1 - 0.2) * 29,
  muzzleLocalY: 0,
  /** Flash: `gun._rotation += dif / turnDivisor * timeStep`. */
  turnDivisor: 2,
} as const;

/** Timed "state" powerups each last this many sim frames (~16.7s @30Hz). */
export const POWERUP_FRAMES = 500;

export const POWERUP = {
  TriDamage: 1,
  Invulnerability: 2,
  PredatorMode: 3,
  TimeRift: 4,
  Jetpack: 5,
} as const;

/**
 * Timed state-powerup effect tunables (#22).
 *
 * Flash: TriDamage fires `guns[type].damage*3`; Jetpack hold-jump does
 * `yspeed = Math.max(yspeed - 2, -32)`.
 */
export const POWERUP_EFFECTS = {
  /** TriDamage weapon damage multiplier. */
  triDamageMultiplier: 3,
  /** Jetpack upward accel per discrete move frame (subtracted from yspeed). */
  jetpackThrust: 2,
  /** Jetpack upward speed floor (Flash −32, same as boost). */
  jetpackMaxUpSpeed: -32,
} as const;

export const HEALTH_PICKUP = {
  amount: 20,
  cap: 100,
  firstThreshold: 15,
} as const;

/**
 * Kill-drop / parachute pickup tunables (#21 / #91).
 *
 * Flash: on every 3rd kill (`helis == 3`), always attach a powerup; health when
 * `rthelis >= nextHealth` (starts 15, doubles), else a random weapon/state
 * frame. The Flash `random(100) % 32 == 0` roll only sets a visual `randomed`
 * cycle flag — it does **not** gate whether a crate spawns (#91).
 */
export const POWERUP_DROP = {
  /** Flash `helis == 3` — one crate every N heli kills. */
  killsPerCrate: 3,
  /**
   * Non-health crate frames in Flash `power._totalframes` (frames 2..14):
   * weapons 1–12 + one state-powerup roll.
   */
  nonHealthFrameCount: 13,
  /** Flash `powerup.png` logical size. */
  crateW: 33,
  crateH: 32,
  /** Slow descent while the chute is open (Flash non-fall `yspeed = 2`). */
  chuteFallSpeed: 2,
  /** Gravity while chute collapses (Flash `yspeed++` per discrete step). */
  fallGravity: 1,
  /** Flash near-ground probe: `map[floor((_y+150)/tile)]`. */
  groundLookaheadPx: 150,
  /** Soft-land when `yspeed < 4` (Flash). */
  softLandSpeed: 4,
  /** Hard-land bounce (Flash `yspeed *= -0.25`). */
  bounceScale: -0.25,
  /** Chute open/close rate (Flash `chute._xscale ± 10` per step). */
  chuteScaleRate: 10,
} as const;

export const BULLET_TIME = {
  maxFrames: 250,
  refillPerKill: 250 / 3,
  minScale: 0.2,
  easePerFrame: 0.1,
} as const;

/**
 * Pooled projectile defaults (#10). Speed/damage match MachineGun; cull margin
 * matches Flash ±1 tile past the camera/arena edge. Capacity is fixed — the
 * pool never grows after construction (zero per-shot allocation).
 */
export const BULLET = {
  /** MachineGun projectile speed (px per sim frame). */
  defaultSpeed: WEAPONS[0].speed,
  /** MachineGun damage per hit. */
  defaultDamage: WEAPONS[0].damage,
  /**
   * Max age in sim frames before forced recycle (safety net beyond off-screen
   * cull). Arena diagonal ≈ 1442 px / speed 8 ≈ 180 frames; pad for slow guns.
   */
  maxLifetimeFrames: 300,
  /** Extra px beyond arena AABB before off-screen cull (Flash ±1 tile). */
  cullMargin: WORLD.tile,
  /** Fixed preallocated pool size — never grows on acquire. */
  poolCapacity: 64,
  /** Placeholder draw radius (px). */
  radius: 3,
} as const;

/**
 * Special-behavior weapon tunables (#16) — Flash `flameFrame` / `fireMinesFrame`
 * / `railFrame` / `seekerFrame`.
 */
export const SPECIAL_PROJECTILE = {
  /** FlameThrower aim jitter half-width (Flash `rot-10+random(20)`). */
  flameSpreadHalfDeg: 10,
  /**
   * Flame particle lifetime in sim frames (stand-in for Flash flame gfx
   * `_totalframes`; short so hold-to-fire streams continuous DoT).
   */
  flameLifetimeFrames: 10,
  /** FireMines gravity per discrete move step (Flash `yspeed += 1`). */
  mineGravity: 1,
  /** Wall bounce scale on X (Flash `xspeed *= -0.5`). */
  mineBounceScale: -0.5,
  /**
   * Planted mine lifetime after landing (Flash fades after `active > 30`,
   * then removes when alpha ≤ 0 — ~10 fade frames → ~40 total).
   */
  mineActiveFrames: 40,
  /** Seeker turn divisor (Flash `rotation += dif/15 * timeStep`). */
  seekerTurnDivisor: 15,
  /**
   * RailGun beam linger after hitscan (Flash fades `_alpha` over a few
   * anim ticks). Damage is applied on the first step only.
   */
  railLingerFrames: 3,
} as const;

/**
 * Heavy / signature weapon tunables (#17) — Flash `aBombFrame` / `grappleFrame`
 * / `grappleAttached` / ShoulderCannon→`railFrame`.
 */
export const HEAVY_PROJECTILE = {
  /**
   * A-Bomb blast radius in px (Flash `dist<300` knockback + huge boom
   * `_xscale = 800`). Helis inside this radius take full bomb damage.
   */
  abombBlastRadius: 300,
  /** Peak player knockback X at ground zero (Flash `mult*24`). */
  abombKnockbackX: 24,
  /** Peak player knockback Y at ground zero (Flash `mult*64`). */
  abombKnockbackY: 64,
  /**
   * Grapple reel acceleration toward the hook (px/sim-frame²). Flash draws a
   * rope but the decompile omits an explicit pull — this is the port's
   * mobility tool so the AC "grapple demonstrably moves the player" holds.
   */
  grapplePullAccel: 8,
  /** Max frames the hook stays latched before auto-release. */
  grappleAttachedFrames: 90,
} as const;
