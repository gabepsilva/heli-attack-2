# Heli Attack 2 — Migration Plan

A phased, incremental plan to rebuild Heli Attack 2 as a modern web game.
Each milestone is a **GitHub Milestone**; each ticket becomes a **GitHub Issue**.

## Principles

- **Incremental & always-runnable.** After every ticket, the game still builds and
  runs. No "big bang" — main is always playable/demoable.
- **Every ticket is testable.** Each has explicit **Acceptance Criteria** you can
  verify (automated test, or a described manual check in-browser).
- **Well-sized, not tiny.** A ticket is a meaningful feature (roughly 0.5–2 days).
  Trivial things are combined; large things are split. No ticket is a one-liner,
  none is a month.
- **Feel first, content second, polish last.** We nail movement and one weapon vs.
  one heli before building the full arsenal. Fun is validated early.
- **Port, don't reinvent.** Exact values come from
  [`reference/spec/HELIATTACK2-SPEC.md`](../reference/spec/HELIATTACK2-SPEC.md).

## Definition of Done (applies to every ticket)

- [ ] Code builds (`npm run build`) with no type errors.
- [ ] Lint passes.
- [ ] Acceptance criteria met and manually verified in-browser (or via test).
- [ ] Any new tunable constants live in a central `config` module (not magic numbers).
- [ ] No regression to previously completed tickets.

## Labels (suggested)

`milestone:M0`…`M11` · `type:feature` · `type:infra` · `type:art` · `type:audio`
· `area:physics` · `area:combat` · `area:ui` · `area:input` · `good-first-issue`

---

# Milestone M0 — Foundation & Tooling

> Goal: a running, empty Phaser game with a professional toolchain and a fixed
> simulation loop. Everything after this builds on it.

### #1 — Scaffold Vite + TypeScript + Phaser project
**Goal:** A blank Phaser game boots in the browser.
**Scope:** Vite + TS (strict) project; install Phaser 3; single `BootScene` that
renders a solid background + "Heli Attack 2" text; `index.html` mount point.
**Acceptance:**
- `npm run dev` serves a page showing the boot scene at 1920×1080 design size.
- `npm run build` produces a static bundle that runs from `dist/`.
- No console errors.
**Depends on:** —

