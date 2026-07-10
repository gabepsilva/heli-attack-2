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
| Legacy placeholder upscale | **4×** (retired after #34) |
| Player final scale | **8×** Flash original size (committed under `art/player/`) |
| World final scale | **4×** Flash original size (committed under `art/world/`) |
| Phaser atlas key | `game-atlas` |
| Background plate | `public/art/bg.png` (not packed; 452×322 @ 4×) |

Shipped art is **temporary original Flash** sprites from iopred `ha2/assets`
(#95), nearest-neighbor upscaled into the atlas pipeline. Hi-res redraws TBD.

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

| State | Frame id(s) | Flash gfx |
|---|---|---|
| Idle / stand | `player_idle` | frame 1 |
| Duck | `player_duck` | frame 2 |
| Jump | `player_jump` | frame 3 |
| Walk | `player_step1`, `player_step2` | frame 4 (nested cycle) |
| Double-jump | `player_jump2` | frame 5 |
| Hurt | `player_hurt` | i-frame / hit flash pose |
| Death | `player_death` | `guyBurned` swap |

## Heli look frames

| Look | Behavior | Frame id |
|---|---|---|
| 0 | hover | `heli` |
| 1 | strafe | `heli_strafe` |
| (hit) | damaged flash | `heli_hit` |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
| `player_idle` | `player_idle.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player stand / idle (temp Flash guy.png) |
| `player_duck` | `player_duck.png` | 25×39 | 200×312 (final) | 48×48 | (0.5, 1) | Player duck (temp Flash duck.png) |
| `player_jump` | `player_jump.png` | 25×55 | 200×440 (final) | 48×48 | (0.5, 1) | Player jump (temp Flash jump.png) |
| `player_jump2` | `player_jump2.png` | 25×55 | 200×440 (final) | 48×48 | (0.5, 1) | Player double-jump (temp Flash jump2.png) |
| `player_step1` | `player_step1.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player walk cycle frame 1 (temp Flash step1.png) |
| `player_step2` | `player_step2.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player walk cycle frame 2 (temp Flash step2.png) |
| `player_hurt` | `player_hurt.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player hurt flash (stub: reuse guy.png — no dedicated original) |
| `player_death` | `player_death.png` | 40×49 | 320×392 (final) | 48×48 | (0.5, 1) | Player death (temp Flash guyburned.png) |
| `heli` | `heli.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Enemy helicopter look 0 / hover (temp Flash heli.png) |
| `heli_strafe` | `heli_strafe.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Enemy helicopter look 1 / strafe (stub: reuse heli.png) |
| `heli_hit` | `heli_hit.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Helicopter damaged flash (temp Flash heli_hit.png) |
| `heli_destroyed` | `heliDestroyed.png` | 173×89 | 692×356 (final) | 173×89 | (0.5, 0.5) | Helicopter wreck (temp Flash heliDestroyed.png) |
| `enemy_guy` | `enemyguy.png` | 25×50 | 100×200 (final) | 25×50 | (0.5, 1) | Paratrooper / ground enemy (temp Flash enemyguy.png) |
| `bullet_player` | `bullett.png` | 10×9 | 40×36 (final) | 10×9 | (0.5, 0.5) | Player projectile (temp Flash bullett.png) |
| `bullet_enemy` | `enemybullet.png` | 10×9 | 40×36 (final) | 10×9 | (0.5, 0.5) | Enemy projectile (temp Flash enemybullet.png) |
| `weapon_machinegun` | `machineGun.png` | 29×16 | 116×64 (final) | 29×16 | (0.2, 0.5) | Starting machine gun (temp Flash machineGun.png) |
| `muzzle_flash` | `muzzle_flash.png` | 16×16 | 64×64 (final) | 18×18 | (0.5, 0.5) | Weapon muzzle flash (generated stub — no Flash original) |
| `grenade` | `grenade.png` | 19×11 | 76×44 (final) | 19×11 | (0.5, 0.5) | Grenade projectile (temp Flash grenade.png) |
| `rocket` | `Rocket.png` | 21×15 | 84×60 (final) | 21×15 | (0.5, 0.5) | Rocket projectile (temp Flash Rocket.png) |
| `smoke` | `smoke.png` | 28×27 | 112×108 (final) | 28×27 | (0.5, 0.5) | Smoke VFX (temp Flash smoke.png) |
| `blood` | `blood.png` | 30×30 | 120×120 (final) | 30×30 | (0.5, 0.5) | Hit / blood VFX (temp Flash blood.png) |
| `explosion` | `explosion.png` | 187×186 | 748×744 (final) | 120×120 | (0.5, 0.5) | Heli death explosion (temp Flash bigboom.png, half-res catalog) |
| `powerup` | `powerup.png` | 33×32 | 132×128 (final) | 33×32 | (0.5, 0.5) | Powerup crate base (temp Flash powerup.png) |
| `tile_floor` | `Floor.png` | 52×52 | 208×208 (final) | 50×50 | (0, 0) | Solid floor tile (temp Flash assets/new/Floor.png; maps to WORLD.tile) |

## Adding a new sprite

1. **Source art:** import originals via `npm run art:import-original` (or drop
   PNGs under `art/player/` / `art/world/`), then set `final: true` on the catalog
   entry.
2. Append a `SpriteDef` to `SPRITE_DEFS` in `src/art/catalog.ts` with measured
   `originalW` / `originalH`, pivot, and role.
3. Mirror the entry in `scripts/art/pack-atlas.mjs`.
4. Run `npm run art:pack` — packs `public/atlas/game-atlas.{png,json}`,
   copies `public/art/bg.png`, and regenerates this file.
5. Use the frame via `ATLAS_KEY` + frame id (see `selectPlayerAnimFrame`,
   `heliFrameForLook`).
6. Add / update unit tests in `src/art/*.test.ts` if sizes, pivots, or
   Flash-original acceptance are critical.

## Pipeline commands

```bash
# Import temporary original Flash sprites (Pillow; needs reference/ha2-source/gfx)
npm run art:import-original

# Pack atlas (requires ImageMagick)
npm run art:pack
```

Outputs (committed):

- `art/player/player_*.png` (player sources — temp Flash #95)
- `art/world/*.png` (world sources + bg plate — temp Flash #95)
- `public/atlas/game-atlas.png`
- `public/atlas/game-atlas.json`
- `public/art/bg.png`
- `docs/ART-SPEC.md` (this file)
