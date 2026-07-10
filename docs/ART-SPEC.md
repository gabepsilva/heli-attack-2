# Art Spec — Heli Attack 2

> Generated from `src/art/catalog.ts`. Re-run `npm run art:pack` after catalog
> edits to refresh the packed atlas and this document.

## Design resolution

| | |
|---|---|
| Canvas | **1920×1080** |
| Sim / Flash units | 1 game px = 1 original Flash px |
| Player sprite box (spec) | **48×48** |
| Player collision box | **10×42** (top-left origin) |
| Tile size | **50×50** |
| Placeholder upscale | **4×** nearest-neighbor from reference PNGs |
| Phaser atlas key | `game-atlas` |

Placeholders are **temporary**. Final hi-res redraws land in #33 (player) and #34
(everything else). Do not ship original GPL art as final product art.

## Pivot convention

Pivots are normalized **(0–1)** in Phaser terms:

- `(0.5, 1)` — bottom-center (characters standing on the ground)
- `(0.5, 0.5)` — center (projectiles, VFX, helis)
- `(0, 0)` — top-left (tiles)
- `(0.2, 0.5)` — grip-biased (held weapons)

Game logic places the **collision AABB** at top-left `(x, y)`. When drawing a
character sprite, align the pivot to the bottom-center of that AABB:

```
spriteX = body.x + body.w / 2
spriteY = body.y + body.h
origin  = (pivot.x, pivot.y)   // usually (0.5, 1)
```

## Player animation frames

| State | Frame id(s) |
|---|---|
| Idle / stand | `player_idle` |
| Duck | `player_duck` |
| Jump | `player_jump` |
| Double-jump | `player_jump2` |
| Walk | `player_step1`, `player_step2` |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture (placeholder) | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
| `player_idle` | `guy.png` | 24×49 | 96×196 | 48×48 | (0.5, 1) | Player stand / idle (hero gfx frame) |
| `player_duck` | `duck.png` | 25×39 | 100×156 | 48×48 | (0.5, 1) | Player duck (`gfx.gotoAndStop(2)` / duck.png) |
| `player_jump` | `jump.png` | 25×55 | 100×220 | 48×48 | (0.5, 1) | Player jump |
| `player_jump2` | `jump2.png` | 25×55 | 100×220 | 48×48 | (0.5, 1) | Player double-jump / air variant |
| `player_step1` | `step1.png` | 24×49 | 96×196 | 48×48 | (0.5, 1) | Player walk cycle frame 1 |
| `player_step2` | `step2.png` | 24×49 | 96×196 | 48×48 | (0.5, 1) | Player walk cycle frame 2 |
| `heli` | `heli.png` | 212×106 | 848×424 | 212×106 | (0.5, 0.5) | Enemy helicopter |
| `heli_hit` | `heli_hit.png` | 212×106 | 848×424 | 212×106 | (0.5, 0.5) | Helicopter damaged flash |
| `heli_destroyed` | `heliDestroyed.png` | 173×89 | 692×356 | 173×89 | (0.5, 0.5) | Helicopter wreck |
| `enemy_guy` | `enemyguy.png` | 25×50 | 100×200 | 25×50 | (0.5, 1) | Paratrooper / ground enemy |
| `bullet_player` | `bullett.png` | 10×9 | 40×36 | 10×9 | (0.5, 0.5) | Player projectile |
| `bullet_enemy` | `enemybullet.png` | 10×9 | 40×36 | 10×9 | (0.5, 0.5) | Enemy projectile |
| `weapon_machinegun` | `machineGun.png` | 29×16 | 116×64 | 29×16 | (0.2, 0.5) | Starting machine gun |
| `grenade` | `grenade.png` | 19×11 | 76×44 | 19×11 | (0.5, 0.5) | Grenade projectile |
| `rocket` | `Rocket.png` | 21×15 | 84×60 | 21×15 | (0.5, 0.5) | Rocket projectile |
| `smoke` | `smoke.png` | 28×27 | 112×108 | 28×27 | (0.5, 0.5) | Smoke VFX |
| `blood` | `blood.png` | 30×30 | 120×120 | 30×30 | (0.5, 0.5) | Hit / blood VFX |
| `powerup` | `powerup.png` | 33×32 | 132×128 | 33×32 | (0.5, 0.5) | Powerup crate base |
| `tile_floor` | `Floor.png` | 52×52 | 208×208 | 50×50 | (0, 0) | Solid floor tile (maps to WORLD.tile in game space) |

## Adding a new sprite

1. Drop the reference PNG into `reference/ha2-source/gfx/` (gitignored — pull from
   [iopred/heliattack](https://github.com/iopred/heliattack) `ha2/assets`).
2. Append a `SpriteDef` to `SPRITE_DEFS` in `src/art/catalog.ts` with measured
   `originalW` / `originalH`, pivot, and role.
3. Run `npm run art:pack` — upscales, packs `public/atlas/game-atlas.{png,json}`,
   and regenerates this file.
4. Use the frame via `ATLAS_KEY` + frame id (see `GameScene` player placeholder).
5. Add / update unit tests in `src/art/*.test.ts` if sizes or pivots are
   acceptance-critical.

## Pipeline commands

```bash
# Requires: ImageMagick (`convert`), reference PNGs in reference/ha2-source/gfx/
npm run art:pack
```

Outputs (committed):

- `public/atlas/game-atlas.png`
- `public/atlas/game-atlas.json`
- `docs/ART-SPEC.md` (this file)
