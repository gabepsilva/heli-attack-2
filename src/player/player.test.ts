import { describe, expect, it } from 'vitest';
import { PLAYER, WORLD } from '../config/constants';
import { createTestArena } from '../world/testArena';
import { DUCK_SIZE, STAND_SIZE } from './duckPhysics';
import { PLAYER_SPAWN, Player } from './player';

/** Settle onto the floor of the test arena. */
function settle(player: Player, frames = 40): void {
  const map = createTestArena();
  player.input = {
    left: false,
    right: false,
    jump: false,
    duck: false,
    boost: false,
  };
  for (let i = 0; i < frames; i += 1) {
    player.step(map, 1);
  }
}

/** Peak height reached during a jump (lowest body.y while airborne). */
function measureJumpPeak(
  holdFrames: number,
  totalFrames = 80,
): { peakRise: number; landed: boolean } {
  const map = createTestArena();
  const player = new Player(100, 200);
  settle(player);
  expect(player.body.onGround).toBe(true);
  const groundY = player.body.y;

  let peakY = groundY;
  for (let i = 0; i < totalFrames; i += 1) {
    player.input = {
      left: false,
      right: false,
      jump: i < holdFrames,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    if (player.body.y < peakY) {
      peakY = player.body.y;
    }
  }

  return {
    peakRise: groundY - peakY,
    landed: player.body.onGround,
  };
}

describe('Player (gravity, jump, duck — issue #6)', () => {
  it('uses the spec collision box 10×42 at the default spawn', () => {
    const player = new Player();
    expect(player.body.w).toBe(PLAYER.boxW);
    expect(player.body.h).toBe(PLAYER.boxH);
    expect(player.body.w).toBe(10);
    expect(player.body.h).toBe(42);
    expect(player.body.x).toBe(PLAYER_SPAWN.x);
    expect(player.body.y).toBe(PLAYER_SPAWN.y);
    // Original map1 spawn: tile-center of col 0 → body left = 25 - 5 = 20.
    expect(PLAYER_SPAWN.x).toBe(20);
    expect(PLAYER_SPAWN.y).toBe(200);
  });

  it('applies gravity +1/frame² and clamps terminal fall at 50', () => {
    const map = createTestArena();
    // High above the floor so we can free-fall for many frames.
    const player = new Player(100, 50);
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    const vySeq: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      player.step(map, 1);
      vySeq.push(player.body.vy);
      if (player.body.onGround) {
        break;
      }
    }

    // First frames: 1, 2, 3… before floor contact.
    expect(vySeq.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    // Terminal must never exceed tileHeight / WORLD.terminal.
    expect(Math.max(...vySeq)).toBeLessThanOrEqual(WORLD.terminal);
    expect(WORLD.terminal).toBe(50);
    expect(WORLD.gravity).toBe(1);
  });

  it('caps a long fall at exactly 50 before floor contact', () => {
    const map = createTestArena();
    // Start with near-terminal speed in open air (row 0–11 empty above floor).
    const player = new Player(400, 10);
    player.body.vy = 48;
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    player.step(map, 1); // gravity → 49, then resolve
    expect(player.body.vy).toBeLessThanOrEqual(WORLD.terminal);

    player.body.vy = 49;
    player.body.y = 10;
    player.body.onGround = false;
    player.step(map, 1); // gravity → 50
    expect(player.body.vy).toBe(WORLD.terminal);

    player.body.vy = 60; // overshoot before clamp
    player.body.y = 10;
    player.body.onGround = false;
    player.step(map, 1); // gravity 61 → clamp 50
    // If still airborne, vy must be terminal; if landed, 0.
    if (!player.body.onGround) {
      expect(player.body.vy).toBe(WORLD.terminal);
    } else {
      expect(player.body.vy).toBe(0);
    }
  });

  it('produces a visibly shorter hop on tap than a full 6-frame hold', () => {
    const tap = measureJumpPeak(1);
    const full = measureJumpPeak(6);

    expect(tap.landed).toBe(true);
    expect(full.landed).toBe(true);
    // Full hold must clear a meaningfully higher apex (acceptance: visibly different).
    expect(full.peakRise).toBeGreaterThan(tap.peakRise + 10);
    // Sanity: tap still leaves the ground.
    expect(tap.peakRise).toBeGreaterThan(5);
  });

  it('burns both jumps on ceiling contact', () => {
    const map = createTestArena();
    // Under the floating platform (row 3, cols 9–14) — rise into it.
    const player = new Player(500, 4 * WORLD.tile);
    player.body.onGround = false;
    player.jumpState.jump = true;
    player.jumpState.jump2 = false;
    player.jumpState.up = 0;
    player.body.vy = -20;
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    let hitCeiling = false;
    for (let i = 0; i < 15; i += 1) {
      player.step(map, 1);
      if (player.body.onCeiling) {
        hitCeiling = true;
        break;
      }
    }

    expect(hitCeiling).toBe(true);
    expect(player.jumpState.jump).toBe(true);
    expect(player.jumpState.jump2).toBe(true);
    expect(player.jumpState.up).toBe(0);
  });

  it('resets jump flags on landing so a fresh jump is available', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);

    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump).toBe(true);
    expect(player.body.onGround).toBe(false);

    // Fall back down.
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    for (let i = 0; i < 80; i += 1) {
      player.step(map, 1);
      if (player.body.onGround) {
        break;
      }
    }
    expect(player.body.onGround).toBe(true);
    expect(player.jumpState.jump).toBe(false);
    expect(player.jumpState.jump2).toBe(false);
  });

  it('allows a double-jump after releasing mid-air', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);

    // First jump — hold briefly then release.
    for (let i = 0; i < 3; i += 1) {
      player.input = {
        left: false,
        right: false,
        jump: true,
        duck: false,
        boost: false,
      };
      player.step(map, 1);
    }
    expect(player.jumpState.jump).toBe(true);
    expect(player.jumpState.jump2).toBe(false);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.up).toBe(PLAYER.jumpHoldFrames);

    // Second press consumes jump2 and re-clamps to −8.
    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump2).toBe(true);
    // After jump clamp (−8) + gravity (+1) → −7 before resolve.
    expect(player.body.vy).toBe(PLAYER.jumpVel + WORLD.gravity);
  });

  it('allows a double-jump but not a triple-jump (issue #7)', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);

    // Jump 1
    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump).toBe(true);
    expect(player.jumpState.jump2).toBe(false);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    player.step(map, 1);

    // Jump 2
    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump2).toBe(true);
    const vyAfterDouble = player.body.vy;

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    // After both jumps spent, hold window stays 0 — no refill.
    expect(player.jumpState.up).toBe(0);

    // Jump 3 attempt — no −8 clamp, only gravity.
    const vyBefore = player.body.vy;
    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump2).toBe(true);
    expect(player.body.vy).toBe(vyBefore + WORLD.gravity);
    expect(player.body.vy).not.toBe(PLAYER.jumpVel + WORLD.gravity);
    // Double-jump did apply the −8 clamp earlier.
    expect(vyAfterDouble).toBe(PLAYER.jumpVel + WORLD.gravity);
  });

  it('fires a charged hyper-jump at −32 and refills over 150 frames (~5s)', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);
    expect(player.boostState.charge).toBe(PLAYER.boostChargeFrames);

    // Fire from the ground.
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: true,
    };
    player.step(map, 1);
    // boost −32 + gravity +1 → −31 before resolve (may still be airborne).
    expect(player.boostState.charge).toBe(0);
    expect(player.boostState.hjump).toBe(true);
    expect(player.jumpState.jump).toBe(true);
    expect(player.body.vy).toBe(PLAYER.boostVel + WORLD.gravity);

    // Holding boost must not re-fire while airborne / uncharged.
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: true,
    };
    player.step(map, 1);
    expect(player.boostState.charge).toBe(1);

    // Land and wait for a full refill (150 frames @ 30 Hz ≈ 5s).
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    for (let i = 0; i < 400; i += 1) {
      player.step(map, 1);
      if (
        player.body.onGround &&
        player.boostState.charge >= PLAYER.boostChargeFrames
      ) {
        break;
      }
    }
    expect(player.body.onGround).toBe(true);
    expect(player.boostState.hjump).toBe(false);
    expect(player.boostState.charge).toBe(PLAYER.boostChargeFrames);

    // Dump the meter, then press boost while only partially recharged.
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: true,
    };
    player.step(map, 1);
    expect(player.boostState.charge).toBe(0);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    // Force a grounded partial-charge state so fall time cannot inflate the meter.
    for (let i = 0; i < 120; i += 1) {
      player.step(map, 1);
      if (player.body.onGround) {
        break;
      }
    }
    expect(player.body.onGround).toBe(true);
    player.boostState.charge = 50;
    player.boostState.hjump = false;
    player.jumpState.jump = false;
    player.jumpState.jump2 = false;

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: true,
    };
    player.step(map, 1);
    // Charge ticks 50→51; still below 150 → no −32 burst.
    expect(player.boostState.charge).toBe(51);
    expect(player.boostState.hjump).toBe(false);
    expect(player.body.vy).not.toBe(PLAYER.boostVel + WORLD.gravity);
  });

  it('stays grounded with unchanged feet through a duck → stand cycle', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);
    expect(player.body.onGround).toBe(true);
    const feetBefore = player.body.y + player.body.h;

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: true,
      boost: false,
    };
    player.step(map, 1);
    expect(player.ducking).toBe(true);
    expect(player.body.onGround).toBe(true);
    expect(player.body.y + player.body.h).toBeCloseTo(feetBefore, 10);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.ducking).toBe(false);
    expect(player.body.onGround).toBe(true);
    expect(player.body.y + player.body.h).toBeCloseTo(feetBefore, 10);
    expect(player.jumpState.jump).toBe(false);
    expect(player.jumpState.jump2).toBe(false);
  });

  it('stands up after bonking a ceiling while ducked', () => {
    const map = createTestArena();
    const player = new Player(500, 4 * WORLD.tile);
    player.body.onGround = false;
    player.body.vy = -20;
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: true,
      boost: false,
    };

    let hitCeiling = false;
    for (let i = 0; i < 20; i += 1) {
      player.step(map, 1);
      if (player.body.onCeiling) {
        hitCeiling = true;
        break;
      }
    }
    expect(hitCeiling).toBe(true);
    expect(player.ducking).toBe(true);
    expect(player.body.h).toBeCloseTo(DUCK_SIZE.h, 10);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    for (let i = 0; i < 30; i += 1) {
      player.step(map, 1);
    }
    expect(player.ducking).toBe(false);
    expect(player.body.h).toBe(STAND_SIZE.h);
  });

  it('does not soft-lock when ducking near a wall and releasing duck', () => {
    const map = createTestArena();
    const player = new Player(60, 12 * WORLD.tile - PLAYER.boxH - 1);
    player.body.onGround = true;
    player.input = {
      left: true,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    for (let i = 0; i < 12; i += 1) {
      player.step(map, 1);
    }
    const duckX = player.body.x;
    expect(duckX).toBeLessThanOrEqual(WORLD.tile + 5);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: true,
      boost: false,
    };
    player.step(map, 1);
    expect(player.ducking).toBe(true);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    for (let i = 0; i < 60; i += 1) {
      player.step(map, 1);
    }
    expect(player.ducking).toBe(false);
    expect(player.body.w).toBe(STAND_SIZE.w);

    const pinnedX = player.body.x;
    player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    for (let i = 0; i < 120; i += 1) {
      player.step(map, 1);
    }
    expect(player.body.x).toBeGreaterThan(pinnedX);
    expect(player.ducking).toBe(false);
  });

  it('does not burn double-jump after repeated duck taps on flat ground', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);
    expect(player.body.onGround).toBe(true);

    for (let tap = 0; tap < 3; tap += 1) {
      player.input = {
        left: false,
        right: false,
        jump: false,
        duck: true,
        boost: false,
      };
      player.step(map, 1);
      player.input = {
        left: false,
        right: false,
        jump: false,
        duck: false,
        boost: false,
      };
      player.step(map, 1);
    }

    expect(player.body.onGround).toBe(true);
    expect(player.jumpState.jump).toBe(false);
    expect(player.jumpState.jump2).toBe(false);

    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.jump).toBe(true);
    expect(player.jumpState.jump2).toBe(false);
  });

  it('holding duck shrinks the hitbox and blocks walking accel', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);

    player.input = {
      left: false,
      right: true,
      jump: false,
      duck: true,
      boost: false,
    };
    for (let i = 0; i < 5; i += 1) {
      player.step(map, 1);
    }

    expect(player.ducking).toBe(true);
    expect(player.body.w).toBeCloseTo(DUCK_SIZE.w, 10);
    expect(player.body.h).toBeCloseTo(DUCK_SIZE.h, 10);
    expect(player.body.vx).toBe(0); // no accel while ducked
  });

  it('blocks double-jump refill while ducking airborne (up stays 0)', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);

    // First jump — full 6-frame hold, then release (up refills to 6).
    for (let i = 0; i < 6; i += 1) {
      player.input = {
        left: false,
        right: false,
        jump: true,
        duck: false,
        boost: false,
      };
      player.step(map, 1);
    }
    expect(player.jumpState.jump).toBe(true);
    expect(player.jumpState.jump2).toBe(false);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.up).toBe(PLAYER.jumpHoldFrames);

    // Duck mid-air — refill blocked, so up zeroes on release.
    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: true,
      boost: false,
    };
    player.step(map, 1);
    expect(player.jumpState.up).toBe(0);

    // Press jump while ducking with up=0 — no double-jump.
    const vyBefore = player.body.vy;
    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: true,
      boost: false,
    };
    player.step(map, 1);
    expect(player.ducking).toBe(true);
    expect(player.jumpState.jump2).toBe(false);
    expect(player.body.vy).toBe(vyBefore + WORLD.gravity);
  });

  it('allows a crouch hop from the ground while holding duck', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);
    expect(player.body.onGround).toBe(true);
    const feetBefore = player.body.y + player.body.h;

    player.input = {
      left: false,
      right: false,
      jump: true,
      duck: true,
      boost: false,
    };
    player.step(map, 1);

    expect(player.ducking).toBe(true);
    expect(player.jumpState.jump).toBe(true);
    expect(player.body.vy).toBe(PLAYER.jumpVel + WORLD.gravity);
    expect(player.body.onGround).toBe(false);
    expect(player.body.y + player.body.h).toBeLessThan(feetBefore);
  });

  it('ramps vx to the walk cap under right input, then decays to 0 on release', () => {
    const map = createTestArena();
    const player = new Player(100, 200);
    settle(player);
    expect(player.body.onGround).toBe(true);

    player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    const ramp: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      player.step(map, 1);
      ramp.push(player.body.vx);
    }
    expect(ramp).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(player.body.vx).toBe(PLAYER.walkCap);

    player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    const decay: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      player.step(map, 1);
      decay.push(player.body.vx);
    }
    expect(decay).toEqual([4, 3, 2, 1, 0, 0]);
    expect(player.body.vx).toBe(0);
  });

  it('is blocked by walls and zeroes vx on impact', () => {
    const map = createTestArena();
    const player = new Player(60, 12 * WORLD.tile - PLAYER.boxH - 1);
    player.body.onGround = true;
    player.body.vx = -PLAYER.walkCap;
    player.input = {
      left: true,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };

    for (let i = 0; i < 30; i += 1) {
      player.step(map, 1);
    }

    expect(player.body.x).toBe(WORLD.tile - 1);
    expect(player.body.vx).toBe(0);
  });

  it('placeAt clears velocity, duck, jump, and boost for a clean reset', () => {
    const player = new Player();
    player.body.vx = 5;
    player.body.vy = 9;
    player.body.onGround = true;
    player.ducking = true;
    player.body.w = DUCK_SIZE.w;
    player.body.h = DUCK_SIZE.h;
    player.jumpState.jump = true;
    player.jumpState.jump2 = true;
    player.jumpState.up = 0;
    player.boostState.charge = 0;
    player.boostState.hjump = true;
    player.placeAt(200, 100);

    expect(player.body.x).toBe(200);
    expect(player.body.y).toBe(100);
    expect(player.body.vx).toBe(0);
    expect(player.body.vy).toBe(0);
    expect(player.body.onGround).toBe(false);
    expect(player.body.w).toBe(STAND_SIZE.w);
    expect(player.body.h).toBe(STAND_SIZE.h);
    expect(player.ducking).toBe(false);
    expect(player.jumpState.jump).toBe(false);
    expect(player.jumpState.jump2).toBe(false);
    expect(player.jumpState.up).toBe(PLAYER.jumpHoldFrames);
    expect(player.boostState.charge).toBe(PLAYER.boostChargeFrames);
    expect(player.boostState.hjump).toBe(false);
  });
});
