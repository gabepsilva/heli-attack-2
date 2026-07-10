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

All catalog frames are **final** hi-res redraws (#33 player, #34 world). Do not
ship original GPL art as final product art.

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
| `player_idle` | `player_idle.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player stand / idle (final hi-res; Flash guy.png pose) |
| `player_duck` | `player_duck.png` | 25×39 | 200×312 (final) | 48×48 | (0.5, 1) | Player duck (final hi-res; Flash gfx frame 2 / duck.png) |
| `player_jump` | `player_jump.png` | 25×55 | 200×440 (final) | 48×48 | (0.5, 1) | Player jump (final hi-res; Flash gfx frame 3) |
| `player_jump2` | `player_jump2.png` | 25×55 | 200×440 (final) | 48×48 | (0.5, 1) | Player double-jump (final hi-res; Flash gfx frame 5) |
| `player_step1` | `player_step1.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player walk cycle frame 1 (final hi-res; Flash gfx frame 4) |
| `player_step2` | `player_step2.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player walk cycle frame 2 (final hi-res; Flash gfx frame 4) |
| `player_hurt` | `player_hurt.png` | 24×49 | 192×392 (final) | 48×48 | (0.5, 1) | Player hurt flash pose (final hi-res; shown during i-frames) |
| `player_death` | `player_death.png` | 40×49 | 320×392 (final) | 48×48 | (0.5, 1) | Player death (final hi-res; Flash guyBurned swap) |
| `heli` | `heli.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Enemy helicopter look 0 / hover (final hi-res; warm desert) |
| `heli_strafe` | `heli_strafe.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Enemy helicopter look 1 / strafe (final hi-res; cool steel) |
| `heli_hit` | `heli_hit.png` | 212×106 | 848×424 (final) | 212×106 | (0.5, 0.5) | Helicopter damaged flash (final hi-res) |
| `heli_destroyed` | `heliDestroyed.png` | 173×89 | 692×356 (final) | 173×89 | (0.5, 0.5) | Helicopter wreck (final hi-res) |
| `enemy_guy` | `enemyguy.png` | 25×50 | 100×200 (final) | 25×50 | (0.5, 1) | Paratrooper / ground enemy (final hi-res) |
| `bullet_player` | `bullett.png` | 10×9 | 40×36 (final) | 10×9 | (0.5, 0.5) | Player projectile (final hi-res) |
| `bullet_enemy` | `enemybullet.png` | 10×9 | 40×36 (final) | 10×9 | (0.5, 0.5) | Enemy projectile (final hi-res) |
| `weapon_machinegun` | `machineGun.png` | 29×16 | 116×64 (final) | 29×16 | (0.2, 0.5) | Starting machine gun (final hi-res) |
| `muzzle_flash` | `muzzle_flash.png` | 16×16 | 64×64 (final) | 18×18 | (0.5, 0.5) | Weapon muzzle flash (final hi-res) |
| `grenade` | `grenade.png` | 19×11 | 76×44 (final) | 19×11 | (0.5, 0.5) | Grenade projectile (final hi-res) |
| `rocket` | `Rocket.png` | 21×15 | 84×60 (final) | 21×15 | (0.5, 0.5) | Rocket projectile (final hi-res) |
| `smoke` | `smoke.png` | 28×27 | 112×108 (final) | 28×27 | (0.5, 0.5) | Smoke VFX (final hi-res) |
| `blood` | `blood.png` | 30×30 | 120×120 (final) | 30×30 | (0.5, 0.5) | Hit / blood VFX (final hi-res) |
| `explosion` | `explosion.png` | 187×186 | 748×744 (final) | 120×120 | (0.5, 0.5) | Heli death explosion (final hi-res; half Flash bigboom) |
| `powerup` | `powerup.png` | 33×32 | 132×128 (final) | 33×32 | (0.5, 0.5) | Powerup crate base (final hi-res) |
| `tile_floor` | `Floor.png` | 52×52 | 208×208 (final) | 50×50 | (0, 0) | Solid floor tile (final hi-res; maps to WORLD.tile) |

## Adding a new sprite

1. **Final art:** add / regenerate under `art/player/` (`npm run art:player`)
   or `art/world/` (`npm run art:world`), then set `final: true` on the catalog
   entry.
2. Append a `SpriteDef` to `SPRITE_DEFS` in `src/art/catalog.ts` with measured
   `originalW` / `originalH`, pivot, and role.
3. Mirror the entry in `scripts/art/pack-atlas.mjs`.
4. Run `npm run art:pack` — packs `public/atlas/game-atlas.{png,json}`,
   copies `public/art/bg.png`, and regenerates this file.
5. Use the frame via `ATLAS_KEY` + frame id (see `selectPlayerAnimFrame`,
   `heliFrameForLook`).
6. Add / update unit tests in `src/art/*.test.ts` if sizes, pivots, or
   final-vs-placeholder acceptance are critical.

## Pipeline commands

```bash
# Regenerate final player redraws (Pillow)
npm run art:player

# Regenerate final world redraws (Pillow) — helis, weapons, VFX, tiles, bg
npm run art:world

# Pack atlas (requires ImageMagick)
npm run art:pack
```

Outputs (committed):

- `art/player/player_*.png` (final player sources)
- `art/world/*.png` (final world sources + bg plate)
- `public/atlas/game-atlas.png`
- `public/atlas/game-atlas.json`
- `public/art/bg.png`
- `docs/ART-SPEC.md` (this file)
