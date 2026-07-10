/**
 * Score + hit feedback — unit tests for issue #13 acceptance criteria.
 *
 * AC: Score increases per hit (Flash `score += damage`, HUD ×100)
 * AC: A kill is unmistakable visually (hit flash + death explosion)
 */

import { describe, expect, it } from 'vitest';
import { BULLET, HELI, SCORE, WEAPONS } from '../config/constants';
import { BulletPool, arenaCullBounds } from './bullet';
import {
  createHelicopter,
  createHeliExplosion,
  damageHelicopter,
  isHeliFlashing,
  stepBulletsVsHelis,
  stepHeliExplosion,
  stepHelicopter,
  type Helicopter,
  type HeliHitEvent,
} from './helicopter';
import {
  addDamageScore,
  createScoreState,
  displayedScore,
  formatScoreHud,
} from './score';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';

const HIT_LOCAL = { x: 22, y: 2 } as const;

function hitWorld(heli: Helicopter) {
  const left = heli.x - HELI.spriteW / 2;
  const top = heli.y - HELI.spriteH / 2;
  return { x: left + HIT_LOCAL.x, y: top + HIT_LOCAL.y };
}

function fireHit(
  pool: BulletPool,
  heli: Helicopter,
  damage = BULLET.defaultDamage,
) {
  const p = hitWorld(heli);
  const slot = pool.acquire(
    p.x - BULLET.defaultSpeed,
    p.y,
    0,
    BULLET.defaultSpeed,
    damage,
  );
  expect(slot).not.toBeNull();
}

describe('score (issue #13 — damage & HUD)', () => {
  it('seeds SCORE.displayScale from Flash HUD (×100)', () => {
    expect(SCORE.displayScale).toBe(100);
    expect(WEAPONS[0].damage).toBe(10);
    expect(BULLET.defaultDamage).toBe(10);
  });

  it('increments score by exact damage dealt per hit', () => {
    const score = createScoreState();
    expect(score.value).toBe(0);

    addDamageScore(score, WEAPONS[0].damage);
    expect(score.value).toBe(10);
    expect(displayedScore(score.value)).toBe(1000);
    expect(formatScoreHud(score.value)).toBe('Score: 1000');

    addDamageScore(score, WEAPONS[0].damage);
    expect(score.value).toBe(20);
    expect(formatScoreHud(score.value)).toBe('Score: 2000');
  });

  it('ignores non-positive damage additions', () => {
    const score = createScoreState(50);
    addDamageScore(score, 0);
    addDamageScore(score, -5);
    expect(score.value).toBe(50);
  });

  it('formats HUD like Flash: Score: floor(score)*100', () => {
    expect(formatScoreHud(0)).toBe('Score: 0');
    expect(formatScoreHud(29.7)).toBe('Score: 2900');
    expect(displayedScore(300)).toBe(30_000);
  });
});

describe('hit flash & kill feedback (issue #13)', () => {
  it('flashes for HELI.hitFlashFrames after damage (Flash 1-frame white tint)', () => {
    expect(HELI.hitFlashFrames).toBe(1);

    const heli = createHelicopter(400, 180, HELI.hp);
    expect(isHeliFlashing(heli)).toBe(false);
    expect(heli.hitFlashRemaining).toBe(0);

    expect(damageHelicopter(heli, 10)).toBe(false);
    expect(heli.health).toBe(290);
    expect(heli.hitFlashRemaining).toBe(HELI.hitFlashFrames);
    expect(isHeliFlashing(heli)).toBe(true);

    // Next motion step expires the prior-frame flash (Flash lasthealth sync).
    stepHelicopter(heli, 1, 400, 400, LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX);
    expect(heli.hitFlashRemaining).toBe(0);
    expect(isHeliFlashing(heli)).toBe(false);
  });

  it('adds score on each pixel hit and spawns explosion on the fatal hit', () => {
    const heli = createHelicopter(600, 200, HELI.hp);
    const pool = new BulletPool(4);
    const bounds = arenaCullBounds(LEVEL1_WIDTH_PX, LEVEL1_HEIGHT_PX);
    const score = createScoreState();
    const events: HeliHitEvent[] = [];
    let boom: ReturnType<typeof createHeliExplosion> | null = null;

    for (let i = 0; i < 29; i += 1) {
      fireHit(pool, heli);
      stepBulletsVsHelis(pool, [heli], bounds, 1, (event) => {
        events.push(event);
        addDamageScore(score, event.damage);
        if (event.killed) {
          boom = createHeliExplosion(event.heli.x, event.heli.y);
        }
      });
      expect(heli.active).toBe(true);
      expect(score.value).toBe((i + 1) * WEAPONS[0].damage);
      expect(heli.hitFlashRemaining).toBe(HELI.hitFlashFrames);
      expect(boom).toBeNull();
    }

    fireHit(pool, heli);
    stepBulletsVsHelis(pool, [heli], bounds, 1, (event) => {
      events.push(event);
      addDamageScore(score, event.damage);
      if (event.killed) {
        boom = createHeliExplosion(event.heli.x, event.heli.y);
      }
    });

    expect(heli.active).toBe(false);
    expect(heli.health).toBe(0);
    expect(score.value).toBe(HELI.hp); // 30 × 10
    expect(displayedScore(score.value)).toBe(30_000);
    expect(formatScoreHud(score.value)).toBe('Score: 30000');
    expect(events).toHaveLength(30);
    expect(events.every((e) => e.damage === 10)).toBe(true);
    expect(events[29]!.killed).toBe(true);
    expect(boom).not.toBeNull();
    expect(boom!.active).toBe(true);
    expect(boom!.maxAge).toBe(HELI.explosionDurationFrames);
    expect(stepHeliExplosion(boom!, HELI.explosionDurationFrames)).toBe(true);
  });
});
