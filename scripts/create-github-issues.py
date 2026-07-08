#!/usr/bin/env python3
"""Create GitHub milestones, labels, and issues from docs/TICKETS.md structure."""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass

REPO = "gabepsilva/heli-attack-2"

MILESTONES = [
    ("M0 — Foundation & Tooling", "Empty Phaser game + local tooling + fixed loop. Tickets #1–#3."),
    ("M1 — Core Movement & Feel", "Player moves exactly like the original. Tickets #4–#8."),
    ("M2 — Combat Core", "Shoot a heli, it dies, score up. Tickets #9–#13."),
    ("M3 — Full Arsenal", "All 14 weapons. Tickets #14–#17."),
    ("M4 — Enemy Behavior & Spawning", "Relentless heli treadmill + real level. Tickets #18–#20, #41."),
    ("M5 — Powerups", "Drops + power states + bullet-time. Tickets #21, #22, #42."),
    ("M6 — UI / HUD & Game States", "Full menu→play→gameover loop. Tickets #23–#25."),
    ("M7 — Audio", "Sounds like HA2. Tickets #26–#27."),
    ("M8 — Responsive & Multi-Input", "Desktop + mobile + gamepad. Tickets #28–#31."),
    ("M9 — Art Modernization", "Hi-res 1080p art. Tickets #32–#34."),
    ("M10 — Juice & Polish", "Particles, shake, perf. Tickets #35–#37."),
    ("M11 — Shipping", "Web + Steam. Tickets #38–#40."),
]

LABELS = [
    ("type:feature", "d4c5f9", "Gameplay or user-facing feature"),
    ("type:infra", "bfd4f2", "Tooling, build, deploy, performance"),
    ("type:art", "fef2c0", "Art pipeline and assets"),
    ("type:audio", "c5def5", "Audio pipeline and SFX/music"),
    ("area:physics", "ededed", "Movement, collision, simulation"),
    ("area:combat", "f9d0c4", "Weapons, enemies, damage"),
    ("area:ui", "d4edda", "HUD, menus, game states"),
    ("area:input", "e7e7e7", "Keyboard, touch, gamepad"),
    ("good-first-issue", "7057ff", "Good entry point for contributors"),
]

@dataclass
class Ticket:
    num: int
    title: str
    milestone: str
    body: str
    labels: list[str]


