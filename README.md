# Heli Attack 2 — Modern Remake

A faithful, modernized recreation of **Heli Attack 2** (originally a Flash game by
[iopred](https://github.com/iopred/heliattack)) — same game, same feel, rebuilt
for the modern web at high resolution, playable on desktop and mobile, and
packageable for Steam.

> **Goal:** Preserve the *exact* gameplay feel of the original (physics, weapons,
> pacing) while replacing the dead Flash runtime and the low-resolution art with a
> modern, high-resolution, responsive implementation.

---

## Vision

- **Same game, modernized.** The mechanics, weapon balance, and movement feel are
  ported 1:1 from the original ActionScript — no re-balancing, no "reimagining."
- **High resolution canvas.** Designed at **1920×1080**, scaling responsively
  down to mobile (CrazyGames-style fit). Shipped sprites are temporarily the
  original Flash art (nearest-neighbor upscaled; #95) — hi-res redraws TBD.
- **Runs everywhere.** One codebase → web (browser), and wrapped for Steam desktop.
- **Instant load.** Stays a lightweight web game — no heavy runtime, no WASM blob.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript 7** (strict) | Type safety for lots of interacting game state; TS 6 kept alongside for `typescript-eslint` until that ships a TS 7 API |
| Engine | **Phaser 4** | 2D WebGL renderer, Arcade physics, input, audio, responsive scaling — built for exactly this genre |
| Bundler | **Vite 8** | Instant HMR, one-command production build (Rolldown) |
| Desktop | **Tauri** or **Electron** (later) | Wrap the web build for Steam |

Work is tracked as [GitHub issues](https://github.com/gabepsilva/heli-attack-2/issues)
(the source of truth for every ticket); [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md)
holds the principles, definition of done, deliberate cuts, and milestone map.
The performance pass (#37) report is [`docs/PERF_REPORT.md`](docs/PERF_REPORT.md).

## What we're porting vs. recreating

The original source gives us three things, with very different reuse value:

| Asset | Source status | Plan |
|---|---|---|
| **Physics / game logic** | ✅ Fully recovered, exact values | **Port 1:1** — see [`reference/spec/HELIATTACK2-SPEC.md`](reference/spec/HELIATTACK2-SPEC.md) |
| **Sounds** | ✅ 39 WAV files, complete | **Reuse** — transcode to web audio formats |
| **Graphics** | ⚠️ Authentic but ~24–212px (Flash-era) | **Temporary:** ship originals (#95) for Flash loyalty; **hi-res redraws TBD** |

The precise, hard-to-get-right parts (game feel + audio) are handed to us; the part
that *must* be new for a modern look (art) is the part we'd want to redo anyway.

## Repository layout

```
heli-attack-2/
├── README.md                     ← you are here
├── docs/
│   └── MIGRATION_PLAN.md         ← principles & milestone map (tickets = GitHub issues)
├── reference/                    ← distilled reference only (text, no binaries)
│   └── spec/
│       ├── HELIATTACK2-SPEC.md   ← reverse-engineered spec (weapons, physics, enemies)
│       └── heli2-decompiled-actionscript.txt  ← recovered original AS source
└── src/                          ← (created in M0) the new game
```

> **Reference binaries stay gitignored.** The original Flash `.fla` and raw
> `reference/ha2-source/` PNG/WAV trees are **not** committed. Canonical source:
> [github.com/iopred/heliattack](https://github.com/iopred/heliattack) (`ha2/`).
> #95 temporarily ships nearest-neighbor upscales of those PNGs under `art/` +
> `public/atlas/` for a loyal Flash look; hi-res redraws will replace them later.

## Licensing note ⚠️

The original code and assets in `reference/` are **GPL-3.0**. Two implications:

- **Game mechanics / numbers are facts** (not copyrightable) — porting weapon
  stats and physics values is fine and does not encumber our code.
- **Original art and sound are copyrighted** and GPL-licensed. Shipping the
  temporary Flash sprites (#95) and/or original sounds keeps the distributed
  build under GPL obligations. For a **closed-source / commercial Steam** build
  we must replace them with our own art (and audio we have rights to). Hi-res
  redraws remain the long-term plan.

## Status

🚧 **M0 foundation** — scaffold ([#1](https://github.com/gabepsilva/heli-attack-2/issues/1))
and local tooling ([#2](https://github.com/gabepsilva/heli-attack-2/issues/2)).
All 42 implementation tickets are tracked as
[GitHub issues](https://github.com/gabepsilva/heli-attack-2/issues) across
milestones M0–M11.

## License

Application code in this repository is **MIT** (see [`LICENSE`](LICENSE)).
Original Flash reference material under `reference/` remains **GPL-3.0**.
Temporary Flash sprites shipped under `art/` / `public/atlas/` (#95) are also
GPL-sourced — see the licensing note above. Hi-res redraws will replace them.

## Getting started

```bash
npm install
npm run dev       # Vite dev server with HMR (http://localhost:5173)
npm run build     # typecheck + production web build → dist/
npm run preview   # serve dist/ locally (http://localhost:4173)
npm run typecheck # strict TS check (src + vite.config.ts)
npm run lint      # ESLint (type-aware)
npm run format    # Prettier --write (format:check to verify only)
npm test          # Vitest (test:watch for watch mode)
npm run art:extract-tiles    # ground tileset ← original SWF (needs heli2.swf)
npm run art:import-original  # NN-upscale Flash originals → art/ (needs gfx/)
npm run art:pack   # pack atlas + ART-SPEC (needs ImageMagick)
npm run audio:transcode  # WAV → public/audio (.ogg/.webm/.mp3); needs ffmpeg
```

Packed atlas lives in `public/atlas/` (committed). Shipped art is **temporary
original Flash** (#95): player sources in `art/player/` (8×), world sources in
`art/world/` (4×), background copied to `public/art/bg.png` by the packer.
Pull iopred `ha2/assets` into `reference/ha2-source/gfx/` (gitignored) before
`art:import-original`. Hi-res redraws TBD. See [`docs/ART-SPEC.md`](docs/ART-SPEC.md).

The ground tileset is the exception: `ha2/assets` ships only the tile *fills*
(`Floor.png`, `FloorEdge.png`, …), while the game draws the composed `tiles`
MovieClip — grass caps, rocky end caps, bushes, and three mirrored frames. Grab
the original SWF once, then extract the ten frames:

```bash
curl -L -o reference/ha2-source/heli2.swf \
  https://github.com/iopred/heliattack/raw/main/ha2/heli2miniclip.%24wf
npm run art:extract-tiles   # → reference/ha2-source/gfx/tiles/tile_01..10.png
```

Web-ready SFX live in `public/audio/` (committed). Source WAVs stay gitignored under
`reference/ha2-source/wav/` — pull from [iopred/heliattack](https://github.com/iopred/heliattack)
`ha2/assets/helisounds` when regenerating, then run `npm run audio:transcode`.

`npm install` points git at [`.githooks/`](.githooks/) when `core.hooksPath` is
unset so commits run `lint` + `typecheck` locally (optional quality gate from #2).
Set `HELI_SKIP_GIT_HOOKS=1` to opt out; an existing custom `core.hooksPath` is
left unchanged.

CI runs typecheck, lint, format check, tests, and build on every PR.

`dist/` is a static site meant to be **served over HTTP** (e.g. `npm run preview`,
GitHub Pages, any static host). Opening `dist/index.html` via `file://` will not
work — browsers block ES module scripts under a null origin.
