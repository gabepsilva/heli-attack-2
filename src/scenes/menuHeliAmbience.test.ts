import { describe, expect, it } from 'vitest';
import { BG_ORIGINAL_H, BG_ORIGINAL_W } from '../config/art';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import {
  createMenuHeliAmbience,
  menuHeliGunPose,
  menuHeliStagePosition,
  stepMenuHeliAmbience,
  type MenuHeliAmbienceState,
} from './menuHeliAmbience';

const AIM_X = GAME_WIDTH * 0.7;
const AIM_Y = GAME_HEIGHT * 0.7;

/** Drive `seconds` of wall time at a display refresh rate, one frame at a time. */
function runAtHz(
  state: MenuHeliAmbienceState,
  hz: number,
  seconds: number,
): void {
  const frames = Math.round(seconds * hz);
  for (let i = 0; i < frames; i += 1) {
    stepMenuHeliAmbience(state, AIM_X, AIM_Y, 1 / hz);
  }
}

function activeBullets(state: MenuHeliAmbienceState): number {
  return state.bullets.filter((b) => b.active).length;
}

describe('menu heli ambience', () => {
  it('maps the Flash loading-stage PlaceObject onto the menu plate', () => {
    const pos = menuHeliStagePosition();
    expect(pos.x).toBeCloseTo((40.35 / BG_ORIGINAL_W) * GAME_WIDTH, 5);
    expect(pos.y).toBeCloseTo((76.4 / BG_ORIGINAL_H) * GAME_HEIGHT, 5);
  });

  it('aims the door gun at the cursor and fires on the Flash cadence', () => {
    const state = createMenuHeliAmbience();
    const startDeg = state.heli.gunRotationDeg;

    runAtHz(state, 30, 1);

    expect(state.heli.gunRotationDeg).not.toBe(startDeg);
    // 30 sim frames at a 20-frame interval: shots land on frame 1 and frame 21.
    expect(activeBullets(state)).toBe(2);
  });

  it('spawns bullets on the barrel line, travelling along the gun angle', () => {
    const state = createMenuHeliAmbience();
    runAtHz(state, 30, 1 / 30); // exactly one sim frame — the first shot

    const bullet = state.bullets.find((b) => b.active);
    expect(bullet).toBeDefined();
    expect(Math.atan2(bullet!.vy, bullet!.vx)).toBeCloseTo(
      (bullet!.rotationDeg * Math.PI) / 180,
      5,
    );
    // Spawned at the muzzle, one frame downrange of the gun grip.
    const gun = menuHeliGunPose(state);
    expect(Math.hypot(bullet!.x - gun.x, bullet!.y - gun.y)).toBeGreaterThan(0);
  });

  it('runs at the same speed on a 30 Hz and a 144 Hz display', () => {
    const slow = createMenuHeliAmbience();
    const fast = createMenuHeliAmbience();
    const startDeg = fast.heli.gunRotationDeg;

    runAtHz(slow, 30, 1);
    runAtHz(fast, 144, 1);

    // A rounded per-frame step count froze the gun outright above ~66 Hz
    // (0.5 rounds up, 0.25 rounds to zero). The accumulator banks the
    // sub-frame remainder instead, so one second of wall time is one second
    // of sim at any refresh rate — give or take the one step of float
    // remainder left over from summing 144 deltas.
    expect(fast.heli.gunRotationDeg).not.toBe(startDeg);
    expect(
      Math.abs(fast.heli.gunRotationDeg - slow.heli.gunRotationDeg),
    ).toBeLessThan(1);
    expect(activeBullets(fast)).toBe(activeBullets(slow));
  });

  it('culls cosmetic bullets that leave the menu plate', () => {
    const state = createMenuHeliAmbience();
    runAtHz(state, 30, 1 / 30);
    expect(activeBullets(state)).toBe(1);

    const bullet = state.bullets.find((b) => b.active)!;
    bullet.x = GAME_WIDTH + 500;
    runAtHz(state, 30, 1 / 30);

    expect(bullet.active).toBe(false);
  });
});
