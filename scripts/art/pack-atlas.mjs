#!/usr/bin/env node
/**
 * Pack Phaser hash atlas + write ART-SPEC.md.
 *
 * - Final player frames (#33): committed PNGs under art/player/ (8× Flash size).
 * - Other sprites (#32 placeholders): 4× nearest-neighbor from
 *   reference/ha2-source/gfx/ (gitignored — pull from iopred/heliattack).
 *
 * Outputs (committed): public/atlas/game-atlas.{png,json}, docs/ART-SPEC.md
 *
 * Catalog numbers here must match src/art/catalog.ts — Vitest asserts parity.
 *
 * Usage: npm run art:pack
 * Requires: ImageMagick (`convert`, `identify`).
 * Optional: npm run art:player  (regenerate final player PNGs)
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const gfxDir = join(root, 'reference/ha2-source/gfx');
const playerFinalDir = join(root, 'art/player');
const outDir = join(root, 'public/atlas');
const stagingDir = join(outDir, '.staging');
const artSpecPath = join(root, 'docs/ART-SPEC.md');

export const PLACEHOLDER_SCALE = 4;
export const PLAYER_FINAL_SCALE = 8;
export const ATLAS_PADDING = 2;
export const ATLAS_MAX_SIZE = 2048;

/** Mirrors src/art/catalog.ts SPRITE_DEFS — tests assert parity. */
export const SPRITE_DEFS = [
  {
    id: 'player_idle',
    sourceFile: 'player_idle.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player stand / idle (final hi-res; Flash guy.png pose)',
    final: true,
  },
  {
    id: 'player_duck',
    sourceFile: 'player_duck.png',
    originalW: 25,
    originalH: 39,
    pivot: { x: 0.5, y: 1 },
    role: 'Player duck (final hi-res; Flash gfx frame 2 / duck.png)',
    final: true,
  },
  {
    id: 'player_jump',
    sourceFile: 'player_jump.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player jump (final hi-res; Flash gfx frame 3)',
    final: true,
  },
  {
    id: 'player_jump2',
    sourceFile: 'player_jump2.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player double-jump (final hi-res; Flash gfx frame 5)',
    final: true,
  },
  {
    id: 'player_step1',
    sourceFile: 'player_step1.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 1 (final hi-res; Flash gfx frame 4)',
    final: true,
  },
  {
    id: 'player_step2',
    sourceFile: 'player_step2.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 2 (final hi-res; Flash gfx frame 4)',
    final: true,
  },
  {
    id: 'player_hurt',
    sourceFile: 'player_hurt.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player hurt flash pose (final hi-res; shown during i-frames)',
    final: true,
  },
  {
    id: 'player_death',
    sourceFile: 'player_death.png',
    originalW: 40,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player death (final hi-res; Flash guyBurned swap)',
    final: true,
  },
  {
    id: 'heli',
    sourceFile: 'heli.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter',
  },
  {
    id: 'heli_hit',
    sourceFile: 'heli_hit.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter damaged flash',
  },
  {
    id: 'heli_destroyed',
    sourceFile: 'heliDestroyed.png',
    originalW: 173,
    originalH: 89,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter wreck',
  },
  {
    id: 'enemy_guy',
    sourceFile: 'enemyguy.png',
    originalW: 25,
    originalH: 50,
    pivot: { x: 0.5, y: 1 },
    role: 'Paratrooper / ground enemy',
  },
  {
    id: 'bullet_player',
    sourceFile: 'bullett.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Player projectile',
  },
  {
    id: 'bullet_enemy',
    sourceFile: 'enemybullet.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy projectile',
  },
  {
    id: 'weapon_machinegun',
    sourceFile: 'machineGun.png',
    originalW: 29,
    originalH: 16,
    pivot: { x: 0.2, y: 0.5 },
    role: 'Starting machine gun',
  },
  {
    id: 'grenade',
    sourceFile: 'grenade.png',
    originalW: 19,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Grenade projectile',
  },
  {
    id: 'rocket',
    sourceFile: 'Rocket.png',
    originalW: 21,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Rocket projectile',
  },
  {
    id: 'smoke',
    sourceFile: 'smoke.png',
    originalW: 28,
    originalH: 27,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Smoke VFX',
  },
  {
    id: 'blood',
    sourceFile: 'blood.png',
    originalW: 30,
    originalH: 30,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Hit / blood VFX',
  },
  {
    id: 'powerup',
    sourceFile: 'powerup.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Powerup crate base',
  },
  {
    id: 'tile_floor',
    sourceFile: 'Floor.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Solid floor tile (maps to WORLD.tile in game space)',
  },
];

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function packRects(items, padding, maxSize) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const rects = [];
  let shelfY = padding;
  let shelfH = 0;
  let cursorX = padding;
  let usedW = 0;
  let usedH = 0;

  for (const item of sorted) {
    if (item.w + padding * 2 > maxSize || item.h + padding * 2 > maxSize) {
      throw new Error(
        `Frame "${item.id}" (${item.w}×${item.h}) exceeds atlas max ${maxSize}`,
      );
    }
    if (cursorX + item.w + padding > maxSize) {
      shelfY += shelfH + padding;
      cursorX = padding;
      shelfH = 0;
    }
    if (shelfY + item.h + padding > maxSize) {
      throw new Error(`Atlas overflow packing "${item.id}"`);
    }
    rects.push({ id: item.id, x: cursorX, y: shelfY, w: item.w, h: item.h });
    cursorX += item.w + padding;
    shelfH = Math.max(shelfH, item.h);
    usedW = Math.max(usedW, cursorX);
    usedH = Math.max(usedH, shelfY + item.h + padding);
  }
  return {
    width: nextPowerOfTwo(Math.max(1, usedW)),
    height: nextPowerOfTwo(Math.max(1, usedH)),
    rects,
  };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status})`);
  }
}

function identifySize(path) {
  const r = spawnSync('identify', ['-format', '%w %h', path], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`identify failed for ${path}`);
  }
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number);
  return { w, h };
}

function textureSize(def) {
  const scale = def.final ? PLAYER_FINAL_SCALE : PLACEHOLDER_SCALE;
  return { w: def.originalW * scale, h: def.originalH * scale };
}

/**
 * Mirrors src/art/artSpec.ts — Vitest asserts the TypeScript renderer produces
 * the same markdown as this function for the shared catalog.
 */
export function renderArtSpecMarkdown(defs, placeholderScale, playerScale) {
  const PLAYER = { spriteW: 48, spriteH: 48, boxW: 10, boxH: 42 };
  const WORLD = { tile: 50 };
  const GAME_WIDTH = 1920;
  const GAME_HEIGHT = 1080;
  const ATLAS_KEY = 'game-atlas';

  function gameDrawSize(def) {
    if (def.id.startsWith('player_')) {
      return { w: PLAYER.spriteW, h: PLAYER.spriteH };
    }
    if (def.id === 'tile_floor') {
      return { w: WORLD.tile, h: WORLD.tile };
    }
    return { w: def.originalW, h: def.originalH };
  }

  const rows = defs
    .map((def) => {
      const tex = textureSize(def);
      const draw = gameDrawSize(def);
      const kind = def.final ? 'final' : 'placeholder';
      return `| \`${def.id}\` | \`${def.sourceFile}\` | ${def.originalW}×${def.originalH} | ${tex.w}×${tex.h} (${kind}) | ${draw.w}×${draw.h} | (${def.pivot.x}, ${def.pivot.y}) | ${def.role} |`;
    })
    .join('\n');

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
| Placeholder upscale | **${placeholderScale}×** nearest-neighbor from reference PNGs |
| Player final scale | **${playerScale}×** Flash original size (committed under \`art/player/\`) |
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
| Idle / stand | \`player_idle\` | frame 1 |
| Duck | \`player_duck\` | frame 2 |
| Jump | \`player_jump\` | frame 3 |
| Walk | \`player_step1\`, \`player_step2\` | frame 4 (nested cycle) |
| Double-jump | \`player_jump2\` | frame 5 |
| Hurt | \`player_hurt\` | i-frame / hit flash pose |
| Death | \`player_death\` | \`guyBurned\` swap |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
${rows}

## Adding a new sprite

1. **Placeholder (until #34):** drop the reference PNG into
   \`reference/ha2-source/gfx/\` (gitignored — pull from
   [iopred/heliattack](https://github.com/iopred/heliattack) \`ha2/assets\`).
2. **Final player:** add / regenerate under \`art/player/\` via
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

- \`art/player/player_*.png\` (final player sources)
- \`public/atlas/game-atlas.png\`
- \`public/atlas/game-atlas.json\`
- \`docs/ART-SPEC.md\` (this file)
`;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const packInputs = [];

  for (const def of SPRITE_DEFS) {
    const tex = textureSize(def);
    const staged = join(stagingDir, `${def.id}.png`);

    if (def.final) {
      const src = join(playerFinalDir, def.sourceFile);
      if (!existsSync(src)) {
        console.error(
          `Missing final player sprite: ${src}\nRun: npm run art:player`,
        );
        process.exit(1);
      }
      const measured = identifySize(src);
      if (measured.w !== tex.w || measured.h !== tex.h) {
        console.error(
          `Size mismatch for final ${def.sourceFile}: file ${measured.w}×${measured.h}, expected ${tex.w}×${tex.h}`,
        );
        process.exit(1);
      }
      console.log(`final ${def.id} ${tex.w}×${tex.h}`);
      copyFileSync(src, staged);
    } else {
      if (!existsSync(gfxDir)) {
        console.error(
          `Missing ${gfxDir}\nPull PNGs from iopred/heliattack (ha2/assets) first.`,
        );
        process.exit(1);
      }
      const src = join(gfxDir, def.sourceFile);
      if (!existsSync(src)) {
        console.error(`Missing source sprite: ${src}`);
        process.exit(1);
      }
      const measured = identifySize(src);
      if (measured.w !== def.originalW || measured.h !== def.originalH) {
        console.error(
          `Size mismatch for ${def.sourceFile}: file ${measured.w}×${measured.h}, catalog ${def.originalW}×${def.originalH}`,
        );
        process.exit(1);
      }
      console.log(
        `upscale ${def.id} ${def.originalW}×${def.originalH} → ${tex.w}×${tex.h}`,
      );
      run('convert', [
        src,
        '-filter',
        'point',
        '-resize',
        `${tex.w}x${tex.h}`,
        staged,
      ]);
    }

    packInputs.push({
      id: def.id,
      w: tex.w,
      h: tex.h,
      path: staged,
      pivot: def.pivot,
    });
  }

  const packed = packRects(
    packInputs.map(({ id, w, h }) => ({ id, w, h })),
    ATLAS_PADDING,
    ATLAS_MAX_SIZE,
  );

  console.log(
    `atlas canvas ${packed.width}×${packed.height}, ${packed.rects.length} frames`,
  );

  const atlasPng = join(outDir, 'game-atlas.png');
  const atlasJson = join(outDir, 'game-atlas.json');

  const args = ['-size', `${packed.width}x${packed.height}`, 'xc:none'];
  for (const rect of packed.rects) {
    const input = packInputs.find((p) => p.id === rect.id);
    args.push(input.path, '-geometry', `+${rect.x}+${rect.y}`, '-composite');
  }
  args.push(atlasPng);
  run('convert', args);

  const frames = {};
  for (const rect of packed.rects) {
    const def = SPRITE_DEFS.find((s) => s.id === rect.id);
    frames[rect.id] = {
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: rect.w, h: rect.h },
      sourceSize: { w: rect.w, h: rect.h },
      pivot: { ...def.pivot },
    };
  }

  const json = {
    frames,
    meta: {
      app: 'heli-attack-2/scripts/art/pack-atlas.mjs',
      version: '1.1',
      image: 'game-atlas.png',
      format: 'RGBA8888',
      size: { w: packed.width, h: packed.height },
      scale: '1',
    },
  };
  writeFileSync(atlasJson, JSON.stringify(json, null, 2) + '\n');

  writeFileSync(
    artSpecPath,
    renderArtSpecMarkdown(SPRITE_DEFS, PLACEHOLDER_SCALE, PLAYER_FINAL_SCALE),
  );
  console.log('wrote ART-SPEC.md');

  rmSync(stagingDir, { recursive: true, force: true });

  console.log(`Done → ${atlasPng}`);
  console.log(`Done → ${atlasJson}`);
  console.log(`Done → ${artSpecPath}`);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