TICKETS: list[Ticket] = [
    Ticket(1, "Scaffold Vite + TypeScript + Phaser project", "M0",
           """Stand up the project skeleton: a Vite + strict-TypeScript app with Phaser 3 installed and a single `BootScene` that clears to a background color and renders the title text at the 1920×1080 design resolution.

## Deliverable
A running app — `npm run dev` opens a browser window showing a "Heli Attack 2" boot screen; `npm run build` emits a working static `dist/`.

## Acceptance criteria
- [ ] Boot scene renders with no console errors
- [ ] Production build runs when opened from `dist/`

## Depends on
—""", ["type:infra", "good-first-issue"]),
    Ticket(2, "Dev tooling & repo hygiene", "M0",
           """Wire up the local quality gate (no CI — static, solo, zero-backend project). ESLint + Prettier + strict `tsconfig`, `.gitignore`/`.editorconfig`/`LICENSE`, and npm scripts. Optionally a pre-commit hook running lint + typecheck.

## Deliverable
`package.json` with working `dev`/`build`/`lint`/`typecheck` scripts + committed config files; a clean checkout passes all of them.

## Acceptance criteria
- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] A deliberately introduced type error is caught by `typecheck`

## Depends on
#1""", ["type:infra"]),
    Ticket(3, "Fixed-timestep game loop & scene skeleton", "M0",
           """The original ran at ~30fps and every spec value is per-frame, so simulation must be frame-rate-independent. Build a 30 Hz fixed-update accumulator decoupled from render, a `GameScene` stub, and a central `config/constants.ts` seeded with world constants.

## Deliverable
A `GameScene` with an on-screen counter proving the sim ticks a steady 30×/sec regardless of monitor refresh rate; `config/constants.ts` committed.

## Time-scale from day one
Expose a per-frame `timeStep` multiplier (default 1) that all entity updates apply to their motion. Two features drive it: manual **bullet-time** (#42) eases it down to 0.2× and back, and the **TimeRift** powerup (#22) rides the same path while the player stays at 1. Retrofitting this later is painful — bake it into the loop now.

## Acceptance criteria
- [ ] Sim rate reads ~30/s on both a 60Hz and 144Hz display
- [ ] Scene switching works
- [ ] A global `timeStep` factor exists and scales entity motion (verify by halving it)

## Depends on
#1""", ["type:feature", "area:physics"]),
    Ticket(4, "Tile arena & AABB collision grid", "M1",
           """A static, hand-authored test level built from 50px solid tiles, plus the AABB tile-collision helper (the `hitCheck`/tile-resolve logic from the original), and a debug box that obeys it.

## Deliverable
A playable test arena (floor, walls, a floating platform, a pit) where a draggable/droppable debug box collides correctly against all tiles.

## Acceptance criteria
- [ ] Box rests on floors, is blocked by walls
- [ ] Can't tunnel through tiles at speed

## Depends on
#3""", ["type:feature", "area:physics"]),
    Ticket(5, "Player horizontal movement & friction", "M1",
           """The player entity with ground movement matching the original: +1/frame acceleration, ±5 input cap, ±6 hard cap, and −1/frame friction decay when no key is held.

## Deliverable
A controllable player in the arena that walks left/right with the original's accel/cap/friction curve.

## Acceptance criteria
- [ ] Debug overlay shows speed ramping to the cap and decaying to 0 on release
- [ ] Values match the spec

## Depends on
#4""", ["type:feature", "area:physics"]),
    Ticket(6, "Gravity, ground detection & variable-height jump", "M1",
           """Add gravity (+1/frame², terminal-clamped at 50), reliable ground detection that resets the jump, and a variable-height jump (`yspeed = min(yspeed,-8)` with the 6-frame hold window).

## Deliverable
A player that jumps — tap for a short hop, hold for full height — and lands cleanly on platforms.

## Ducking (down / `duckKey`)
Holding down shrinks the hitbox to 2/3 W&H (10x42 -> ~6.7x28), blocks walking (accel only when `!duck`), blocks the double-jump (`!jump2 && !duck`), uses the duck sprite frame, and nudges `_y` back up on release. Placed here because it needs both movement (#5) and the jump to exist.

## Acceptance criteria
- [ ] Short vs full jump heights are visibly different
- [ ] Terminal velocity caps a long fall
- [ ] Holding duck shrinks the hitbox and disables walking + double-jump

## Depends on
#5""", ["type:feature", "area:physics"]),
    Ticket(7, "Double jump & charged hyper-jump", "M1",
           """The signature air mobility: a second mid-air jump, plus a boost/hyper-jump that charges over 150 frames and fires a −32 vertical burst on the boost key.

## Deliverable
A player that can double-jump and perform a charged hyper-jump, with the charge state exposed for a future HUD meter.

## Acceptance criteria
- [ ] Can double-jump but not triple-jump
- [ ] Boost only fires when charged and refills over ~5s

## Depends on
#6""", ["type:feature", "area:physics"]),
    Ticket(8, "Debug overlay & physics tuning harness", "M1",
           """A toggleable overlay showing live velocity/state/charge/sim-fps, plus live-editable physics constants (in-page controls or query params) so the feel can be tuned without recompiling.

## Deliverable
An on-screen debug panel that displays live player state and lets you tweak gravity/jump/speed constants and immediately feel the change.

## Acceptance criteria
- [ ] Editing a constant changes behavior with no reload
- [ ] Overlay toggles off for clean demos

## Depends on
#7

> **M1 exit demo:** someone who remembers Heli Attack 2 plays the arena and says "yes, that's the movement.\"""", ["type:infra", "area:physics"]),
    Ticket(9, "Mouse aiming & gun rotation", "M2",
           """A gun that pivots on the player and rotates to point at the mouse cursor through a full 360°, with a computed muzzle position and correct facing flip.

## Deliverable
A player holding a gun that visibly tracks the cursor, with the muzzle tip correctly positioned at the barrel end.

## Acceptance criteria
- [ ] Gun aims accurately all the way around
- [ ] Muzzle point sits at the barrel for any angle

## Depends on
#8""", ["type:feature", "area:combat"]),
    Ticket(10, "Bullet system with object pooling", "M2",
           """A generic, pooled projectile (velocity, speed, damage, lifetime) that travels, expires, and culls off-screen — with zero per-shot garbage allocation.

## Deliverable
Clicking spawns pooled bullets that fly from the muzzle and disappear off-screen/after their lifetime; a counter shows the pool being reused.

## Acceptance criteria
- [ ] Firing hundreds of bullets holds 60fps
- [ ] Pool reuses instances (asserted, not growing)

## Depends on
#9""", ["type:feature", "area:combat"]),
    Ticket(11, "MachineGun: real fire & reload model", "M2",
           """The reload-counter firing model driving the MachineGun with its exact stats (reload 5, speed 8, damage 10, infinite ammo).

## Deliverable
A held-fire MachineGun that auto-repeats at the original's exact cadence.

## Acceptance criteria
- [ ] Measured fire rate matches spec at 30fps sim
- [ ] Holding fire streams bullets at the reload rate

## Depends on
#10""", ["type:feature", "area:combat"]),
    Ticket(12, "Helicopter enemy entity", "M2",
           """A helicopter that spawns from a screen edge, hovers/drifts, has 300 HP, registers bullet hits, and dies (removal + placeholder explosion).

## Deliverable
A heli in the arena you can shoot down — it takes hits and is destroyed after enough damage.

## Acceptance criteria
- [ ] Absorbs exactly 30 MachineGun hits (300/10) then dies
- [ ] Hit registration is pixel-accurate

## Depends on
#11""", ["type:feature", "area:combat"]),
    Ticket(13, "Damage, score & hit feedback", "M2",
           """Close the loop: score increments by damage dealt, helis flash on hit, a placeholder death explosion plays, and a temporary score readout shows on screen.

## Deliverable
A full mini-loop — shoot heli → it flashes and takes damage → dies with an explosion → score visibly rises.

## Acceptance criteria
- [ ] Score increases per hit
- [ ] A kill is unmistakable visually

## Depends on
#12

> **M2 exit demo:** the vertical slice — "move, aim, shoot heli, heli dies, score up" — is genuinely fun.""", ["type:feature", "area:combat"]),
    Ticket(14, "Weapon data table & switching system", "M3",
           """Port the full 14-weapon data table and build a data-driven inventory: owned weapons with per-weapon ammo and reload state, switchable via number keys and next/prev.

## Deliverable
A committed `config/weapons.ts` with all 14 weapons, plus in-game weapon switching between (initially test-granted) weapons.

## Acceptance criteria
- [ ] Cycling changes the active weapon
- [ ] Each tracks its own ammo/reload; switching is instant

## Depends on
#13""", ["type:feature", "area:combat"]),
    Ticket(15, "Projectile weapons", "M3",
           """Implement the ballistic set with real stats and distinct behaviors: Akimbo Mac-10's (weapon #1 — twin-stream MachineGun clone, reload 4 / speed 8 / damage 9), Shotgun, ShotgunRockets, GrenadeLauncher, RPG, RocketLauncher.

## Deliverable
Six selectable, working weapons that each visibly differ in spread, projectile speed, and damage.

## Acceptance criteria
- [ ] Each weapon's reload/speed/damage matches the spec table
- [ ] Akimbo out-fires the MachineGun; shotgun fires a spread; RPG is visibly slow

## Depends on
#14""", ["type:feature", "area:combat"]),
    Ticket(16, "Special-behavior weapons", "M3",
           """FlameThrower (hold-to-fire continuous DoT), FireMines (lobbed, persistent), RailGun (near-instant fast shot), SeekerLauncher (homing).

## Deliverable
Four working special weapons demonstrating continuous damage, persistent mines, hitscan-speed, and homing.

## Acceptance criteria
- [ ] Flamethrower damages while held
- [ ] Seeker curves toward the nearest heli; railgun crosses screen near-instantly

## Depends on
#15""", ["type:feature", "area:combat"]),
    Ticket(17, "Heavy / signature weapons", "M3",
           """A-Bomb Launcher (one-shot huge AoE + long cooldown), GrappleCannon (damage plus grapple/pull mobility), ShoulderCannon.

## Deliverable
Three working heavy weapons — the A-Bomb clears helis in a blast; the grapple both damages and pulls the player.

## Acceptance criteria
- [ ] A-Bomb one-shots a heli with a large blast + long reload
- [ ] Grapple demonstrably moves the player

## Depends on
#16""", ["type:feature", "area:combat"]),
    Ticket(18, "Enemy fire & player health", "M4",
           """Helis shoot back (aimed bullets, speed 7, ±5° spread) and the player has 100 health, takes damage on hit with brief invulnerability frames, and can die.

## Deliverable
A two-way firefight — standing under a heli drains the player's health bar to a death state.

## Acceptance criteria
- [ ] Player takes damage from heli bullets
- [ ] I-frames prevent instant death; spread matches spec

## Depends on
#13""", ["type:feature", "area:combat"]),
    Ticket(19, "Replacement spawn treadmill & difficulty ramp", "M4",
           """When a heli dies, a replacement spawns, and concurrent heli count ramps over time/kills, spawning from edges and top.

## Deliverable
A continuous session where the sky is never empty and pressure escalates the longer you survive.

## Acceptance criteria
- [ ] Heli population never hits zero mid-game
- [ ] Concurrent count measurably grows with kills

## Depends on
#18""", ["type:feature", "area:combat"]),
    Ticket(20, "Heli variants & behavior polish", "M4",
           """Add variety: 2+ distinct heli looks/behaviors (e.g. strafing vs hovering), varied approach paths, and reposition timers.

## Deliverable
A session showing at least two visibly different heli behaviors on screen.

## Acceptance criteria
- [ ] Two behavior types are distinguishable in play
- [ ] Helis reposition rather than sitting still

## Depends on
#19""", ["type:feature", "area:combat"]),
    Ticket(21, "Powerup drop & pickup system", "M5",
           """Kills drop pickups: health on doubling kill-thresholds (1, 2, 4, 8…) and weapon/ammo at ~3% per kill, falling on parachutes and collected on touch.

## Deliverable
Parachuting powerups that spawn from kills and are collected by walking into them.

## Acceptance criteria
- [ ] Health drops on threshold kills
- [ ] Weapon drops appear ~3% over many kills; touch collects

## Depends on
#19""", ["type:feature", "area:combat"]),
    Ticket(22, "Powerup effects", "M5",
           """The five timed state powerups (`powerupOn = 1 + random(5)`, each 500 frames) + instant Health:
1. TriDamage (damage x3), 2. Invulnerability (no damage), 3. PredatorMode (invisible, forced predator gun w/ infinite reload, weapon-switch disabled, enemies fire randomly), 4. TimeRift (forces #42's slow-mo path without draining its meter, player stays at 1), 5. Jetpack/Fly (hold-to-rise). Health: +20, cap 100.

## Deliverable
All five state powerups + health working, each with a timer feeding the future HUD.

## Acceptance criteria
- [ ] TriDamage triples kill speed; invuln blocks damage
- [ ] PredatorMode turns you invisible and locks weapon switching
- [ ] TimeRift slows the world but not the player, without draining the bullet-time meter
- [ ] Jetpack enables free flight; all timed effects expire

## Depends on
#21, #42 (TimeRift shares its slow-mo path)""", ["type:feature", "area:combat"]),
    Ticket(23, "In-game HUD", "M6",
           """Replace all temporary readouts with a real HUD: health bar, ammo/weapon indicator, score, hyper-jump charge meter, bullet-time meter (#42), and active-powerup indicator with a remaining-time bar, anchored to the design resolution.

## Deliverable
A complete, styled HUD rendering all live game values at 1080p.

## Acceptance criteria
- [ ] Every element updates correctly in real time
- [ ] Bullet-time meter drains/refills live; powerup indicator shows remaining time
- [ ] Reads clearly at 1080p

## Depends on
#22, #42""", ["type:feature", "area:ui"]),
    Ticket(24, "Game state flow (menu → play → game over)", "M6",
           """A complete session loop: main menu (start), gameplay, pause, and a game-over screen showing final score with restart — all via scene transitions.

## Deliverable
A playable end-to-end loop from menu to death to restart, no page reload.

## Acceptance criteria
- [ ] Every transition works
- [ ] Game-over shows the correct final score; restart resets cleanly

## Depends on
#23""", ["type:feature", "area:ui"]),
    Ticket(25, "Score persistence & local high scores", "M6",
           """Persist high scores in localStorage, show a high-score table on the menu/game-over screens, and optionally track stats (helis killed, accuracy).

## Deliverable
A high-score table that survives page reloads and updates when beaten.

## Acceptance criteria
- [ ] High score persists across reloads
- [ ] A new record updates the stored table

## Depends on
#24""", ["type:feature", "area:ui"]),
    Ticket(26, "Audio pipeline & manager", "M7",
           """Turn the reference WAVs into web-ready audio: build step transcoding to `.ogg`/`.webm` (+mp3 fallback), and an `AudioManager` handling SFX pooling, volume, mute, and browser audio-unlock on first input.

## Deliverable
Web-optimized audio files in the build + an `AudioManager`; a test SFX plays on click after unlock.

## Acceptance criteria
- [ ] Sound plays after user-gesture unlock
- [ ] A master volume control attenuates all audio; mute silences everything
- [ ] Overlapping sounds don't clip

_Scope decision: master volume + mute only (no per-channel mixer)._

## Depends on
#3""", ["type:audio"]),
    Ticket(27, "Wire SFX & music to events", "M7",
           """Map every game event to its original sound — each weapon's fire, explosions, player hurt, hyper-jump, powerups — plus a looping background music track.

## Deliverable
A fully-scored game where every action triggers its authentic original sound and music loops underneath.

## Acceptance criteria
- [ ] Each weapon/powerup/explosion/hurt fires the correct sound
- [ ] Music loops seamlessly

## Depends on
#26, #22""", ["type:audio"]),
    Ticket(28, "Responsive scaling (desktop + fullscreen)", "M8",
           """Make the game fill any desktop window and fullscreen without breaking layout, via the Phaser Scale Manager (FIT first, evaluate RESIZE), centered, with a fullscreen button and HUD anchoring that survives varied aspect ratios.

## Deliverable
A game that correctly resizes with the window and enters/exits fullscreen with the HUD intact.

## Acceptance criteria
- [ ] Resizing and fullscreen keep the game centered
- [ ] HUD correctly positioned

## Depends on
#23""", ["type:feature", "area:input"]),
    Ticket(29, "Input abstraction layer", "M8",
           """Decouple gameplay from input hardware: a "player intent" layer (move/aim/fire/jump/boost/switch) that input sources feed, with keyboard/mouse refactored to feed it.

## Deliverable
A committed input-intent module; all gameplay reads intent, not raw keys — and the game still fully plays on keyboard/mouse.

## Acceptance criteria
- [ ] No gameplay code reads keys directly
- [ ] Keyboard/mouse control is unchanged for the player

_Scope decision: the original stored rebindable keys in a SharedObject. Key rebinding is deliberately out of scope; the intent layer must not preclude adding it later._

## Depends on
#24""", ["type:infra", "area:input"]),
    Ticket(30, "Touch controls & orientation guard", "M8",
           """Mobile play: a virtual joystick (move), aim/fire controls, jump/boost/switch buttons — shown only on touch devices — plus a portrait "rotate your device" overlay.

## Deliverable
The game fully playable on a phone in landscape, with a rotate prompt shown in portrait.

## Acceptance criteria
- [ ] A full session is completable via touch on a real phone
- [ ] Portrait shows the overlay

## Depends on
#29""", ["type:feature", "area:input"]),
    Ticket(31, "Gamepad support", "M8",
           """Controller play (Steam-ready): map a gamepad through the intent layer (stick move/aim, buttons for fire/jump/boost/switch) with hotplug detection.

## Deliverable
The game fully playable with a connected controller.

## Acceptance criteria
- [ ] A controller plays a complete session
- [ ] Unplugging falls back to keyboard cleanly

## Depends on
#29""", ["type:feature", "area:input"]),
    Ticket(32, "Art pipeline & hi-res placeholders", "M9",
           """A sprite/atlas workflow with stand-in art: texture-atlas packing in the build, reference sprites AI-upscaled as *temporary* placeholders, and a documented art spec (sizes, pivots, animation frames) derived from the originals.

## Deliverable
The game rendering from a packed atlas at 1080p with placeholder art, plus an `ART-SPEC.md` documenting every sprite's dimensions and pivots.

## Acceptance criteria
- [ ] Scene renders via atlas
- [ ] Adding a new sprite follows the documented, working process

## Depends on
#1""", ["type:art"]),
    Ticket(33, "Hi-res player art & animations", "M9",
           """The final crisp player: redrawn 1080p-native idle, run, jump, double-jump, duck, hurt, and death animations, wired to the existing player states in the original's style.

## Deliverable
A player rendered with final hi-res animations that switch correctly per state.

## Acceptance criteria
- [ ] All player animations are crisp at 1080p and match the correct state
- [ ] No placeholder player remains

## Depends on
#32""", ["type:art"]),
    Ticket(34, "Hi-res helis, weapons, effects & environment", "M9",
           """Replace every remaining placeholder: redrawn helis (+variants), weapon sprites/muzzle flashes, projectiles, explosions, powerups, background, and tiles — all hi-res, style-consistent.

## Deliverable
A build with zero placeholder art — every on-screen element is final hi-res.

## Acceptance criteria
- [ ] No placeholders remain
- [ ] Whole scene is crisp at 1080p and stylistically consistent

## Depends on
#33, #20""", ["type:art"]),
    Ticket(35, "Particles & explosions", "M10",
           """Satisfying impact via pooled Phaser emitters: hi-res explosions, bullet impacts, smoke, debris/shells, and muzzle flashes.

## Deliverable
Kills and impacts spawn distinct hi-res particle effects.

## Acceptance criteria
- [ ] Impacts/kills produce clear particle FX
- [ ] 60fps holds under heavy simultaneous load

## Depends on
#34""", ["type:feature"]),
    Ticket(36, "Camera feel: screen shake & hit flashes", "M10",
           """Game-feel juice: tunable screen shake on explosions/big hits, hit-stop/flash, subtle camera follow/lead, and a damage vignette.

## Deliverable
Big weapons and hits produce proportional screen shake and hit flashes, with an intensity toggle.

## Acceptance criteria
- [ ] Shake scales with weapon size and feels good, not nauseating
- [ ] Effects can be toggled

## Depends on
#35""", ["type:feature"]),
    Ticket(37, "Performance pass", "M10",
           """Make it smooth on mid-range mobile: audit pooling (bullets/particles/enemies), atlas draw-call batching, GC profiling, and a mobile frame budget, with a perf HUD.

## Deliverable
A measured performance report + a perf HUD, hitting the frame targets.

## Acceptance criteria
- [ ] Sustained 60fps on desktop and ≥30fps on a mid-range phone under peak load (measured/logged)

## Depends on
#36, #30""", ["type:infra"]),
    Ticket(38, "Web build & deploy", "M11",
           """Make it publicly playable in a browser: production build tuning (asset compression, caching), a manual static deploy to a host (itch.io / own page), and CrazyGames SDK integration if targeting them.

## Deliverable
A public URL where anyone can play the game in their browser.

## Acceptance criteria
- [ ] The game loads and plays from the public URL on both desktop and mobile browsers

## Depends on
#37""", ["type:infra"]),
    Ticket(39, "Steam desktop wrapper", "M11",
           """A runnable Steam build: wrap the web build in Tauri (or Electron) for Win/Mac/Linux, with native fullscreen, working controller, and app icon/metadata.

## Deliverable
Downloadable desktop executables for all three OSes that launch and play fullscreen with a gamepad.

## Acceptance criteria
- [ ] Each OS build launches, runs fullscreen, and is fully gamepad-playable

## Depends on
#38, #31""", ["type:infra"]),
    Ticket(40, "Steamworks integration (optional)", "M11",
           """Store features via a Steamworks binding: achievements, cloud saves, the overlay, and optionally leaderboards.

## Deliverable
A Steam test build where an achievement unlocks and a cloud save round-trips.

## Acceptance criteria
- [ ] At least one achievement fires and a cloud save persists across machines in a test build

## Depends on
#39""", ["type:infra"]),
    Ticket(41, "Recreate the original level layout", "M4",
           """The #4 arena is a throwaway *test* level; nothing yet rebuilds the actual Heli Attack 2 playfield. Port the original map's ground/platform/wall layout as tile-map data on the 50px grid so the shipped game plays on the real level, using placeholder tiles until #34 swaps in final environment art.

## Deliverable
A committed level/map data file reproducing the original's layout, loaded by `GameScene` with real collision — replacing the test arena in the main game.

## Acceptance criteria
- [ ] The real level (not the test arena) loads in-game with correct collision
- [ ] Layout matches the original's proportions
- [ ] Movement and combat play correctly on it

## Depends on
#4 (tiles/collision); feeds #34 (environment art)

## Ref
Decompiled `map[][]` tile data in `reference/spec/heli2-decompiled-actionscript.txt`.""", ["type:feature", "area:physics"]),
    Ticket(42, "Bullet-time: manual slow-motion meter", "M5",
           """The original's signature Shift-key slow-motion ("timeDistort" — the in-game tutorial explicitly teaches it). A meter-limited resource, distinct from the TimeRift powerup:

- Meter: `maxbullettime = 250` frames; drains 1/frame while held (and > 0); refills by 1/3 of max per heli kill, capped.
- Easing: game speed ramps toward 0.2x at -0.1/frame while active, back up at +0.1/frame on release — not an instant toggle.
- The player is slowed too — unlike TimeRift (#22), where the player overrides back to 1.
- TimeRift (`powerupOn == 4`) forces this same path without draining the meter.
- The game-over sequence also runs through this slow-mo (death slow-mo).
- Meter state exposed for the HUD meter (#23).

## Deliverable
Hold-key slow-motion with a draining/refilling meter that eases the whole sim to 0.2x and back.

## Acceptance criteria
- [ ] Holding the key eases the sim to 0.2x; releasing eases back to 1x (no snap)
- [ ] Meter drains while held, ends slow-mo at 0, and refills by 1/3 of max per heli kill
- [ ] The player slows with the world (unlike TimeRift)
- [ ] TimeRift triggers the same slow-mo without draining the meter

## Depends on
#3 (time-scale factor), #13 (heli kills for the refill)

## Ref
Spec §Bullet-time; decompiled AS (`maxbullettime`, `sendGameSpeed` easing).""", ["type:feature", "area:physics"]),
]


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd))
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def gh_json(*args: str) -> object:
    cmd = ["gh", *args]
    if args and args[0] != "api":
        cmd.extend(["--repo", REPO])
        if "--json" not in args:
            cmd.extend(["--json", "name"])
    result = run(cmd)
    out = (result.stdout or "").strip()
    if not out:
        return []
    return json.loads(out)


