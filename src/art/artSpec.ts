/**
 * Generate ART-SPEC.md content from the sprite catalog (single source of truth).
 */

import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ART_WORLD_FINAL_DIR,
  ART_WORLD_FINAL_SCALE,
  ATLAS_KEY,
  BG_IMAGE_PATH,
  BG_ORIGINAL_H,
  BG_ORIGINAL_W,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
  HELI_LOOK_FRAMES,
  PLAYER_ANIM_FRAMES,
  SPRITE_DEFS,
  gameDrawSize,
  isFinalSprite,
  textureSize,
} from './catalog';

/** Markdown art bible for artists and the pack pipeline. */
export function renderArtSpecMarkdown(): string {
  const rows = SPRITE_DEFS.map((def) => {
    const tex = textureSize(def);
    const draw = gameDrawSize(def);
    const kind = isFinalSprite(def) ? 'final' : 'placeholder';
    return `| \`${def.id}\` | \`${def.sourceFile}\` | ${def.originalW}×${def.originalH} | ${tex.w}×${tex.h} (${kind}) | ${draw.w}×${draw.h} | (${def.pivot.x}, ${def.pivot.y}) | ${def.role} |`;
  }).join('\n');

  return `# Art Spec — Heli Attack 2

> Generated from \`src/art/catalog.ts\`. Re-run \`npm run art:pack\` after catalog
> edits to refresh the packed atlas and this document.

## Design resolution

| | |
|---|---|
| Canvas | **${GAME_WIDTH}×${GAME_HEIGHT}** |
| Sim / Flash units | 1 game px = 1 original Flash px |
| Player sprite box (spec) | **${PLAYER.spriteW}×${PLAYER.spriteH}** |
| Player collision box | **${PLAYER.boxW}×${PLAYER.boxH}** (top-left origin) |
| Tile size | **${WORLD.tile}×${WORLD.tile}** |
| Legacy placeholder upscale | **${ART_PLACEHOLDER_SCALE}×** (retired after #34) |
| Player final scale | **${ART_PLAYER_FINAL_SCALE}×** Flash original size (committed under \`${ART_PLAYER_FINAL_DIR}/\`) |
| World final scale | **${ART_WORLD_FINAL_SCALE}×** Flash original size (committed under \`${ART_WORLD_FINAL_DIR}/\`) |
| Phaser atlas key | \`${ATLAS_KEY}\` |
| Background plate | \`public/${BG_IMAGE_PATH}\` (not packed; ${BG_ORIGINAL_W}×${BG_ORIGINAL_H} @ ${ART_WORLD_FINAL_SCALE}×) |

Shipped art is **temporary original Flash** sprites from iopred \`ha2/assets\`
(#95), nearest-neighbor upscaled into the atlas pipeline. Hi-res redraws TBD.

## Pivot convention

Pivots are normalized **(0–1)** in Phaser terms:

- \`(0.5, 1)\` — bottom-center (characters standing on the ground)
- \`(0.5, 0.5)\` — center (projectiles, VFX, helis)
- \`(0, 0)\` — top-left (tiles)
- \`(0.2, 0.5)\` — grip-biased (held weapons)

Game logic places the **collision AABB** at top-left \`(x, y)\`. When drawing a
character sprite, align the pivot to the bottom-center of that AABB:

\`\`\`
spriteX = body.x + body.w / 2
spriteY = body.y + body.h
origin  = (pivot.x, pivot.y)   // usually (0.5, 1)
\`\`\`

## Player animation frames

| State | Frame id(s) | Flash gfx |
|---|---|---|
| Idle / stand | \`${PLAYER_ANIM_FRAMES.idle}\` | frame 1 |
| Duck | \`${PLAYER_ANIM_FRAMES.duck}\` | frame 2 |
| Jump | \`${PLAYER_ANIM_FRAMES.jump}\` | frame 3 |
| Walk | \`${PLAYER_ANIM_FRAMES.walk.join('`, `')}\` | frame 4 (nested cycle) |
| Double-jump | \`${PLAYER_ANIM_FRAMES.jump2}\` | frame 5 |
| Hurt | \`${PLAYER_ANIM_FRAMES.hurt}\` | i-frame / hit flash pose |
| Death | \`${PLAYER_ANIM_FRAMES.death}\` | \`guyBurned\` swap |

## Heli look frames

| Look | Behavior | Frame id |
|---|---|---|
| 0 | hover | \`${HELI_LOOK_FRAMES[0]}\` |
| 1 | strafe | \`${HELI_LOOK_FRAMES[1]}\` |
| (hit) | damaged flash | \`heli_hit\` |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
${rows}

## Adding a new sprite

1. **Source art:** import originals via \`npm run art:import-original\` (or drop
   PNGs under \`${ART_PLAYER_FINAL_DIR}/\` / \`${ART_WORLD_FINAL_DIR}/\`), then set \`final: true\` on the catalog
   entry.
2. Append a \`SpriteDef\` to \`SPRITE_DEFS\` in \`src/art/catalog.ts\` with measured
   \`originalW\` / \`originalH\`, pivot, and role.
3. Mirror the entry in \`scripts/art/pack-atlas.mjs\`.
4. Run \`npm run art:pack\` — packs \`public/atlas/game-atlas.{png,json}\`,
   copies \`public/${BG_IMAGE_PATH}\`, and regenerates this file.
5. Use the frame via \`ATLAS_KEY\` + frame id (see \`selectPlayerAnimFrame\`,
   \`heliFrameForLook\`).
6. Add / update unit tests in \`src/art/*.test.ts\` if sizes, pivots, or
   Flash-original acceptance are critical.

## Pipeline commands

\`\`\`bash
# Import temporary original Flash sprites (Pillow; needs reference/ha2-source/gfx)
npm run art:import-original

# Pack atlas (requires ImageMagick)
npm run art:pack
\`\`\`

Outputs (committed):

- \`${ART_PLAYER_FINAL_DIR}/player_*.png\` (player sources — temp Flash #95)
- \`${ART_WORLD_FINAL_DIR}/*.png\` (world sources + bg plate — temp Flash #95)
- \`public/atlas/game-atlas.png\`
- \`public/atlas/game-atlas.json\`
- \`public/${BG_IMAGE_PATH}\`
- \`docs/ART-SPEC.md\` (this file)
`;
}
