# Heli Attack 2 — Migration Plan

A phased, incremental plan to rebuild Heli Attack 2 as a modern web game.

> **Tickets live as [GitHub issues](https://github.com/gabepsilva/heli-attack-2/issues)**
> — one issue per ticket, grouped into GitHub milestones M0–M11. The issues are the
> single source of truth for scope, acceptance criteria, and dependencies. This
> document keeps only what issues can't hold: the porting principles, the definition
> of done, deliberate scope cuts, and the milestone map.

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

## Deliberate cuts (out of scope, by decision)

The original had a couple of features we are **intentionally not** porting 1:1. These
are decisions, not oversights:

- **Key rebinding.** The original stored rebindable controls in a SharedObject. We ship
  fixed default controls (←/→ move, ↑ jump, ↓ duck, Ctrl boost, Shift bullet-time,
  mouse aim/fire). The input-intent layer (#29) is built so rebinding *could* be added
  later, but no rebinding UI is planned.
- **Audio: master volume + mute only.** No per-channel mixer; #26 delivers a single
  master volume plus mute — enough for a web arcade game.

If either is later wanted, #29 (input) and #26 (audio) are the natural homes.

## Milestone map

| # | Milestone | Outcome | Tickets |
|---|---|---|---|
| M0 | Foundation & Tooling | Empty Phaser game + local tooling + fixed loop | #1–#3 |
| M1 | Core Movement & Feel ⭐ | Player moves exactly like the original | #4–#8 |
| M2 | Combat Core | Shoot a heli, it dies, score up | #9–#13 |
| M3 | Full Arsenal | All 14 weapons | #14–#17 |
| M4 | Enemy Behavior & Spawning | Relentless heli treadmill + real level | #18–#20, #41 |
| M5 | Powerups | Drops + power states + bullet-time | #21, #22, #42 |
| M6 | UI / HUD & Game States | Full menu→play→gameover loop | #23–#25 |
| M7 | Audio | Sounds like HA2 | #26–#27 |
| M8 | Responsive & Multi-Input | Desktop + mobile + gamepad | #28–#31 |
| M9 | Art Modernization | Hi-res 1080p art | #32–#34 |
| M10 | Juice & Polish | Particles, shake, perf | #35–#37 |
| M11 | Shipping | Web + Steam | #38–#40 |

**M1 exit check:** movement feels like Heli Attack 2 to someone who remembers it.
**Playable-vertical-slice** (fun, judgeable) is reached at the end of **M2**.
**Feature-complete** at **M6+M7**. **Ship-ready** at **M11**.
