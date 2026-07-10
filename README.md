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
- **High resolution.** Designed at **1920×1080**, scaling responsively down to
  mobile (CrazyGames-style fit), with crisp hi-res art (the original sprites were
  ~24px tall — reference only, not shipped).
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

## What we're porting vs. recreating

The original source gives us three things, with very different reuse value:

| Asset | Source status | Plan |
|---|---|---|
| **Physics / game logic** | ✅ Fully recovered, exact values | **Port 1:1** — see [`reference/spec/HELIATTACK2-SPEC.md`](reference/spec/HELIATTACK2-SPEC.md) |
| **Sounds** | ✅ 39 WAV files, complete | **Reuse** — transcode to web audio formats |
| **Graphics** | ⚠️ Authentic but ~24–212px (Flash-era) | **Recreate at hi-res** — originals are the *art bible*, not shipped assets |

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

> **No binary originals in this repo.** The original Flash `.fla` files and the
> PNG/WAV assets are **not** committed (they're large and GPL-licensed). The
> canonical source lives upstream at
> [github.com/iopred/heliattack](https://github.com/iopred/heliattack) (`ha2/`).
> Pull assets from there when a ticket needs them; keep them out of this repo.

## Licensing note ⚠️

The original code and assets in `reference/` are **GPL-3.0**. Two implications:

- **Game mechanics / numbers are facts** (not copyrightable) — porting weapon
  stats and physics values is fine and does not encumber our code.
- **Original art and sound are copyrighted** and GPL-licensed. If we ever want to
  ship **closed-source / commercially on Steam**, we must ship **our own art** and
  either **our own audio** or audio we have rights to — hence the "recreate art"
  plan. Reusing the original sounds keeps us GPL; that's a decision to lock before
  release. Nothing in `reference/` should be bundled into a distributed build.

## Status

🚧 **M0 scaffold in progress** ([#1](https://github.com/gabepsilva/heli-attack-2/issues/1)).
All 42 implementation tickets are tracked as
[GitHub issues](https://github.com/gabepsilva/heli-attack-2/issues) across
milestones M0–M11.

## Getting started

```bash
npm install
npm run dev       # Vite dev server with HMR (http://localhost:5173)
npm run build     # typecheck + production web build → dist/
npm run preview   # serve dist/ locally (http://localhost:4173)
npm run typecheck # strict TypeScript check
npm run lint      # ESLint (type-aware)
npm run format    # Prettier --write (format:check to verify only)
npm test          # Vitest (test:watch for watch mode)
npm run audio:transcode  # WAV → public/audio (.ogg/.webm/.mp3); needs ffmpeg
```

Web-ready SFX live in `public/audio/` (committed). Source WAVs stay gitignored under
`reference/ha2-source/wav/` — pull from [iopred/heliattack](https://github.com/iopred/heliattack)
`ha2/assets/helisounds` when regenerating, then run `npm run audio:transcode`.

CI runs typecheck, lint, format check, tests, and build on every PR.

`dist/` is a static site meant to be **served over HTTP** (e.g. `npm run preview`,
GitHub Pages, any static host). Opening `dist/index.html` via `file://` will not
work — browsers block ES module scripts under a null origin.
