# HeliAttack 2 — Reverse-Engineered Game Spec

Extracted from the original ActionScript inside `ha2/heli2.fla`
(source: github.com/iopred/heliattack, GPL-3.0). All values are the
**real** numbers from the shipped game.

> ⚠️ Units: speeds/reloads are in **frames**, not seconds. HeliAttack ran at
> the Flash stage framerate (~30 fps). To port, decide your fps and convert:
> `seconds = frames / fps`, `px_per_sec = px_per_frame * fps`.

---

## World / units
- Tile size: **50 × 50 px** (`tileWidth = tileHeight = 50`)
- `timeStep = 1` normally (all motion is multiplied by it — your delta-time hook)
- Player sprite box: **48 × 48**; collision box **10 wide × 42 tall**
  (`playerwidth=10`, `playerheight=42`) — narrow hitbox, forgiving.

## Player physics
| Property | Value | Notes |
|---|---|---|
| Health | 100 | health powerup = +20, capped at 100 |
| Walk accel | ±1 px/frame per frame | while holding left/right |
| Walk speed (input cap) | ±5 px/frame | |
| Hard speed cap | ±6 px/frame | knockback can exceed input cap briefly |
| Friction (no input) | −1 px/frame toward 0 | decel when keys released |
| Gravity | +1 px/frame² | `yspeed++` each frame |
| Terminal fall | 50 px/frame | clamped to tileHeight |
| Jump | `yspeed = min(yspeed, -8)` | variable height via 6-frame hold window (`up=6`) |
| Double jump | yes | `jump` then `jump2` flags |
| Hyper/boost jump | `yspeed = -32` | charges over 150 frames; needs boost key |
| Wall behavior | stops X, zeroes xspeed | classic AABB tile resolve |
| **Duck** | hold `duckKey` (↓) | shrinks hitbox, blocks walking, blocks double-jump |

### Duck (crouch) — `duckKey = Key.DOWN`
A real mechanic in the original, easy to miss:
- **Hitbox shrinks to 2/3**: `playerWidth = 2/3 · defPlayerWidth` and
  `playerHeight = 2/3 · defPlayerHeight` (default hitbox **10 × 42** →
  **~6.7 × 28** while ducked).
- **Blocks horizontal input**: acceleration only runs `if (move && !duck)` —
  you cannot walk while ducking (friction still decays existing xspeed).
- **Interacts with jump**: the jump-hold window (`up=6`) and the double-jump both
  require `!duck` (`!this.jump2 && !this.duck`) — you can't start/extend a jump or
  double-jump while holding duck.
- **Uses the duck sprite frame** (`gfx.gotoAndStop(2)`; art asset `duck.png`).
- **Stand-up nudge**: on release while grounded, `_y -= 2/3 · defPlayerWidth`
  (note: the original uses *Width* here, not Height — a faithful-port quirk).

Default keys: **←/→ move, ↑ jump, ↓ duck, Ctrl boost, Shift bullet-time**
(rebindable in the original, stored in a SharedObject — see "Deliberate cuts" in
the migration plan for our stance).

## Weapons (the full HA2 arsenal — 14)
`reload` = frames between shots (lower = faster). `speed` = bullet px/frame.
`damage` per hit. Helis have **300 HP**, so "shots to kill" = 300/damage.

| # | Name | Reload | Speed | Damage | Shots to kill heli | Notes |
|---|------|-------:|------:|-------:|---:|---|
| 0 | MachineGun | 5 | 8 | 10 | 30 | starting weapon |
| 1 | Akimbo Mac-10's | 4 | 8 | 9 | ~34 | fastest fire |
| 2 | Shotgun | 25 | 8 | 15 | 20 | (fires spread of pellets) |
| 3 | ShotgunRockets | 40 | 7 | 40 | 8 | |
| 4 | GrenadeLauncher | 30 | 15 | 75 | 4 | fast projectile |
| 5 | RPG | 40 | 4 | 75 | 4 | slow projectile |
| 6 | RocketLauncher | 50 | 7 | 100 | 3 | |
| 7 | SeekerLauncher | 55 | 7 | 100 | 3 | homing |
| 8 | FlameThrower | 1 | 8 | 2 | (DoT) | hold-to-fire, tiny per-tick dmg |
| 9 | FireMines | 100 | 3 | 5 | (DoT) | lobbed, persistent |
| 10 | A-Bomb Launcher | 150 | 3 | 300 | 1 | one-shot, huge cooldown |
| 11 | RailGun | 75 | 20 | 150 | 2 | hitscan-fast |
| 12 | GrappleCannon | 250 | 20 | 300 | 1 | also a grapple/mobility tool |
| 13 | ShoulderCannon | 100 | 20 | 300 | 1 | |

Firing model: reload counts up each frame; can fire when
`reloadtime >= gun.reloadtime`, then resets to 0 and consumes a bullet.
Weapons have limited ammo (`bullets`) except starting gun (∞).

## Powerups
There are **five** timed "state" powerups, chosen at random when a state powerup
is collected: `powerupOn = 1 + random(5)` → a value in **1..5**. Each runs for
`powerupTime = 500` frames (~16.7s @30fps), counted down each frame; when it hits
0, `powerupOn = 0`. Health is a separate, instant pickup (not one of the five).

