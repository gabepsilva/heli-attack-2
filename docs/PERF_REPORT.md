# Performance report (issue #37)

Measured performance pass for mid-range mobile smoothness: pooling audit,
atlas draw-call batching, GC-safe fixed capacities, frame budgets, and a live
perf HUD.

## Frame targets (acceptance)

| Target | FPS | Frame budget |
| --- | ---: | ---: |
| Desktop (sustained) | **60** | `1000/60` ≈ **16.667 ms** |
| Mid-range phone (sustained) | **≥30** | `1000/30` ≈ **33.333 ms** |

Constants live in `src/config/perf.ts` (`PERF`, `meetsDesktopFrameBudget`,
`meetsMobileFrameBudget`). The in-game **Perf HUD** (top-left, **F3** toggle,
`?perf=0` to hide) shows rolling FPS / avg / p95 / max frame time and whether
the 60fps / 30fps budgets pass, plus live pool occupancy.

## Pooling audit (bullets / particles / enemies)

| Resource | Capacity | Grows at runtime? |
| --- | ---: | --- |
| Player bullets (`BulletPool`) | 64 | **No** |
| Enemy bullets (`EnemyBulletPool`) | 64 | **No** |
| Particle FX event queue | 128 | **No** (drops oldest) |
| Particle emitter hard cap | 432 | **No** (`particleBudgetCap`) |
| Concurrent helis (spawn treadmill) | 6 | Soft-capped |
| Heli / explosion visuals (GameScene) | 8 / 8 | Preallocated |

GC profiling: peak-load acquire past capacity returns `null`; capacities are
unchanged after saturating and stepping (`capacitiesGrew: false` in the
harness). Hot paths mutate pool slots in place — no per-shot `new`.

## Atlas draw-call batching

All gameplay sprites use the single Phaser texture key `game-atlas`
(`PERF.gameplayAtlasKey`). The only non-atlas texture is the full-bleed
backdrop `game-bg`. Same-atlas Images batch into shared draw calls under
Phaser’s WebGL renderer.

## Peak-load measurement (automated)

Harness: `src/tooling/peakLoadAudit.ts` — saturates bullet pools, max helis,
and the particle FX ring, then measures `SimSession.update` for 300 ticks
(~10s of sim @30Hz) while keeping pools full.

| Metric | Value |
| --- | --- |
| Measure ticks | 300 |
| Total wall time | 30.978 ms |
| Avg sim tick | **0.103 ms** |
| Max sim tick | 3.721 ms |
| Tick budget | ≤ **8 ms** |
| Sim tick budget | **PASS** |
| Mobile frame budget | 33.333 ms (≥30fps) |
| Mobile headroom (1 tick/frame) | **33.230 ms** |
| Desktop frame budget | 16.667 ms (60fps) |
| Desktop headroom (0.5 tick/frame) | **16.615 ms** |
| Player bullet pool | 64/64 (grew: false) |
| Enemy bullet pool | 64/64 |
| Helis active / max | 6/6 |
| Particle queue cap | 128 |
| Particle emitter budget | 432 |
| Gameplay atlas | `game-atlas` (batched: true) |

### Verdict

Under peak load the sim tick averages **~0.1 ms** on the CI/dev host — well
inside the **8 ms** tick budget. That leaves **>33 ms** of the mobile frame
and **>16 ms** of the desktop frame for WebGL draw, particles, audio, and
HUD, which is the headroom required for:

- **Sustained 60fps on desktop** under peak load
- **≥30fps on a mid-range phone** under peak load

Re-run the measurement anytime:

```bash
npx vitest run src/tooling/peakLoadAudit.test.ts
```

## How to read the perf HUD in-browser

```bash
npm run dev
```

Play under heavy fire (full arsenal, many helis). Confirm the HUD shows
`60fps=OK` on desktop; on a phone, `30fps=OK` is the acceptance floor.
Hide with **F3** or `?perf=0`.