def main() -> int:
    print(f"Setting up GitHub project: {REPO}\n")

    # Labels
    existing = {item["name"] for item in gh_json("label", "list", "--limit", "100", "--json", "name")}
    for name, color, description in LABELS:
        if name in existing:
            print(f"  label exists: {name}")
            continue
        run(["gh", "label", "create", name, "--color", color, "--description", description, "--repo", REPO])
        print(f"  created label: {name}")

    # Milestones
    milestone_map: dict[str, int] = {}
    milestones = gh_json("api", f"repos/{REPO}/milestones", "--paginate")
    for ms in milestones:
        milestone_map[ms["title"]] = ms["number"]

    for title, description in MILESTONES:
        if title in milestone_map:
            print(f"  milestone exists: {title}")
            continue
        result = run([
            "gh", "api", f"repos/{REPO}/milestones",
            "-f", f"title={title}",
            "-f", f"description={description}",
        ])
        ms = json.loads(result.stdout)
        milestone_map[title] = ms["number"]
        print(f"  created milestone: {title} (#{ms['number']})")

    # Issues
    open_issues = gh_json(
        "issue", "list", "--state", "all", "--limit", "100", "--json", "number,title,state"
    )
    if len(open_issues) >= 42:
        print(f"\nRepo already has {len(open_issues)} issues — skipping issue creation.")
        return 0

    ms_key = {
        "M0": "M0 — Foundation & Tooling",
        "M1": "M1 — Core Movement & Feel",
        "M2": "M2 — Combat Core",
        "M3": "M3 — Full Arsenal",
        "M4": "M4 — Enemy Behavior & Spawning",
        "M5": "M5 — Powerups",
        "M6": "M6 — UI / HUD & Game States",
        "M7": "M7 — Audio",
        "M8": "M8 — Responsive & Multi-Input",
        "M9": "M9 — Art Modernization",
        "M10": "M10 — Juice & Polish",
        "M11": "M11 — Shipping",
    }

    for ticket in TICKETS:
        ms_title = ms_key[ticket.milestone]
        body = ticket.body + "\n\n---\n_See also: [`docs/TICKETS.md`](docs/TICKETS.md) · [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md)_"
        cmd = [
            "gh", "issue", "create",
            "--repo", REPO,
            "--title", ticket.title,
            "--body", body,
            "--milestone", ms_title,
        ]
        for label in ticket.labels:
            cmd.extend(["--label", label])
        result = run(cmd)
        url = result.stdout.strip()
        print(f"  #{ticket.num}: {ticket.title} → {url}")

    print(f"\nDone. Open: https://github.com/{REPO}/issues")
    return 0


if __name__ == "__main__":
    sys.exit(main())
