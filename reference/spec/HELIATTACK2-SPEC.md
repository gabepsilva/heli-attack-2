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

Default keys: **←/→ move, ↑ jump, Ctrl boost** (rebindable, stored in SharedObject).

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
- **TriDamage** (`powerupon == 3`): all weapon damage ×3, temporary.
- **Fly/jetpack** (`powerupon == 5`): hold jump → `yspeed -= 2` up to −32 (free flight).
- **Health**: +20 (cap 100).
- Drop logic:
  - Health drops when kill-count `rthelis` crosses a **doubling threshold**
    (1, 2, 4, 8, 16, …) — `nextHealth *= 2`.
  - Weapon/ammo powerup: ~3% per kill (`random(100) % 32 == 0`).

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
export const WORLD = { tile: 50, gravity: 1, terminal: 50 };
export const PLAYER = {
  health: 100, walkAccel: 1, walkCap: 5, hardCap: 6, friction: 1,
  jumpVel: -8, jumpHoldFrames: 6, doubleJump: true,
  boostVel: -32, boostChargeFrames: 150,
  boxW: 10, boxH: 42, spriteW: 48, spriteH: 48,
};
export const HELI = { hp: 300, bulletSpeed: 7, aimSpreadDeg: 10 };
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
