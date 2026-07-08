# Heli Attack 2 — Tickets

All 41 tickets, ready to become GitHub issues. Each has a **tangible deliverable** —
a concrete, demonstrable artifact you can point at when it's done (a running demo
behavior, a committed file, a measurable result). If you can't demo it, it's not done.

**Legend:** 🎯 Deliverable (the tangible thing) · ✅ Acceptance (how to verify) ·
🔗 Depends on · 🏷️ Labels

Ticket sizing: each is ~0.5–2 days. Reference values come from
[`reference/spec/HELIATTACK2-SPEC.md`](../reference/spec/HELIATTACK2-SPEC.md).

---

## Milestone M0 — Foundation & Tooling

### #1 · Scaffold Vite + TypeScript + Phaser project
Stand up the project skeleton: a Vite + strict-TypeScript app with Phaser 3
installed and a single `BootScene` that clears to a background color and renders the
title text at the 1920×1080 design resolution.

- 🎯 **Deliverable:** A running app — `npm run dev` opens a browser window showing a
  "Heli Attack 2" boot screen; `npm run build` emits a working static `dist/`.
- ✅ Boot scene renders with no console errors; production build runs when opened from `dist/`.
- 🔗 —
- 🏷️ `milestone:M0` `type:infra`

### #2 · Dev tooling & repo hygiene
Wire up the local quality gate (no CI — static, solo, zero-backend project). ESLint +
Prettier + strict `tsconfig`, `.gitignore`/`.editorconfig`/`LICENSE`, and npm scripts.
Optionally a pre-commit hook running lint + typecheck.

- 🎯 **Deliverable:** `package.json` with working `dev`/`build`/`lint`/`typecheck`
  scripts + committed config files; a clean checkout passes all of them.
- ✅ `npm run lint` and `npm run typecheck` pass; a deliberately introduced type error
  is caught by `typecheck`.
- 🔗 #1
- 🏷️ `milestone:M0` `type:infra`

### #3 · Fixed-timestep game loop & scene skeleton
The original ran at ~30fps and every spec value is per-frame, so simulation must be
frame-rate-independent. Build a 30 Hz fixed-update accumulator decoupled from render,
a `GameScene` stub, and a central `config/constants.ts` seeded with world constants.

- 🎯 **Deliverable:** A `GameScene` with an on-screen counter proving the sim ticks a
  steady 30×/sec regardless of monitor refresh rate; `config/constants.ts` committed.
