/**
 * Generate ART-SPEC.md content from the sprite catalog (single source of truth).
 */

import {
  ART_PLACEHOLDER_SCALE,
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ATLAS_KEY,
} from '../config/art';
import { PLAYER, WORLD } from '../config/constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
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
| Placeholder upscale | **${ART_PLACEHOLDER_SCALE}×** nearest-neighbor from reference PNGs |
| Player final scale | **${ART_PLAYER_FINAL_SCALE}×** Flash original size (committed under \`${ART_PLAYER_FINAL_DIR}/\`) |
| Phaser atlas key | \`${ATLAS_KEY}\` |

Player frames are **final** hi-res redraws (#33). Remaining placeholders are
replaced in #34. Do not ship original GPL art as final product art.

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

## Sprite table

| Frame id | Source file | Original (Flash) | Texture | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
${rows}

## Adding a new sprite

1. **Placeholder (until #34):** drop the reference PNG into
   \`reference/ha2-source/gfx/\` (gitignored — pull from
   [iopred/heliattack](https://github.com/iopred/heliattack) \`ha2/assets\`).
2. **Final player:** add / regenerate under \`${ART_PLAYER_FINAL_DIR}/\` via
   \`npm run art:player\`, then set \`final: true\` on the catalog entry.
3. Append a \`SpriteDef\` to \`SPRITE_DEFS\` in \`src/art/catalog.ts\` with measured
   \`originalW\` / \`originalH\`, pivot, and role.
4. Run \`npm run art:pack\` — packs \`public/atlas/game-atlas.{png,json}\`,
   and regenerates this file.
5. Use the frame via \`ATLAS_KEY\` + frame id (see \`selectPlayerAnimFrame\`).
6. Add / update unit tests in \`src/art/*.test.ts\` / \`src/player/playerAnim.test.ts\`
   if sizes, pivots, or state→frame mapping are acceptance-critical.

## Pipeline commands

\`\`\`bash
# Regenerate final player redraws (Pillow)
npm run art:player

# Pack atlas (requires ImageMagick; reference PNGs for non-player placeholders)
npm run art:pack
\`\`\`

Outputs (committed):

- \`${ART_PLAYER_FINAL_DIR}/player_*.png\` (final player sources)
- \`public/atlas/game-atlas.png\`
- \`public/atlas/game-atlas.json\`
- \`docs/ART-SPEC.md\` (this file)
`;
}