| `powerupOn` | Name | Effect (from the AS) |
|---:|---|---|
| 1 | **TriDamage** | All weapon damage ×3 — fires `guns[type].damage*3`. |
| 2 | **Invulnerability** | Player takes no damage — hit code is gated `if (powerupon != 2)`. |
| 3 | **PredatorMode** | Player turns invisible (`gfx._alpha = 0`); forced onto the last "predator" gun with infinite reload; **weapon switching disabled** (`powerupon != 3`); enemies can't aim and fire in a random direction. |
| 4 | **TimeRift** | Slow-motion: the world's `timeStep` is reduced, but the **player keeps `timeStep = 1`**, so you move at full speed through a slowed world. |
| 5 | **Jetpack / Fly** | Hold jump → `yspeed = max(yspeed - 2, -32)` (free vertical flight). |

> ⚠️ **Fixed-timestep design note (affects the M0 loop, ticket #3):** TimeRift is
> implemented by scaling the global `timeStep` multiplier that every entity's
> `*Frame(timeStep)` update multiplies into its motion. The fixed-step loop must
> therefore expose a **time-scale factor** from day one (per-frame `timeStep`,
> default 1, lowered during TimeRift, held at 1 for the player). Retrofitting this
> later is painful — bake it in at #3.

**Instant pickup — Health:** +20, capped at 100.

**Drop logic (on heli kill):**
- Health drops when kill-count `rthelis` crosses a **doubling threshold**
  (`nextHealth` starts at 15, then `nextHealth *= 2`).
- Otherwise a random powerup/weapon drop with a small chance
  (`random(100) % 32 == 0` ≈ 3%).

## Enemy: Helicopter
- **HP: 300** (every heli, same). Difficulty comes from *count/pressure*, not tougher units.
- Spawn positions: mostly offscreen left/right (`random(3)`), sometimes top.
- Enemy fire: bullets at **speed 7**, aim spread `rotation - 5 + random(10)` (±5°).
- Off-screen timer: `onscreen = 150 + random(100)` frames.
- **Replacement spawn model**: when a heli is destroyed, `addEnemy(300)` is
  called → a new heli immediately spawns. Constant on-screen population, so the
  game is a relentless treadmill rather than discrete "waves." Score += damage dealt.

## Feel summary (what to nail in the port)
1. **Snappy air control** + double jump + charged hyper-jump = the signature mobility.
2. Narrow hitbox (10px wide) makes dodging bullet spreads satisfying.
3. Weapon variety spans fast-weak → slow-nuke; balance is via reload vs damage vs projectile speed.
4. Endless replacement spawns = arcade score chase, no level end.

---

## Portable pseudo-config (drop into your TS)
```ts
// Assuming you run the sim at a fixed 30 fps to match the original.
// `timeStep` is the per-frame time-scale multiplier every entity applies to its
// motion (default 1). TimeRift lowers it for the world while the player holds 1.
export const WORLD = { tile: 50, gravity: 1, terminal: 50, timeStep: 1 };
export const PLAYER = {
  health: 100, walkAccel: 1, walkCap: 5, hardCap: 6, friction: 1,
  jumpVel: -8, jumpHoldFrames: 6, doubleJump: true,
  boostVel: -32, boostChargeFrames: 150,
  boxW: 10, boxH: 42, spriteW: 48, spriteH: 48,
  duckScale: 2 / 3,        // hitbox W & H multiplier while ducking
  // → ducked hitbox ≈ 6.7 × 28; walking + double-jump disabled while held
};
export const HELI = { hp: 300, bulletSpeed: 7, aimSpreadDeg: 10 };
// Timed "state" powerups: powerupOn = 1 + random(5); each lasts POWERUP_FRAMES.
export const POWERUP_FRAMES = 500; // ~16.7s @30fps
export const POWERUP = {
  TriDamage: 1, Invulnerability: 2, PredatorMode: 3, TimeRift: 4, Jetpack: 5,
} as const;
export const HEALTH_PICKUP = { amount: 20, cap: 100, firstThreshold: 15 };
export const WEAPONS = [
  { name: "MachineGun",     reload: 5,   speed: 8,  damage: 10 },
  { name: "AkimboMac10",    reload: 4,   speed: 8,  damage: 9  },
  { name: "Shotgun",        reload: 25,  speed: 8,  damage: 15 },
  { name: "ShotgunRockets", reload: 40,  speed: 7,  damage: 40 },
  { name: "GrenadeLauncher",reload: 30,  speed: 15, damage: 75 },
  { name: "RPG",            reload: 40,  speed: 4,  damage: 75 },
  { name: "RocketLauncher", reload: 50,  speed: 7,  damage: 100 },
  { name: "SeekerLauncher", reload: 55,  speed: 7,  damage: 100 },
  { name: "FlameThrower",   reload: 1,   speed: 8,  damage: 2, hold: true },
  { name: "FireMines",      reload: 100, speed: 3,  damage: 5 },
  { name: "ABombLauncher",  reload: 150, speed: 3,  damage: 300 },
  { name: "RailGun",        reload: 75,  speed: 20, damage: 150 },
  { name: "GrappleCannon",  reload: 250, speed: 20, damage: 300 },
  { name: "ShoulderCannon", reload: 100, speed: 20, damage: 300 },
];
```
