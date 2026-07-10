/**
 * Generate ART-SPEC.md content from the sprite catalog (single source of truth).
 */

import { ART_PLACEHOLDER_SCALE, ATLAS_KEY } from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
  PLAYER_ANIM_FRAMES,
  SPRITE_DEFS,
  gameDrawSize,
  textureSize,
} from './catalog';

/** Markdown art bible for artists and the pack pipeline. */
export function renderArtSpecMarkdown(): string {
  const rows = SPRITE_DEFS.map((def) => {
    const tex = textureSize(def);
    const draw = gameDrawSize(def);
    return `| \`${def.id}\` | \`${def.sourceFile}\` | ${def.originalW}×${def.originalH} | ${tex.w}×${tex.h} | ${draw.w}×${draw.h} | (${def.pivot.x}, ${def.pivot.y}) | ${def.role} |`;
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
| Placeholder upscale | **${ART_PLACEHOLDER_SCALE}×** nearest-neighbor from reference PNGs |
| Phaser atlas key | \`${ATLAS_KEY}\` |

Placeholders are **temporary**. Final hi-res redraws land in #33 (player) and #34
(everything else). Do not ship original GPL art as final product art.

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

| State | Frame id(s) |
|---|---|
| Idle / stand | \`${PLAYER_ANIM_FRAMES.idle}\` |
| Duck | \`${PLAYER_ANIM_FRAMES.duck}\` |
| Jump | \`${PLAYER_ANIM_FRAMES.jump}\` |
| Double-jump | \`${PLAYER_ANIM_FRAMES.jump2}\` |
| Walk | \`${PLAYER_ANIM_FRAMES.walk.join('`, `')}\` |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture (placeholder) | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
${rows}

## Adding a new sprite

1. Drop the reference PNG into \`reference/ha2-source/gfx/\` (gitignored — pull from
   [iopred/heliattack](https://github.com/iopred/heliattack) \`ha2/assets\`).
2. Append a \`SpriteDef\` to \`SPRITE_DEFS\` in \`src/art/catalog.ts\` with measured
   \`originalW\` / \`originalH\`, pivot, and role.
3. Run \`npm run art:pack\` — upscales, packs \`public/atlas/game-atlas.{png,json}\`,
   and regenerates this file.
4. Use the frame via \`ATLAS_KEY\` + frame id (see \`GameScene\` player placeholder).
5. Add / update unit tests in \`src/art/*.test.ts\` if sizes or pivots are
   acceptance-critical.

## Pipeline commands

\`\`\`bash
# Requires: ImageMagick (\`convert\`), reference PNGs in reference/ha2-source/gfx/
npm run art:pack
\`\`\`

Outputs (committed):

- \`public/atlas/game-atlas.png\`
- \`public/atlas/game-atlas.json\`
- \`docs/ART-SPEC.md\` (this file)
`;
}
