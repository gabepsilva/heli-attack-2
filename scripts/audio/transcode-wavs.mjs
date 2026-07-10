#!/usr/bin/env node
/**
 * Transcode reference WAVs → web-ready .ogg / .webm / .mp3 under public/audio/.
 *
 * Source WAVs live in reference/ha2-source/wav/ (gitignored — pull from
 * iopred/heliattack ha2/assets when regenerating). Committed outputs in
 * public/audio/ are what the runtime and CI use.
 *
 * Usage: node scripts/audio/transcode-wavs.mjs
 * Requires: ffmpeg with libvorbis, libopus, libmp3lame.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const wavDir = join(root, 'reference/ha2-source/wav');
const outDir = join(root, 'public/audio');

if (!existsSync(wavDir)) {
  console.error(
    `Missing ${wavDir}\nPull WAVs from iopred/heliattack (ha2/assets/helisounds) first.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const wavs = readdirSync(wavDir).filter((f) =>
  f.toLowerCase().endsWith('.wav'),
);
if (wavs.length === 0) {
  console.error(`No .wav files in ${wavDir}`);
  process.exit(1);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status})`);
  }
}

for (const file of wavs) {
  const id = basename(file, '.wav');
  const input = join(wavDir, file);
  const ogg = join(outDir, `${id}.ogg`);
  const webm = join(outDir, `${id}.webm`);
  const mp3 = join(outDir, `${id}.mp3`);

  console.log(`transcoding ${id}…`);
  run('ffmpeg', ['-y', '-i', input, '-c:a', 'libvorbis', '-q:a', '4', ogg]);
  run('ffmpeg', ['-y', '-i', input, '-c:a', 'libopus', '-b:a', '96k', webm]);
  run('ffmpeg', ['-y', '-i', input, '-c:a', 'libmp3lame', '-q:a', '4', mp3]);
}

console.log(`Done: ${wavs.length} sounds → ${outDir} (.ogg / .webm / .mp3)`);
