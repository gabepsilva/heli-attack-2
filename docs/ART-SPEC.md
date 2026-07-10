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
| Player final scale | **8×** Flash original size (committed under `art/player/`) |
| Phaser atlas key | `game-atlas` |

Player frames are **final** hi-res redraws (#33). Remaining placeholders are
replaced in #34. Do not ship original GPL art as final product art.

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
| `heli` | `heli.png` | 212×106 | 848×424 (placeholder) | 212×106 | (0.5, 0.5) | Enemy helicopter |
| `heli_hit` | `heli_hit.png` | 212×106 | 848×424 (placeholder) | 212×106 | (0.5, 0.5) | Helicopter damaged flash |
| `heli_destroyed` | `heliDestroyed.png` | 173×89 | 692×356 (placeholder) | 173×89 | (0.5, 0.5) | Helicopter wreck |
| `enemy_guy` | `enemyguy.png` | 25×50 | 100×200 (placeholder) | 25×50 | (0.5, 1) | Paratrooper / ground enemy |
| `bullet_player` | `bullett.png` | 10×9 | 40×36 (placeholder) | 10×9 | (0.5, 0.5) | Player projectile |
| `bullet_enemy` | `enemybullet.png` | 10×9 | 40×36 (placeholder) | 10×9 | (0.5, 0.5) | Enemy projectile |
| `weapon_machinegun` | `machineGun.png` | 29×16 | 116×64 (placeholder) | 29×16 | (0.2, 0.5) | Starting machine gun |
| `grenade` | `grenade.png` | 19×11 | 76×44 (placeholder) | 19×11 | (0.5, 0.5) | Grenade projectile |
| `rocket` | `Rocket.png` | 21×15 | 84×60 (placeholder) | 21×15 | (0.5, 0.5) | Rocket projectile |
| `smoke` | `smoke.png` | 28×27 | 112×108 (placeholder) | 28×27 | (0.5, 0.5) | Smoke VFX |
| `blood` | `blood.png` | 30×30 | 120×120 (placeholder) | 30×30 | (0.5, 0.5) | Hit / blood VFX |
| `powerup` | `powerup.png` | 33×32 | 132×128 (placeholder) | 33×32 | (0.5, 0.5) | Powerup crate base |
| `tile_floor` | `Floor.png` | 52×52 | 208×208 (placeholder) | 50×50 | (0, 0) | Solid floor tile (maps to WORLD.tile in game space) |

## Adding a new sprite

1. **Placeholder (until #34):** drop the reference PNG into
   `reference/ha2-source/gfx/` (gitignored — pull from
   [iopred/heliattack](https://github.com/iopred/heliattack) `ha2/assets`).
2. **Final player:** add / regenerate under `art/player/` via
   `npm run art:player`, then set `final: true` on the catalog entry.
3. Append a `SpriteDef` to `SPRITE_DEFS` in `src/art/catalog.ts` with measured
   `originalW` / `originalH`, pivot, and role.
4. Run `npm run art:pack` — packs `public/atlas/game-atlas.{png,json}`,
   and regenerates this file.
5. Use the frame via `ATLAS_KEY` + frame id (see `selectPlayerAnimFrame`).
6. Add / update unit tests in `src/art/*.test.ts` / `src/player/playerAnim.test.ts`
   if sizes, pivots, or state→frame mapping are acceptance-critical.

## Pipeline commands

```bash
# Regenerate final player redraws (Pillow)
npm run art:player

# Pack atlas (requires ImageMagick; reference PNGs for non-player placeholders)
npm run art:pack
```

Outputs (committed):

- `art/player/player_*.png` (final player sources)
- `public/atlas/game-atlas.png`
- `public/atlas/game-atlas.json`
- `docs/ART-SPEC.md` (this file)