- ✅ Sim rate reads ~30/s on both a 60Hz and 144Hz display; scene switching works.
- ⏱️ **Time-scale from day one:** expose a per-frame `timeStep` multiplier (default 1)
  that all entity updates apply to their motion. The TimeRift powerup (#22) slows the
  world by lowering it while the player stays at 1 — retrofitting this later is painful,
  so bake it into the loop now. (See spec §Powerups note.)
- 🔗 #1
- 🏷️ `milestone:M0` `type:feature` `area:physics`

---

## Milestone M1 — Core Movement & Feel ⭐

### #4 · Tile arena & AABB collision grid
A static, hand-authored test level built from 50px solid tiles, plus the AABB
tile-collision helper (the `hitCheck`/tile-resolve logic from the original), and a
debug box that obeys it.

- 🎯 **Deliverable:** A playable test arena (floor, walls, a floating platform, a pit)
  where a draggable/droppable debug box collides correctly against all tiles.
- ✅ The box rests on floors, is blocked by walls, and can't tunnel through tiles at speed.
- 🔗 #3 · 🏷️ `milestone:M1` `type:feature` `area:physics`

### #5 · Player horizontal movement & friction
The player entity with ground movement matching the original: +1/frame acceleration,
±5 input cap, ±6 hard cap, and −1/frame friction decay when no key is held.

- 🎯 **Deliverable:** A controllable player in the arena that walks left/right with the
  original's accel/cap/friction curve.
- ✅ Debug overlay shows speed ramping to the cap and decaying to 0 on release; values
  match the spec.
- 🔗 #4 · 🏷️ `milestone:M1` `type:feature` `area:physics`

### #6 · Gravity, ground detection & variable-height jump
Add gravity (+1/frame², terminal-clamped at 50), reliable ground detection that
resets the jump, and a variable-height jump (`yspeed = min(yspeed,-8)` with the
6-frame hold window).

- 🎯 **Deliverable:** A player that jumps — tap for a short hop, hold for full height —
  and lands cleanly on platforms.
- ✅ Short vs full jump heights are visibly different; terminal velocity caps a long fall.
- 🦆 **Ducking (↓ / `duckKey`):** holding down shrinks the hitbox to 2/3 W&H
  (10×42 → ~6.7×28), blocks walking (accel runs only when `!duck`), and blocks the
  double-jump (`!jump2 && !duck`); releasing while grounded nudges `_y` back up.
  Placed here because it needs both movement (#5) and the jump to exist. (Spec §Duck;
  art comes in #33.) — ✅ crouch shrinks the box, can't walk or double-jump while held.
- 🔗 #5 · 🏷️ `milestone:M1` `type:feature` `area:physics`

### #7 · Double jump & charged hyper-jump
The signature air mobility: a second mid-air jump, plus a boost/hyper-jump that
charges over 150 frames and fires a −32 vertical burst on the boost key.

- 🎯 **Deliverable:** A player that can double-jump and perform a charged hyper-jump,
  with the charge state exposed for a future HUD meter.
- ✅ Can double-jump but not triple-jump; boost only fires when charged and refills over ~5s.
- 🔗 #6 · 🏷️ `milestone:M1` `type:feature` `area:physics`

### #8 · Debug overlay & physics tuning harness
A toggleable overlay showing live velocity/state/charge/sim-fps, plus live-editable
physics constants (in-page controls or query params) so the feel can be tuned without
recompiling. Built once here so later milestones inherit it.

- 🎯 **Deliverable:** An on-screen debug panel that displays live player state and lets
  you tweak gravity/jump/speed constants and immediately feel the change.
- ✅ Editing a constant changes behavior with no reload; the overlay toggles off for clean demos.
- 🔗 #7 · 🏷️ `milestone:M1` `type:infra` `area:physics`

> **M1 exit demo:** someone who remembers Heli Attack 2 plays the arena and says "yes, that's the movement."

---

## Milestone M2 — Combat Core

### #9 · Mouse aiming & gun rotation
A gun that pivots on the player and rotates to point at the mouse cursor through a
full 360°, with a computed muzzle position and correct facing flip.

- 🎯 **Deliverable:** A player holding a gun that visibly tracks the cursor, with the
  muzzle tip correctly positioned at the barrel end.
- ✅ Gun aims accurately all the way around; muzzle point sits at the barrel for any angle.
- 🔗 #8 · 🏷️ `milestone:M2` `type:feature` `area:combat`

### #10 · Bullet system with object pooling
A generic, pooled projectile (velocity, speed, damage, lifetime) that travels, expires,
and culls off-screen — with zero per-shot garbage allocation.

- 🎯 **Deliverable:** Clicking spawns pooled bullets that fly from the muzzle and
  disappear off-screen/after their lifetime; a counter shows the pool being reused.
- ✅ Firing hundreds of bullets holds 60fps; the pool reuses instances (asserted, not growing).
- 🔗 #9 · 🏷️ `milestone:M2` `type:feature` `area:combat`

### #11 · MachineGun: real fire & reload model
The reload-counter firing model (fire when `reloadtime >= gun.reloadtime`, reset,
consume ammo) driving the MachineGun with its exact stats (reload 5, speed 8, damage
10, infinite ammo).

- 🎯 **Deliverable:** A held-fire MachineGun that auto-repeats at the original's exact cadence.
- ✅ Measured fire rate matches spec at 30fps sim; holding fire streams bullets at the reload rate.
- 🔗 #10 · 🏷️ `milestone:M2` `type:feature` `area:combat`

### #12 · Helicopter enemy entity
A helicopter that spawns from a screen edge, hovers/drifts, has 300 HP, registers
bullet hits, and dies (removal + placeholder explosion).

- 🎯 **Deliverable:** A heli in the arena you can shoot down — it takes hits and is
  destroyed after enough damage.
- ✅ Absorbs exactly 30 MachineGun hits (300/10) then dies; hit registration is pixel-accurate.
- 🔗 #11 · 🏷️ `milestone:M2` `type:feature` `area:combat`

### #13 · Damage, score & hit feedback
Close the loop: score increments by damage dealt, helis flash on hit, a placeholder
death explosion plays, and a temporary score readout shows on screen.

- 🎯 **Deliverable:** A full mini-loop — shoot heli → it flashes and takes damage →
  dies with an explosion → score visibly rises.
- ✅ Score increases per hit; a kill is unmistakable visually.
- 🔗 #12 · 🏷️ `milestone:M2` `type:feature` `area:combat`

> **M2 exit demo:** the vertical slice — "move, aim, shoot heli, heli dies, score up" — is genuinely fun.

---

## Milestone M3 — Full Arsenal

### #14 · Weapon data table & switching system
Port the full 14-weapon data table and build a data-driven inventory: owned weapons
with per-weapon ammo and reload state, switchable via number keys and next/prev.

- 🎯 **Deliverable:** A committed `config/weapons.ts` with all 14 weapons, plus in-game
  weapon switching between (initially test-granted) weapons.
- ✅ Cycling changes the active weapon; each tracks its own ammo/reload; switching is instant.
- 🔗 #13 · 🏷️ `milestone:M3` `type:feature` `area:combat`

### #15 · Projectile weapons
Implement the ballistic set with real stats and distinct behaviors: Akimbo Mac-10's
(weapon #1 — twin-stream MachineGun clone, reload 4/speed 8/damage 9), Shotgun
(multi-pellet spread), ShotgunRockets, GrenadeLauncher (fast), RPG (slow),
RocketLauncher.

- 🎯 **Deliverable:** Six selectable, working weapons that each visibly differ in
  spread, projectile speed, and damage.
- ✅ Each weapon's reload/speed/damage matches the spec table; Akimbo out-fires the
  MachineGun, shotgun fires a spread, RPG is visibly slow.
- 🔗 #14 · 🏷️ `milestone:M3` `type:feature` `area:combat`

### #16 · Special-behavior weapons
The mechanically unique weapons: FlameThrower (hold-to-fire continuous DoT), FireMines
(lobbed, persistent), RailGun (near-instant fast shot), SeekerLauncher (homing).

- 🎯 **Deliverable:** Four working special weapons demonstrating continuous damage,
  persistent mines, hitscan-speed, and homing.
- ✅ Flamethrower damages while held; seeker curves toward the nearest heli; railgun
  crosses screen near-instantly — values per spec.
- 🔗 #15 · 🏷️ `milestone:M3` `type:feature` `area:combat`

### #17 · Heavy / signature weapons
The big-payoff trio: A-Bomb Launcher (one-shot huge AoE + long cooldown), GrappleCannon
(damage plus grapple/pull mobility), ShoulderCannon.

- 🎯 **Deliverable:** Three working heavy weapons — the A-Bomb clears helis in a blast;
  the grapple both damages and pulls the player.
- ✅ A-Bomb one-shots a heli with a large blast + long reload; grapple demonstrably moves the player.
- 🔗 #16 · 🏷️ `milestone:M3` `type:feature` `area:combat`

---

## Milestone M4 — Enemy Behavior & Spawning

### #18 · Enemy fire & player health
Helis shoot back (aimed bullets, speed 7, ±5° spread) and the player has 100 health,
takes damage on hit with brief invulnerability frames, and can die.

- 🎯 **Deliverable:** A two-way firefight — standing under a heli drains the player's
  health bar to a death state.
- ✅ Player takes damage from heli bullets; i-frames prevent instant death; spread matches spec.
- 🔗 #13 · 🏷️ `milestone:M4` `type:feature` `area:combat`

### #19 · Replacement spawn treadmill & difficulty ramp
The defining pressure: when a heli dies, a replacement spawns, and concurrent heli
count ramps over time/kills, spawning from edges and top.

- 🎯 **Deliverable:** A continuous session where the sky is never empty and pressure
  escalates the longer you survive.
- ✅ Heli population never hits zero mid-game; concurrent count measurably grows with kills.
- 🔗 #18 · 🏷️ `milestone:M4` `type:feature` `area:combat`

### #20 · Heli variants & behavior polish
Add variety (the original used multiple heli frames): 2+ distinct heli looks/behaviors
(e.g. strafing vs hovering), varied approach paths, and reposition timers.

- 🎯 **Deliverable:** A session showing at least two visibly different heli behaviors on screen.
- ✅ Two behavior types are distinguishable in play; helis reposition rather than sitting still.
- 🔗 #19 · 🏷️ `milestone:M4` `type:feature` `area:combat`

### #41 · Recreate the original level layout
The #4 arena is a throwaway *test* level; nothing yet rebuilds the **actual** Heli
Attack 2 playfield. Port the original map's ground/platform/wall layout as tile-map
data on the 50px grid so the shipped game plays on the real level, using placeholder
tiles until #34 swaps in final environment art.

- 🎯 **Deliverable:** A committed level/map data file reproducing the original's layout,
  loaded by `GameScene` with real collision — replacing the test arena in the main game.
- ✅ The real level (not the test arena) loads in-game; layout matches the original's
  proportions; movement and combat play correctly on it.
- 🔗 #4 (tiles/collision); feeds #34 (environment art)
- 🏷️ `milestone:M4` `type:feature` `area:physics`

---

## Milestone M5 — Powerups

### #21 · Powerup drop & pickup system
Kills drop pickups: health on doubling kill-thresholds (1, 2, 4, 8…) and weapon/ammo
at ~3% per kill, falling on parachutes and collected on touch.

- 🎯 **Deliverable:** Parachuting powerups that spawn from kills and are collected by
  walking into them.
- ✅ Health drops on threshold kills; weapon drops appear ~3% over many kills; touch collects.
- 🔗 #19 · 🏷️ `milestone:M5` `type:feature` `area:combat`

### #22 · Powerup effects
The **five** timed state powerups (`powerupOn = 1 + random(5)`, each lasting 500
frames), plus the instant Health pickup:
1. **TriDamage** — all weapon damage ×3.
2. **Invulnerability** — player takes no damage.
3. **PredatorMode** — player invisible, forced onto the predator gun (infinite
   reload), weapon-switching disabled, enemies fire randomly (can't aim at you).
4. **TimeRift** — slow-mo: world `timeStep` lowered while the player stays at 1
   (relies on the time-scale factor baked into #3).
5. **Jetpack/Fly** — hold jump to rise (`yspeed = max(yspeed-2, -32)`).
- **Health** (instant): +20, cap 100.

- 🎯 **Deliverable:** All five state powerups + health working, each with a timer
  feeding the future HUD.
- ✅ TriDamage triples kill speed; invuln blocks damage; predator turns you invisible
  and locks weapon switching; TimeRift slows the world but not the player; jetpack
  enables free flight; all timed effects expire.
- 🔗 #21 · 🏷️ `milestone:M5` `type:feature` `area:combat`

---

## Milestone M6 — UI / HUD & Game States

### #23 · In-game HUD
Replace all temporary readouts with a real HUD: health bar, ammo/weapon indicator,
score, hyper-jump charge meter, and active-powerup indicator, anchored to the design
resolution.

- 🎯 **Deliverable:** A complete, styled HUD rendering all live game values at 1080p.
- ✅ Every element updates correctly in real time and reads clearly at 1080p.
- 🔗 #22 · 🏷️ `milestone:M6` `type:feature` `area:ui`

### #24 · Game state flow (menu → play → game over)
A complete session loop: main menu (start), gameplay, pause, and a game-over screen
showing final score with restart — all via scene transitions.

- 🎯 **Deliverable:** A playable end-to-end loop from menu to death to restart, no page reload.
- ✅ Every transition works; game-over shows the correct final score; restart resets cleanly.
- 🔗 #23 · 🏷️ `milestone:M6` `type:feature` `area:ui`

### #25 · Score persistence & local high scores
Persist high scores in localStorage, show a high-score table on the menu/game-over
screens, and optionally track stats (helis killed, accuracy).

- 🎯 **Deliverable:** A high-score table that survives page reloads and updates when beaten.
- ✅ High score persists across reloads; a new record updates the stored table.
- 🔗 #24 · 🏷️ `milestone:M6` `type:feature` `area:ui`

---

## Milestone M7 — Audio

### #26 · Audio pipeline & manager
Turn the reference WAVs into web-ready audio and centralize playback: a build step
transcoding to `.ogg`/`.webm` (+mp3 fallback), and an `AudioManager` handling SFX
pooling, volume, mute, and the browser audio-unlock on first input.

- 🎯 **Deliverable:** Web-optimized audio files in the build + an `AudioManager`; a test
  SFX plays on click after unlock.
- ✅ Sound plays after user-gesture unlock; a **master volume control** attenuates all
  audio and mute silences everything; overlapping sounds don't clip.
- 🔗 #3 · 🏷️ `milestone:M7` `type:audio`

### #27 · Wire SFX & music to events
Map every game event to its original sound — each weapon's fire, explosions, player
hurt, hyper-jump, powerups — plus a looping background music track.

- 🎯 **Deliverable:** A fully-scored game where every action triggers its authentic
  original sound and music loops underneath.
- ✅ Each weapon/powerup/explosion/hurt fires the correct sound; music loops seamlessly.
- 🔗 #26, #22 · 🏷️ `milestone:M7` `type:audio`

---

## Milestone M8 — Responsive & Multi-Input

### #28 · Responsive scaling (desktop + fullscreen)
Make the game fill any desktop window and fullscreen without breaking layout, via the
Phaser Scale Manager (FIT first, evaluate RESIZE), centered, with a fullscreen button
and HUD anchoring that survives varied aspect ratios.

- 🎯 **Deliverable:** A game that correctly resizes with the window and enters/exits
  fullscreen with the HUD intact.
- ✅ Resizing and fullscreen keep the game centered and the HUD correctly positioned.
- 🔗 #23 · 🏷️ `milestone:M8` `type:feature` `area:input`

### #29 · Input abstraction layer
Decouple gameplay from input hardware: a "player intent" layer (move/aim/fire/jump/
boost/switch) that input sources feed, with keyboard/mouse refactored to feed it.

- 🎯 **Deliverable:** A committed input-intent module; all gameplay reads intent, not raw
  keys — and the game still fully plays on keyboard/mouse.
- ✅ No gameplay code reads keys directly; keyboard/mouse control is unchanged for the player.
- 📝 **Note:** the original stored rebindable keys in a SharedObject. **Key rebinding is
  deliberately out of scope** (see "Deliberate cuts" in the migration plan); the intent
  layer here must not preclude adding it later.
- 🔗 #24 · 🏷️ `milestone:M8` `type:infra` `area:input`

### #30 · Touch controls & orientation guard
Mobile play: a virtual joystick (move), aim/fire controls, jump/boost/switch buttons —
shown only on touch devices — plus a portrait "rotate your device" overlay.

- 🎯 **Deliverable:** The game fully playable on a phone in landscape, with a rotate
  prompt shown in portrait.
- ✅ A full session is completable via touch on a real phone; portrait shows the overlay.
- 🔗 #29 · 🏷️ `milestone:M8` `type:feature` `area:input`

### #31 · Gamepad support
Controller play (Steam-ready): map a gamepad through the intent layer (stick move/aim,
buttons for fire/jump/boost/switch) with hotplug detection.

- 🎯 **Deliverable:** The game fully playable with a connected controller.
- ✅ A controller plays a complete session; unplugging falls back to keyboard cleanly.
- 🔗 #29 · 🏷️ `milestone:M8` `type:feature` `area:input`

---

## Milestone M9 — Art Modernization

### #32 · Art pipeline & hi-res placeholders
A sprite/atlas workflow with stand-in art: texture-atlas packing in the build,
reference sprites AI-upscaled as *temporary* placeholders, and a documented art spec
(sizes, pivots, animation frames) derived from the originals.

- 🎯 **Deliverable:** The game rendering from a packed atlas at 1080p with placeholder
  art, plus an `ART-SPEC.md` documenting every sprite's dimensions and pivots.
- ✅ Scene renders via atlas; adding a new sprite follows the documented, working process.
- 🔗 #1 · 🏷️ `milestone:M9` `type:art`

### #33 · Hi-res player art & animations
The final crisp player: redrawn 1080p-native idle, run, jump, double-jump, duck, hurt,
and death animations, wired to the existing player states in the original's style.

- 🎯 **Deliverable:** A player rendered with final hi-res animations that switch
  correctly per state.
- ✅ All player animations are crisp at 1080p and match the correct state; no placeholder player remains.
- 🔗 #32 · 🏷️ `milestone:M9` `type:art`

### #34 · Hi-res helis, weapons, effects & environment
Replace every remaining placeholder: redrawn helis (+variants), weapon sprites/muzzle
flashes, projectiles, explosions, powerups, background, and tiles — all hi-res, style-consistent.

- 🎯 **Deliverable:** A build with zero placeholder art — every on-screen element is
  final hi-res.
- ✅ No placeholders remain; the whole scene is crisp at 1080p and stylistically consistent.
- 🔗 #33, #20 · 🏷️ `milestone:M9` `type:art`

---

## Milestone M10 — Juice & Polish

### #35 · Particles & explosions
Satisfying impact via pooled Phaser emitters: hi-res explosions, bullet impacts, smoke,
debris/shells, and muzzle flashes.

- 🎯 **Deliverable:** Kills and impacts spawn distinct hi-res particle effects.
- ✅ Impacts/kills produce clear particle FX; 60fps holds under heavy simultaneous load.
- 🔗 #34 · 🏷️ `milestone:M10` `type:feature`

### #36 · Camera feel: screen shake & hit flashes
Game-feel juice: tunable screen shake on explosions/big hits, hit-stop/flash, subtle
camera follow/lead, and a damage vignette.

- 🎯 **Deliverable:** Big weapons and hits produce proportional screen shake and hit
  flashes, with an intensity toggle.
- ✅ Shake scales with weapon size and feels good, not nauseating; effects can be toggled.
- 🔗 #35 · 🏷️ `milestone:M10` `type:feature`

### #37 · Performance pass
Make it smooth on mid-range mobile: audit pooling (bullets/particles/enemies), atlas
draw-call batching, GC profiling, and a mobile frame budget, with a perf HUD.

- 🎯 **Deliverable:** A measured performance report + a perf HUD, hitting the frame targets.
- ✅ Sustained 60fps on desktop and ≥30fps on a mid-range phone under peak load (measured/logged).
- 🔗 #36, #30 · 🏷️ `milestone:M10` `type:infra`

---

## Milestone M11 — Shipping

### #38 · Web build & deploy
Make it publicly playable in a browser: production build tuning (asset compression,
caching), a manual static deploy to a host (itch.io / own page), and CrazyGames SDK
integration if targeting them. No pipeline — a manual static upload.

- 🎯 **Deliverable:** A public URL where anyone can play the game in their browser.
- ✅ The game loads and plays from the public URL on both desktop and mobile browsers.
- 🔗 #37 · 🏷️ `milestone:M11` `type:infra`

### #39 · Steam desktop wrapper
A runnable Steam build: wrap the web build in Tauri (or Electron) for Win/Mac/Linux,
with native fullscreen, working controller, and app icon/metadata.

- 🎯 **Deliverable:** Downloadable desktop executables for all three OSes that launch
  and play fullscreen with a gamepad.
- ✅ Each OS build launches, runs fullscreen, and is fully gamepad-playable.
- 🔗 #38, #31 · 🏷️ `milestone:M11` `type:infra`

### #40 · Steamworks integration *(optional)*
Store features via a Steamworks binding: achievements, cloud saves, the overlay, and
optionally leaderboards.

- 🎯 **Deliverable:** A Steam test build where an achievement unlocks and a cloud save round-trips.
- ✅ At least one achievement fires and a cloud save persists across machines in a test build.
- 🔗 #39 · 🏷️ `milestone:M11` `type:infra`

---

## Index

| # | Title | Milestone | Deliverable in one line |
|--:|---|---|---|
| 1 | Scaffold Vite+TS+Phaser | M0 | Boot screen runs in browser |
| 2 | Dev tooling & hygiene | M0 | Working lint/typecheck/build scripts |
| 3 | Fixed-timestep loop | M0 | On-screen proof of steady 30Hz sim |
| 4 | Tile arena & collision | M1 | Arena where a box collides with tiles |
| 5 | Movement & friction | M1 | Player walks with original accel/friction |
| 6 | Gravity, jump & duck | M1 | Variable-height jump + crouch onto platforms |
| 7 | Double & hyper jump | M1 | Double-jump + charged boost |
| 8 | Debug/tuning overlay | M1 | Live state panel + tunable constants |
| 9 | Mouse aiming | M2 | Gun tracks the cursor |
| 10 | Pooled bullets | M2 | Hundreds of reused bullets at 60fps |
| 11 | MachineGun fire model | M2 | Held-fire at exact original cadence |
| 12 | Helicopter enemy | M2 | Shootable 300HP heli that dies |
| 13 | Damage/score/feedback | M2 | Kill loop with flash + score |
| 14 | Weapon table & switching | M3 | `weapons.ts` + in-game switching |
| 15 | Projectile weapons | M3 | 6 ballistic weapons (incl. Akimbo Mac-10) |
| 16 | Special weapons | M3 | Flame/mines/rail/seeker working |
| 17 | Heavy weapons | M3 | A-bomb/grapple/shoulder cannon |
| 18 | Enemy fire & health | M4 | Two-way firefight, player can die |
| 19 | Spawn treadmill | M4 | Never-empty escalating pressure |
| 20 | Heli variants | M4 | 2+ distinct heli behaviors |
| 21 | Powerup drops | M5 | Parachuting pickups from kills |
| 22 | Powerup effects | M5 | 5 states (tridamage/invuln/predator/timerift/jetpack) + health |
| 23 | HUD | M6 | Full live HUD at 1080p |
| 24 | Game states | M6 | Menu→play→gameover→restart |
| 25 | Score persistence | M6 | High scores survive reload |
| 26 | Audio pipeline | M7 | Web audio + manager, test SFX plays |
| 27 | Wire SFX & music | M7 | Every event sounds like HA2 |
| 28 | Responsive scaling | M8 | Resizes + fullscreen intact |
| 29 | Input abstraction | M8 | Gameplay reads intent, not keys |
| 30 | Touch controls | M8 | Playable on a phone |
| 31 | Gamepad support | M8 | Playable on a controller |
| 32 | Art pipeline & placeholders | M9 | Atlas render + `ART-SPEC.md` |
| 33 | Hi-res player | M9 | Final crisp player animations |
| 34 | Hi-res everything else | M9 | Zero placeholder art remains |
| 35 | Particles & explosions | M10 | Distinct hi-res impact FX |
| 36 | Screen shake & flashes | M10 | Proportional, toggleable juice |
| 37 | Performance pass | M10 | Meets 60/30fps targets, measured |
| 38 | Web deploy | M11 | Public playable URL |
| 39 | Steam wrapper | M11 | Desktop builds for 3 OSes |
| 40 | Steamworks *(opt)* | M11 | Achievement + cloud save work |
| 41 | Recreate original level | M4 | Real map layout replaces the test arena |
