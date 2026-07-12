#!/usr/bin/env node
/**
 * Pack Phaser hash atlas + write ART-SPEC.md + copy stage plates.
 *
 * - Player frames: committed PNGs under art/player/ (8× Flash size; #95 originals).
 * - World frames: committed PNGs under art/world/ (4× Flash size; #95 originals).
 * - Background: art/world/bg.png → public/art/bg.png (not packed).
 * - Title plate: art/world/title.png → public/art/title.png (not packed).
 *
 * Outputs (committed): public/atlas/game-atlas.{png,json}, public/art/bg.png,
 * public/art/title.png, docs/ART-SPEC.md
 *
 * Catalog numbers here must match src/art/catalog.ts — Vitest asserts parity.
 *
 * Usage: npm run art:pack
 * Requires: ImageMagick (`convert`, `identify`).
 * Regenerate sources: npm run art:import-original
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
const playerFinalDir = join(root, 'art/player');
const worldFinalDir = join(root, 'art/world');
const outDir = join(root, 'public/atlas');
const publicArtDir = join(root, 'public/art');
const stagingDir = join(outDir, '.staging');
const artSpecPath = join(root, 'docs/ART-SPEC.md');

export const PLACEHOLDER_SCALE = 4;
export const PLAYER_FINAL_SCALE = 8;
export const WORLD_FINAL_SCALE = 4;
export const ATLAS_PADDING = 2;
export const ATLAS_MAX_SIZE = 4096;

/** Mirrors src/art/catalog.ts SPRITE_DEFS — tests assert parity. */
export const SPRITE_DEFS = [
  {
    id: 'player_idle',
    sourceFile: 'player_idle.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player stand / idle (temp Flash guy.png)',
    final: true,
  },
  {
    id: 'player_duck',
    sourceFile: 'player_duck.png',
    originalW: 25,
    originalH: 39,
    pivot: { x: 0.5, y: 1 },
    role: 'Player duck (temp Flash duck.png)',
    final: true,
  },
  {
    id: 'player_jump',
    sourceFile: 'player_jump.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player jump (temp Flash jump.png)',
    final: true,
  },
  {
    id: 'player_jump2',
    sourceFile: 'player_jump2.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player double-jump (temp Flash jump2.png)',
    final: true,
  },
  {
    id: 'player_step1',
    sourceFile: 'player_step1.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 1 (temp Flash step1.png)',
    final: true,
  },
  {
    id: 'player_step2',
    sourceFile: 'player_step2.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 2 (temp Flash step2.png)',
    final: true,
  },
  {
    id: 'player_hurt',
    sourceFile: 'player_hurt.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player hurt flash (stub: reuse guy.png — no dedicated original)',
    final: true,
  },
  {
    id: 'player_death',
    sourceFile: 'player_death.png',
    originalW: 40,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player death (temp Flash guyburned.png)',
    final: true,
  },
  {
    id: 'heli',
    sourceFile: 'heli.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter look 0 / hover (temp Flash heli.png)',
    final: true,
  },
  {
    id: 'heli_strafe',
    sourceFile: 'heli_strafe.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter look 1 / strafe (stub: reuse heli.png)',
    final: true,
  },
  {
    id: 'heli_hit',
    sourceFile: 'heli_hit.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter damaged flash (temp Flash heli_hit.png)',
    final: true,
  },
  {
    id: 'heli_destroyed',
    sourceFile: 'heliDestroyed.png',
    originalW: 173,
    originalH: 89,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter wreck (temp Flash heliDestroyed.png)',
    final: true,
  },
  {
    id: 'shard',
    sourceFile: 'shard.png',
    originalW: 24,
    originalH: 19,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard0.png)',
    final: true,
  },
  {
    id: 'shard_1',
    sourceFile: 'shard_1.png',
    originalW: 17,
    originalH: 21,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard1.png)',
    final: true,
  },
  {
    id: 'shard_3',
    sourceFile: 'shard_3.png',
    originalW: 14,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard3.png)',
    final: true,
  },
  {
    id: 'shard_4',
    sourceFile: 'shard_4.png',
    originalW: 10,
    originalH: 24,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard4.png)',
    final: true,
  },
  {
    id: 'shard_5',
    sourceFile: 'shard_5.png',
    originalW: 10,
    originalH: 24,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard5.png)',
    final: true,
  },
  {
    id: 'enemy_guy',
    sourceFile: 'enemyguy.png',
    originalW: 25,
    originalH: 48,
    pivot: { x: 0.5, y: 1 },
    role: 'Heli door-gunner body (+ ground enemy) (temp Flash enemyguy.png)',
    final: true,
  },
  {
    id: 'bullet_player',
    sourceFile: 'bullett.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Player projectile (temp Flash bullett.png)',
    final: true,
  },
  {
    id: 'bullet_enemy',
    sourceFile: 'enemybullet.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy projectile (temp Flash enemybullet.png)',
    final: true,
  },
  {
    id: 'weapon_machinegun',
    sourceFile: 'machineGun.png',
    originalW: 29,
    originalH: 16,
    pivot: { x: 0.2, y: 0.5 },
    role: 'Starting machine gun (temp Flash machineGun.png)',
    final: true,
  },
  {
    id: 'muzzle_flash',
    sourceFile: 'muzzle_flash.png',
    originalW: 16,
    originalH: 16,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Weapon muzzle flash (generated stub — no Flash original)',
    final: true,
  },
  {
    id: 'grenade',
    sourceFile: 'grenade.png',
    originalW: 19,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Grenade projectile (temp Flash grenade.png)',
    final: true,
  },
  {
    id: 'rocket',
    sourceFile: 'Rocket.png',
    originalW: 21,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Rocket projectile (temp Flash Rocket.png)',
    final: true,
  },
  {
    id: 'shotgunrocketbullet',
    sourceFile: 'shotgunrocketbullet.png',
    originalW: 17,
    originalH: 12,
    pivot: { x: 0.5, y: 0.5 },
    role: 'ShotgunRockets projectile (Flash shotgunrocketbullet.png / bullet frame 7)',
    final: true,
  },
  {
    id: 'rpg',
    sourceFile: 'rpg.png',
    originalW: 22,
    originalH: 13,
    pivot: { x: 0.5, y: 0.5 },
    role: 'RPG projectile (Flash rpg.png / bullet frame 8)',
    final: true,
  },
  {
    id: 'seekerbullet',
    sourceFile: 'seekerbullet.png',
    originalW: 23,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Seeker projectile (Flash seekerbullet.png / bullet frame 5)',
    final: true,
  },
  {
    id: 'flame',
    sourceFile: 'flame.png',
    originalW: 42,
    originalH: 42,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FlameThrower projectile (Flash flame.png / bullet frame 3)',
    final: true,
  },
  {
    id: 'minebullet',
    sourceFile: 'minebullet.png',
    originalW: 20,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FireMines lobbed projectile (Flash minebullet.png / bullet frame 10)',
    final: true,
  },
  {
    id: 'mine',
    sourceFile: 'mine.png',
    originalW: 21,
    originalH: 19,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FireMines planted look (Flash mine.png)',
    final: true,
  },
  {
    id: 'abombbullet',
    sourceFile: 'abombbullet.png',
    originalW: 36,
    originalH: 29,
    pivot: { x: 0.5, y: 0.5 },
    role: 'A-Bomb projectile (Flash abombbullet.png / bullet frame 6)',
    final: true,
  },
  {
    id: 'rail',
    sourceFile: 'rail.png',
    originalW: 57,
    originalH: 31,
    pivot: { x: 0.5, y: 0.5 },
    role: 'RailGun / ShoulderCannon beam (Flash rail.png / bullet frames 9+11)',
    final: true,
  },
  {
    id: 'grapplebullet',
    sourceFile: 'grapplebullet.png',
    originalW: 21,
    originalH: 21,
    pivot: { x: 0.5, y: 0.5 },
    role: 'GrappleCannon projectile (Flash grapplebullet.png / bullet frame 12)',
    final: true,
  },
  {
    id: 'smoke',
    sourceFile: 'smoke.png',
    originalW: 28,
    originalH: 27,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Smoke VFX (temp Flash smoke.png)',
    final: true,
  },
  {
    id: 'blood',
    sourceFile: 'blood.png',
    originalW: 30,
    originalH: 30,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Hit / blood VFX (temp Flash blood.png)',
    final: true,
  },
  {
    id: 'explosion',
    sourceFile: 'explosion.png',
    originalW: 187,
    originalH: 186,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death explosion (temp Flash bigboom.png, half-res catalog)',
    final: true,
  },
  {
    id: 'powerup',
    sourceFile: 'powerup.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'State / mystery powerup crate (Flash powerup.png)',
    final: true,
  },
  {
    id: 'powerhealth',
    sourceFile: 'powerhealth.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Health crate (Flash powerhealth.png — white box + red cross)',
    final: true,
  },
  {
    id: 'powermachinegun',
    sourceFile: 'powermachinegun.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 0 MachineGun (Flash powermachinegun.png)',
    final: true,
  },
  {
    id: 'poweruzi',
    sourceFile: 'poweruzi.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 1 AkimboMac10 (Flash old/poweruzi.png)',
    final: true,
  },
  {
    id: 'powershotgun',
    sourceFile: 'powershotgun.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 2 Shotgun (Flash powershotgun.png)',
    final: true,
  },
  {
    id: 'powershotgunrocket',
    sourceFile: 'powershotgunrocket.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 3 ShotgunRockets (Flash powershotgunrocket.png)',
    final: true,
  },
  {
    id: 'powergen',
    sourceFile: 'powergen.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 4 GrenadeLauncher (Flash powergen.png)',
    final: true,
  },
  {
    id: 'powerrpg',
    sourceFile: 'powerrpg.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 5 RPG (Flash powerrpg.png)',
    final: true,
  },
  {
    id: 'powerrocketlauncher',
    sourceFile: 'powerrocketlauncher.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 6 RocketLauncher (Flash powerrocketlauncher.png)',
    final: true,
  },
  {
    id: 'powerseeker',
    sourceFile: 'powerseeker.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 7 SeekerLauncher (Flash powerseeker.png)',
    final: true,
  },
  {
    id: 'powerflamethrower',
    sourceFile: 'powerflamethrower.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 8 FlameThrower (Flash powerflamethrower.png)',
    final: true,
  },
  {
    id: 'powermine',
    sourceFile: 'powermine.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 9 FireMines (Flash powermine.png)',
    final: true,
  },
  {
    id: 'powerabomb',
    sourceFile: 'powerabomb.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 10 ABombLauncher (Flash powerabomb.png)',
    final: true,
  },
  {
    id: 'powerrail',
    sourceFile: 'powerrail.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 11 RailGun (Flash powerrail.png)',
    final: true,
  },
  {
    id: 'powergrapple',
    sourceFile: 'powergrapple.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 12 GrappleCannon (Flash powergrapple.png)',
    final: true,
  },
  {
    id: 'powershouldercannon',
    sourceFile: 'powershouldercannon.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 13 ShoulderCannon (Flash powershouldercannon.png)',
    final: true,
  },
  {
    id: 'tile_01',
    sourceFile: 'tile_01.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Ground surface — grass cap on exposed dirt',
    final: true,
  },
  {
    id: 'tile_02',
    sourceFile: 'tile_02.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Buried dirt — no grass (a tile sits on top)',
    final: true,
  },
  {
    id: 'tile_03',
    sourceFile: 'tile_03.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Left end cap — grass cap + rocky left edge',
    final: true,
  },
  {
    id: 'tile_04',
    sourceFile: 'tile_04.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Right end cap — grass cap + rocky right edge (mirrors tile_03)',
    final: true,
  },
  {
    id: 'tile_05',
    sourceFile: 'tile_05.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at the left side of a ledge base',
    final: true,
  },
  {
    id: 'tile_06',
    sourceFile: 'tile_06.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at the right side of a ledge base (mirrors tile_05)',
    final: true,
  },
  {
    id: 'tile_07',
    sourceFile: 'tile_07.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Rocky overhang corner — grass cap, open right edge + underside',
    final: true,
  },
  {
    id: 'tile_08',
    sourceFile: 'tile_08.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Rocky overhang corner — Flash frame 9, same art as tile_07',
    final: true,
  },
  {
    id: 'tile_09',
    sourceFile: 'tile_09.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Buried dirt variant (tileset frame 10; unused by map1)',
    final: true,
  },
  {
    id: 'tile_10',
    sourceFile: 'tile_10.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at a ledge base — Flash frame 11, same art as tile_06',
    final: true,
  },
  {
    id: 'bg_tile_01',
    sourceFile: 'bg_tile_01.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Background foliage — fern / bush crown',
    final: true,
  },
  {
    id: 'bg_tile_02',
    sourceFile: 'bg_tile_02.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Background foliage — palm trunk with fronds',
    final: true,
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

function isPlayer(def) {
  return def.id.startsWith('player_');
}

function textureSize(def) {
  const scale = isPlayer(def) ? PLAYER_FINAL_SCALE : WORLD_FINAL_SCALE;
  return { w: def.originalW * scale, h: def.originalH * scale };
}

function finalSourceDir(def) {
  return isPlayer(def) ? playerFinalDir : worldFinalDir;
}

/**
 * Mirrors src/art/artSpec.ts — Vitest asserts the TypeScript renderer produces
 * the same markdown as this function for the shared catalog.
 */
export function renderArtSpecMarkdown(
  defs,
  placeholderScale,
  playerScale,
  worldScale,
) {
  const PLAYER = { spriteW: 48, spriteH: 48, boxW: 10, boxH: 42 };
  const WORLD = { tile: 50 };
  const TILE_ART_SIZE = 52;
  const GAME_WIDTH = 1920;
  const GAME_HEIGHT = 1080;
  const ATLAS_KEY = 'game-atlas';

  function gameDrawSize(def) {
    if (def.id.startsWith('player_')) {
      return { w: PLAYER.spriteW, h: PLAYER.spriteH };
    }
    if (def.id.startsWith('tile_') || def.id.startsWith('bg_tile_')) {
      return { w: TILE_ART_SIZE, h: TILE_ART_SIZE };
    }
    if (def.id === 'explosion') {
      return { w: 120, h: 120 };
    }
    if (def.id === 'muzzle_flash') {
      return { w: 18, h: 18 };
    }
    return { w: def.originalW, h: def.originalH };
  }

  function texSize(def) {
    const scale = def.id.startsWith('player_') ? playerScale : worldScale;
    return { w: def.originalW * scale, h: def.originalH * scale };
  }

  const rows = defs
    .map((def) => {
      const tex = texSize(def);
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
| Tile size (collision grid) | **${WORLD.tile}×${WORLD.tile}** |
| Tile art | **${TILE_ART_SIZE}×${TILE_ART_SIZE}**, drawn at \`col × ${WORLD.tile} − 1\` (Flash \`drawMap\` 1px overlap) |
| Legacy placeholder upscale | **${placeholderScale}×** (retired after #34) |
| Player final scale | **${playerScale}×** Flash original size (committed under \`art/player/\`) |
| World final scale | **${worldScale}×** Flash original size (committed under \`art/world/\`) |
| Phaser atlas key | \`${ATLAS_KEY}\` |
| Background plate | \`public/art/bg.png\` (not packed; 452×322 @ ${worldScale}×) |
| Title plate | \`public/art/title.png\` (not packed; 452×322 @ ${worldScale}×) |

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
| Idle / stand | \`player_idle\` | frame 1 |
| Duck | \`player_duck\` | frame 2 |
| Jump | \`player_jump\` | frame 3 |
| Walk | \`player_step1\`, \`player_step2\` | frame 4 (nested cycle) |
| Double-jump | \`player_jump2\` | frame 5 |
| Hurt | \`player_hurt\` | i-frame / hit flash pose |
| Death | \`player_death\` | \`guyBurned\` swap |

## Heli look frames

| Look | Behavior | Frame id |
|---|---|---|
| 0 | hover | \`heli\` |
| 1 | strafe | \`heli_strafe\` |
| (hit) | damaged flash | \`heli_hit\` |

## Sprite table

| Frame id | Source file | Original (Flash) | Texture | Game draw size | Pivot | Role |
|---|---|---|---|---|---|---|
${rows}

## Adding a new sprite

1. **Source art:** import originals via \`npm run art:import-original\` (or drop
   PNGs under \`art/player/\` / \`art/world/\`), then set \`final: true\` on the catalog
   entry.
2. Append a \`SpriteDef\` to \`SPRITE_DEFS\` in \`src/art/catalog.ts\` with measured
   \`originalW\` / \`originalH\`, pivot, and role.
3. Mirror the entry in \`scripts/art/pack-atlas.mjs\`.
4. Run \`npm run art:pack\` — packs \`public/atlas/game-atlas.{png,json}\`,
   copies \`public/art/bg.png\` + \`public/art/title.png\`, and regenerates this file.
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

- \`art/player/player_*.png\` (player sources — temp Flash #95)
- \`art/world/*.png\` (world sources + bg / title plates — temp Flash #95)
- \`public/atlas/game-atlas.png\`
- \`public/atlas/game-atlas.json\`
- \`public/art/bg.png\`
- \`public/art/title.png\`
- \`docs/ART-SPEC.md\` (this file)
`;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(publicArtDir, { recursive: true });
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const packInputs = [];

  for (const def of SPRITE_DEFS) {
    const tex = textureSize(def);
    const staged = join(stagingDir, `${def.id}.png`);
    const srcDir = finalSourceDir(def);
    const src = join(srcDir, def.sourceFile);

    if (!existsSync(src)) {
      const regen = 'npm run art:import-original';
      console.error(`Missing atlas source sprite: ${src}\nRun: ${regen}`);
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
      version: '1.2',
      image: 'game-atlas.png',
      format: 'RGBA8888',
      size: { w: packed.width, h: packed.height },
      scale: '1',
    },
  };
  writeFileSync(atlasJson, JSON.stringify(json, null, 2) + '\n');

  // Stage plates (not packed) — Flash bg.png + title.png @ world scale.
  const stagePlateExpected = {
    w: 452 * WORLD_FINAL_SCALE,
    h: 322 * WORLD_FINAL_SCALE,
  };
  for (const name of ['bg.png', 'title.png']) {
    const src = join(worldFinalDir, name);
    const dst = join(publicArtDir, name);
    if (!existsSync(src)) {
      console.error(
        `Missing stage plate: ${src}\nRun: npm run art:import-original`,
      );
      process.exit(1);
    }
    const measured = identifySize(src);
    if (
      measured.w !== stagePlateExpected.w ||
      measured.h !== stagePlateExpected.h
    ) {
      console.error(
        `Size mismatch for ${name}: file ${measured.w}×${measured.h}, expected ${stagePlateExpected.w}×${stagePlateExpected.h}`,
      );
      process.exit(1);
    }
    copyFileSync(src, dst);
    console.log(
      `${name.replace('.png', '')} ${stagePlateExpected.w}×${stagePlateExpected.h} → public/art/${name}`,
    );
  }

  writeFileSync(
    artSpecPath,
    renderArtSpecMarkdown(
      SPRITE_DEFS,
      PLACEHOLDER_SCALE,
      PLAYER_FINAL_SCALE,
      WORLD_FINAL_SCALE,
    ),
  );
  console.log('wrote ART-SPEC.md');

  rmSync(stagingDir, { recursive: true, force: true });

  console.log(`Done → ${atlasPng}`);
  console.log(`Done → ${atlasJson}`);
  console.log(`Done → ${join(publicArtDir, 'bg.png')}`);
  console.log(`Done → ${join(publicArtDir, 'title.png')}`);
  console.log(`Done → ${artSpecPath}`);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
