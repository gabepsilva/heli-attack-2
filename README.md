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
| Language | **TypeScript** (strict) | Type safety for lots of interacting game state |
| Engine | **Phaser 3** | 2D WebGL renderer, Arcade physics, input, audio, responsive scaling — built for exactly this genre |
| Bundler | **Vite** | Instant HMR, one-command production build |
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

📋 **Planning complete.** All 42 implementation tickets are tracked as
[GitHub issues](https://github.com/gabepsilva/heli-attack-2/issues) across
milestones M0–M11. First implementation milestone is **M0 (project scaffold)** —
start with [#1](https://github.com/gabepsilva/heli-attack-2/issues/1).

## Getting started (once M0 lands)

```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # production web build
```
