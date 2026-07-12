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
 * The sprite catalog, the shelf packer and the ART-SPEC renderer all live in
 * src/ and are loaded here through Vite's SSR loader. This script owns *only*
 * file I/O and ImageMagick; it deliberately keeps no copy of the sprite data.
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
import { createServer } from 'vite';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outDir = join(root, 'public/atlas');
const publicArtDir = join(root, 'public/art');
const stagingDir = join(outDir, '.staging');
const artSpecPath = join(root, 'docs/ART-SPEC.md');

/** Load the real src/ modules — the TS catalog is the single source of truth. */
async function loadArtModules() {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const [catalog, packLayout, artSpec, artConfig] = await Promise.all([
      server.ssrLoadModule('/src/art/catalog.ts'),
      server.ssrLoadModule('/src/art/packLayout.ts'),
      server.ssrLoadModule('/src/art/artSpec.ts'),
      server.ssrLoadModule('/src/config/art.ts'),
    ]);
    return {
      SPRITE_DEFS: catalog.SPRITE_DEFS,
      textureSize: catalog.textureSize,
      finalSourcePath: catalog.finalSourcePath,
      packRects: packLayout.packRects,
      renderArtSpecMarkdown: artSpec.renderArtSpecMarkdown,
      ATLAS_PADDING: artConfig.ATLAS_PADDING,
      ATLAS_MAX_SIZE: artConfig.ATLAS_MAX_SIZE,
      worldScale: artConfig.ART_WORLD_FINAL_SCALE,
      bgW: artConfig.BG_ORIGINAL_W,
      bgH: artConfig.BG_ORIGINAL_H,
    };
  } finally {
    await server.close();
  }
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

function die(message) {
  console.error(message);
  process.exit(1);
}

/** Copy a source PNG into staging, failing loudly if it is missing or mis-sized. */
function stageSource(src, staged, expected, label) {
  if (!existsSync(src)) {
    die(`Missing ${label}: ${src}\nRun: npm run art:import-original`);
  }
  const measured = identifySize(src);
  if (measured.w !== expected.w || measured.h !== expected.h) {
    die(
      `Size mismatch for ${label} ${src}: file ${measured.w}×${measured.h}, expected ${expected.w}×${expected.h}`,
    );
  }
  copyFileSync(src, staged);
}

async function main() {
  const art = await loadArtModules();

  mkdirSync(outDir, { recursive: true });
  mkdirSync(publicArtDir, { recursive: true });
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const staged = new Map();
  const defsById = new Map(art.SPRITE_DEFS.map((d) => [d.id, d]));

  for (const def of art.SPRITE_DEFS) {
    const tex = art.textureSize(def);
    const path = join(stagingDir, `${def.id}.png`);
    stageSource(
      join(root, art.finalSourcePath(def)),
      path,
      tex,
      'atlas source',
    );
    console.log(`final ${def.id} ${tex.w}×${tex.h}`);
    staged.set(def.id, { path, w: tex.w, h: tex.h });
  }

  const packed = art.packRects(
    [...staged].map(([id, { w, h }]) => ({ id, w, h })),
    art.ATLAS_PADDING,
    art.ATLAS_MAX_SIZE,
  );

  console.log(
    `atlas canvas ${packed.width}×${packed.height}, ${packed.rects.length} frames`,
  );

  const atlasPng = join(outDir, 'game-atlas.png');
  const atlasJson = join(outDir, 'game-atlas.json');

  const args = ['-size', `${packed.width}x${packed.height}`, 'xc:none'];
  for (const rect of packed.rects) {
    args.push(
      staged.get(rect.id).path,
      '-geometry',
      `+${rect.x}+${rect.y}`,
      '-composite',
    );
  }
  args.push(atlasPng);
  run('convert', args);

  const frames = {};
  for (const rect of packed.rects) {
    frames[rect.id] = {
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: rect.w, h: rect.h },
      sourceSize: { w: rect.w, h: rect.h },
      pivot: { ...defsById.get(rect.id).pivot },
    };
  }

  writeFileSync(
    atlasJson,
    JSON.stringify(
      {
        frames,
        meta: {
          app: 'heli-attack-2/scripts/art/pack-atlas.mjs',
          version: '1.2',
          image: 'game-atlas.png',
          format: 'RGBA8888',
          size: { w: packed.width, h: packed.height },
          scale: '1',
        },
      },
      null,
      2,
    ) + '\n',
  );

  // Stage plates (not packed) — Flash bg.png + title.png @ world scale.
  const plate = { w: art.bgW * art.worldScale, h: art.bgH * art.worldScale };
  for (const name of ['bg.png', 'title.png']) {
    const dst = join(publicArtDir, name);
    stageSource(join(root, 'art/world', name), dst, plate, 'stage plate');
    console.log(
      `${name.replace('.png', '')} ${plate.w}×${plate.h} → public/art/${name}`,
    );
  }

  writeFileSync(artSpecPath, art.renderArtSpecMarkdown());
  console.log('wrote ART-SPEC.md');

  rmSync(stagingDir, { recursive: true, force: true });

  for (const out of [
    atlasPng,
    atlasJson,
    join(publicArtDir, 'bg.png'),
    join(publicArtDir, 'title.png'),
    artSpecPath,
  ]) {
    console.log(`Done → ${out}`);
  }
}

await main();