### #2 — Dev tooling & repo hygiene
**Goal:** Consistent code quality via local checks (no CI — this is a solo, static,
zero-backend project; the same guarantees come from running checks locally).
**Scope:** ESLint + Prettier + `tsconfig` strict; `.gitignore`, `.editorconfig`;
`LICENSE`; npm scripts (`dev`/`build`/`lint`/`typecheck`). Optional: a pre-commit
hook running `lint`+`typecheck` so bad code never lands.
**Acceptance:**
- `npm run lint` and `npm run typecheck` pass on a clean checkout.
- A deliberate type error is caught by `npm run typecheck` (and the hook, if added).
**Depends on:** #1
**Note:** No CI/CD pipeline. Deployment is a manual static build (see #38) — there is
no server, no backend, and the game runs entirely in the user's browser.

### #3 — Fixed-timestep game loop & scene skeleton
**Goal:** Deterministic simulation independent of display FPS (original ran ~30fps;
all spec values are per-frame).
**Scope:** Fixed 30 Hz update accumulator decoupled from render; `GameScene`
stub; a central `config/constants.ts` seeded with world constants from the spec
(tile size, gravity, sim rate); simple FPS/step counter.
**Acceptance:**
- Update tick fires a stable 30×/sec regardless of monitor refresh (logged/asserted).
- Switching between GameScene and BootScene works.
**Depends on:** #1

---

# Milestone M1 — Core Movement & Feel  ⭐ *most important milestone*

> Goal: A player capsule that moves **exactly like the original** in a test arena.
> This is where the game's soul lives — validated before any content.

### #4 — Tile arena & AABB collision grid
**Goal:** A static level of 50px solid tiles with working collision.
**Scope:** Tile map data structure; render solid tiles; AABB tile collision helper
(`hitCheck` equivalent from the AS); a hand-made test arena with floor, walls, a
platform, and a pit.
**Acceptance:**
- A debug box dropped into the arena rests on the floor and can't pass walls.
- Tiles align to a 50px grid at 1080p.
**Depends on:** #3
**Ref:** spec §World/units, decompiled `hitCheck`/tile resolve.

### #5 — Player horizontal movement & friction
**Goal:** Ground movement matches the original's accel/cap/friction.
**Scope:** Player entity; left/right acceleration (+1/frame), input cap (±5), hard
cap (±6), friction decay (−1/frame) when no input; wall stop zeroes xspeed.
**Acceptance:**
- Holding a direction ramps to the cap; releasing decelerates smoothly to 0.
- Values match spec (verify via debug overlay readout).
**Depends on:** #4
**Ref:** spec §Player physics.

### #6 — Gravity, ground detection & variable-height jump
**Goal:** Single jump with the original's variable height and gravity.
**Scope:** Gravity (+1/frame²), terminal clamp (50), ground detection resets jump;
jump sets `yspeed = min(yspeed, -8)` with the 6-frame hold window for variable height.
**Acceptance:**
- Tap = short hop, hold = full jump; landing detected reliably.
- Terminal velocity caps a long fall.
**Depends on:** #5
**Ref:** spec §Player physics (jump, gravity, `up=6`).

### #7 — Double jump & charged hyper-jump
**Goal:** The signature air mobility.
**Scope:** Second mid-air jump (`jump`→`jump2`); hyper/boost jump charging over 150
frames, boost key triggers `yspeed = -32`; charge state exposed for later HUD.
**Acceptance:**
- Can double-jump; can't triple-jump.
- Boost only fires when charged; charge visibly refills over ~5s @30fps.
**Depends on:** #6
**Ref:** spec §Player physics (double/hyper jump).

### #8 — Debug overlay & physics tuning harness
**Goal:** Make the feel measurable and tweakable.
**Scope:** Toggleable overlay (velocity, grounded/jump state, charge, sim fps);
live-editable physics constants (dat.GUI-style or query params); combine here so
later milestones inherit a debug tool.
**Acceptance:**
- Overlay shows live values; tweaking gravity/jump updates behavior without reload.
- Overlay can be toggled off for clean demos.
**Depends on:** #7

**M1 exit check:** Movement feels like Heli Attack 2 to someone who remembers it.

---

# Milestone M2 — Combat Core

> Goal: Shoot one real weapon at one real helicopter and kill it. The core loop.

### #9 — Mouse aiming & gun rotation
**Goal:** Player aims a gun toward the cursor.
**Scope:** Gun pivot on player; rotate toward pointer; muzzle position calc for
spawning bullets; facing flip.
**Acceptance:**
- Gun tracks the cursor around a full 360°; muzzle point sits at the barrel tip.
**Depends on:** #8

### #10 — Bullet system with object pooling
**Goal:** Efficient projectiles that travel, expire, and cull off-screen.
**Scope:** Generic `Bullet` with velocity, speed, damage, lifetime; pooled
allocation (no per-shot GC); off-screen culling; debug spawn on click.
**Acceptance:**
- Firing hundreds of bullets holds 60fps; pool reuses instances (asserted count).
- Bullets despawn off-screen and after lifetime.
**Depends on:** #9

### #11 — MachineGun: real fire & reload model
**Goal:** The starting weapon behaves exactly like the original.
**Scope:** Reload-counter model (fire when `reloadtime >= gun.reloadtime`, reset,
consume ammo); MachineGun stats (reload 5, speed 8, damage 10); ∞ ammo for starter.
**Acceptance:**
- Fire cadence matches spec at 30fps sim; holding fire auto-repeats at the reload rate.
**Depends on:** #10
**Ref:** spec §Weapons (gun #0), firing model.

### #12 — Helicopter enemy entity
**Goal:** A heli that exists, moves, takes hits, and dies.
**Scope:** Heli entity with 300 HP; simple hover/drift movement; hit-test vs bullets;
death (remove + explosion placeholder); spawn from off-screen edge.
**Acceptance:**
- Heli absorbs 30 MachineGun hits (300/10) then dies; bullets register hits accurately.
**Depends on:** #11
**Ref:** spec §Enemy: Helicopter.

### #13 — Damage, score & hit feedback
**Goal:** Close the core loop with feedback and scoring.
**Scope:** Score += damage dealt; hit flash on heli; damage numbers or flash;
placeholder death explosion; on-screen score readout (temp).
**Acceptance:**
- Score increases per hit; killing a heli is visually/audibly (placeholder) obvious.
**Depends on:** #12

**M2 exit check:** "Move, aim, shoot heli, heli dies, score goes up" is fun.

---

# Milestone M3 — Full Arsenal

> Goal: All 14 weapons, faithfully. Ported from the spec's weapon table.

### #14 — Weapon data table & switching system
**Goal:** Data-driven weapons + cycle/switch between owned weapons.
**Scope:** Port the full `WEAPONS` table; inventory of owned weapons with ammo;
next/prev + number-key switching; per-weapon reload state.
**Acceptance:**
- Can cycle through weapons; each uses its own reload/ammo; switching is instant.
**Depends on:** #13
**Ref:** spec §Weapons table + TS config block.

### #15 — Projectile weapons
**Goal:** The ballistic set feels distinct.
**Scope:** Shotgun (multi-pellet spread), ShotgunRockets, GrenadeLauncher (fast arc),
RPG (slow), RocketLauncher, using real stats; shared projectile behaviors.
**Acceptance:**
- Each weapon's reload/speed/damage matches spec; spread & travel visibly differ.
**Depends on:** #14
**Ref:** spec §Weapons (#2–#6).

### #16 — Special-behavior weapons
**Goal:** The mechanically unique weapons.
**Scope:** FlameThrower (hold-to-fire, per-tick DoT), FireMines (lobbed, persistent),
RailGun (very fast/piercing feel), SeekerLauncher (homing toward nearest heli).
**Acceptance:**
- Flamethrower damages continuously while held; seeker curves toward a heli;
  railgun crosses the screen near-instantly. Values per spec.
**Depends on:** #15
**Ref:** spec §Weapons (#7,#8,#9,#11).

### #17 — Heavy / signature weapons
**Goal:** The big-payoff weapons.
**Scope:** A-Bomb Launcher (one-shot, huge AoE + long cooldown), GrappleCannon
(damage + grapple/pull mobility), ShoulderCannon.
**Acceptance:**
- A-Bomb one-shots a heli with a big blast; grapple both damages and moves the player.
**Depends on:** #16
**Ref:** spec §Weapons (#10,#12,#13).

---

# Milestone M4 — Enemy Behavior & Spawning

> Goal: The relentless "treadmill" pressure that defines the game.

### #18 — Enemy fire & player health
**Goal:** Helis shoot back; player can be hurt and die.
**Scope:** Heli aimed fire (bullets speed 7, ±5° spread); player health (100),
damage on hit, invulnerability frames; player death state.
**Acceptance:**
- Standing still under a heli drains health to death; spread matches spec.
**Depends on:** #13 (usable after M2; scheduled here)
**Ref:** spec §Enemy fire, §Player health.

### #19 — Replacement spawn treadmill & difficulty ramp
**Goal:** Constant on-screen heli population, escalating pressure.
**Scope:** On heli death, spawn a replacement (`addEnemy`); ramp concurrent heli
count over time/kills; spawn from screen edges/top per original.
**Acceptance:**
- Population never drops to zero mid-game; pressure measurably increases with kills.
**Depends on:** #18
**Ref:** spec §Enemy (replacement model).

### #20 — Heli variants & behavior polish
**Goal:** Visual/behavioral variety (original used multiple heli frames).
**Scope:** 2+ heli looks/behaviors (e.g. strafing vs hovering); varied approach
paths; off-screen timers so helis reposition.
**Acceptance:**
- At least two visibly different heli behaviors appear in a session.
**Depends on:** #19

---

# Milestone M5 — Powerups

### #21 — Powerup drop & pickup system
**Goal:** Weapons and health drop from kills.
**Scope:** Drop logic — health on doubling kill-thresholds (1,2,4,8…), weapon/ammo
~3% per kill; falling pickup entities with parachute; collect on touch.
**Acceptance:**
- Health packs appear on the threshold kills; weapon drops appear ~3% of kills
  (verify over many kills); walking over one collects it.
**Depends on:** #19
**Ref:** spec §Powerups (drop logic).

### #22 — Powerup effects
**Goal:** The temporary power states.
**Scope:** TriDamage (×3 damage, timed), Jetpack/Fly (hold-to-rise), Invulnerability,
Health (+20 cap 100); timers + active-effect state for HUD.
**Acceptance:**
- TriDamage triples kill speed while active; jetpack lets the player free-fly;
  invuln blocks damage; all expire correctly.
**Depends on:** #21
**Ref:** spec §Powerups (effects, `powerupon` states).

---

# Milestone M6 — UI / HUD & Game States

### #23 — In-game HUD
**Goal:** Replace all temp readouts with a real HUD.
**Scope:** Health bar, ammo/weapon indicator, score, hyper-jump charge meter, active
powerup indicator; anchored to design resolution.
**Acceptance:**
- All values update live and correctly; HUD reads clearly at 1080p.
**Depends on:** #22

### #24 — Game state flow (menu → play → game over)
**Goal:** A complete session loop.
**Scope:** Main menu (start), gameplay, pause, game-over with final score, restart;
scene transitions.
**Acceptance:**
- Full loop playable start-to-death-to-restart with no reload.
**Depends on:** #23

### #25 — Score persistence & local high scores
**Goal:** Runs feel rewarding across sessions.
**Scope:** Persist high scores (localStorage); high-score table on menu/game-over;
optional stats (helis killed, accuracy).
**Acceptance:**
- High score survives reload; beating it updates the table.
**Depends on:** #24

---

# Milestone M7 — Audio

### #26 — Audio pipeline & manager
**Goal:** Reference WAVs become web-ready, played through one system.
**Scope:** Transcode `reference` WAVs → `.ogg`/`.webm` (+mp3 fallback) build step;
`AudioManager` (SFX pooling, volume, mute, browser audio-unlock on first input).
**Acceptance:**
- A test SFX plays on click after unlock; muting silences all; no clipping on overlap.
**Depends on:** #3
**Ref:** `reference/ha2-source/assets/helisounds/` (39 WAVs).

### #27 — Wire SFX & music to events
**Goal:** The game sounds like Heli Attack 2.
**Scope:** Map every event to its original sound (each weapon, explosions, hurt,
hyper-jump, powerups); background music track; per-weapon fire sounds.
**Acceptance:**
- Every weapon/powerup/explosion/hurt triggers the correct original sound; music loops.
**Depends on:** #26, #22

---

# Milestone M8 — Responsive & Multi-Input  *(CrazyGames-style)*

### #28 — Responsive scaling (desktop + fullscreen)
**Goal:** Fills any desktop window and fullscreen without breaking layout.
**Scope:** Phaser Scale Manager (`FIT` first, evaluate `RESIZE`), center, fullscreen
button; HUD anchoring holds across aspect ratios.
**Acceptance:**
- Resizing the window and going fullscreen keeps the game correct and centered.
**Depends on:** #23

### #29 — Input abstraction layer
**Goal:** Decouple game from input device (prep for touch/gamepad).
**Scope:** "Player intent" layer (move/aim/fire/jump/boost/switch) fed by input
sources; refactor keyboard/mouse to feed it.
**Acceptance:**
- Keyboard/mouse still fully control the game *through* the abstraction (no direct
  key reads in gameplay code).
**Depends on:** #24

### #30 — Touch controls & orientation guard
**Goal:** Playable on mobile.
**Scope:** Virtual joystick (move), aim/fire controls, jump/boost/switch buttons,
shown only on touch devices; portrait "rotate device" overlay.
**Acceptance:**
- Fully playable on a phone in landscape; portrait shows the rotate prompt.
**Depends on:** #29

### #31 — Gamepad support
**Goal:** Controller play (Steam-ready).
**Scope:** Gamepad mapping through the intent layer (stick move/aim, buttons
fire/jump/boost/switch); hotplug detection.
**Acceptance:**
- A connected controller fully plays the game; unplugging falls back cleanly.
**Depends on:** #29

---

# Milestone M9 — Art Modernization

### #32 — Art pipeline & hi-res placeholders
**Goal:** A sprite/atlas workflow with stand-in hi-res art.
**Scope:** Texture atlas packing in the build; import reference sprites AI-upscaled
as *temporary* placeholders; document the art spec (sizes, pivots, anim frames) from
the originals.
**Acceptance:**
- Game renders with atlased placeholder art at 1080p; adding a sprite is documented.
**Depends on:** #1
**Ref:** `reference/ha2-source/assets/` (originals as art bible).

### #33 — Hi-res player art & animations
**Goal:** Final, crisp player.
**Scope:** Redrawn 1080p-native player: idle, run, jump, double-jump, duck, hurt,
death; wired to states; matches original silhouette/style.
**Acceptance:**
- Player animations are crisp at 1080p and read correctly per state.
**Depends on:** #32

### #34 — Hi-res helis, weapons, effects & environment
**Goal:** Replace all remaining placeholders.
**Scope:** Redrawn helis (+variants), weapon sprites/muzzle flashes, projectiles,
explosions, powerups, background & tiles — all hi-res in original style.
**Acceptance:**
- No placeholder art remains; scene is crisp at 1080p and stylistically consistent.
**Depends on:** #33, #20

---

# Milestone M10 — Juice & Polish

### #35 — Particles & explosions
**Goal:** Satisfying visual impact.
**Scope:** Hi-res particle explosions, bullet impacts, smoke, shell/debris, muzzle
flashes via Phaser emitters (pooled).
**Acceptance:**
- Kills and impacts produce distinct particle FX; 60fps holds under heavy load.
**Depends on:** #34

### #36 — Camera feel: screen shake & hit flashes
**Goal:** Game-feel "juice."
**Scope:** Screen shake (explosions/big hits, tunable), hit-stop/flash, subtle camera
follow/lead; damage vignette.
**Acceptance:**
- Big weapons shake the screen proportionally; effects are tasteful, not nauseating
  (toggle available).
**Depends on:** #35

### #37 — Performance pass
**Goal:** Smooth on mid-range mobile.
**Scope:** Audit pooling (bullets/particles/enemies), atlas draw-call batching, GC
profiling, mobile frame budget; add a perf HUD.
**Acceptance:**
- Sustained 60fps desktop and ≥30fps mid-range mobile under peak load (measured).
**Depends on:** #36, #30

---

# Milestone M11 — Shipping

### #38 — Web build & deploy
**Goal:** Publicly playable in a browser.
**Scope:** Production build tuning (asset compression, caching); deploy to a host
(itch.io / own page); CrazyGames SDK integration if targeting them.
**Acceptance:**
- Game loads and plays from the public URL on desktop and mobile browsers.
**Depends on:** #37

### #39 — Steam desktop wrapper
**Goal:** A runnable Steam build.
**Scope:** Wrap the web build in **Tauri** (or Electron) for Win/Mac/Linux; native
fullscreen; controller works; app icon/metadata.
**Acceptance:**
- Desktop executables launch, run fullscreen, and are gamepad-playable on all 3 OSes.
**Depends on:** #38, #31

### #40 — Steamworks integration *(optional)*
**Goal:** Store features.
**Scope:** Achievements, cloud saves, overlay via Steamworks binding; leaderboards.
**Acceptance:**
- At least one achievement unlocks and a cloud save round-trips in a Steam test build.
**Depends on:** #39

---

## Milestone summary

| # | Milestone | Outcome | Tickets |
|---|---|---|---|
| M0 | Foundation & Tooling | Empty Phaser game + local tooling + fixed loop | #1–#3 |
| M1 | Core Movement & Feel ⭐ | Player moves exactly like the original | #4–#8 |
| M2 | Combat Core | Shoot a heli, it dies, score up | #9–#13 |
| M3 | Full Arsenal | All 14 weapons | #14–#17 |
| M4 | Enemy Behavior & Spawning | Relentless heli treadmill | #18–#20 |
| M5 | Powerups | Drops + power states | #21–#22 |
| M6 | UI / HUD & Game States | Full menu→play→gameover loop | #23–#25 |
| M7 | Audio | Sounds like HA2 | #26–#27 |
| M8 | Responsive & Multi-Input | Desktop + mobile + gamepad | #28–#31 |
| M9 | Art Modernization | Hi-res 1080p art | #32–#34 |
| M10 | Juice & Polish | Particles, shake, perf | #35–#37 |
| M11 | Shipping | Web + Steam | #38–#40 |

**Playable-vertical-slice** (fun, judgeable) is reached at the end of **M2**.
**Feature-complete** at **M6+M7**. **Ship-ready** at **M11**.
