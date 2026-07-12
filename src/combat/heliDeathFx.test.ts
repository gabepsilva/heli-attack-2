/**
 * Flash heli kill aftermath — wreck / shards / pilot parity.
 */

import { describe, expect, it } from 'vitest';
import { HELI, HELI_DEATH, WORLD } from '../config/constants';
import {
  createFallingPilot,
  createHeliShards,
  createHeliWreck,
  spawnHeliDeathEntities,
  stepFallingPilot,
  stepHeliShard,
  stepHeliWreck,
} from './heliDeathFx';
import { createHelicopter, createSpawnRng } from './helicopter';
import { createTileMap, TILE_EMPTY, TILE_SOLID } from '../world/tileMap';

function solidFloorMap(cols = 8, rows = 6): ReturnType<typeof createTileMap> {
  const cells = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, () =>
      row === rows - 1 ? TILE_SOLID : TILE_EMPTY,
    ),
  );
  return createTileMap(cells);
}

describe('combat/heliDeathFx', () => {
  it('spawns wreck + pilot + 3 shards on kill', () => {
    const heli = createHelicopter(200, 100, HELI.hp);
    heli.xspeed = 5;
    heli.yspeed = -2;
    heli.rotationDeg = 12;
    const rng = createSpawnRng(7);
    const death = spawnHeliDeathEntities(heli, rng);
    expect(death.wreck.x).toBe(200);
    expect(death.wreck.y).toBe(100);
    expect(death.wreck.xspeed).toBe(5);
    expect(death.wreck.yspeed).toBe(-2);
    expect(death.wreck.rotationDeg).toBe(12);
    expect(death.shards).toHaveLength(HELI_DEATH.shardBurst);
    expect(death.pilot.active).toBe(true);
    expect(
      death.shards.every(
        (s) => s.look >= 0 && s.look < HELI_DEATH.shardLookCount,
      ),
    ).toBe(true);
  });

  it('heliFall accelerates, spins, and bursts on tile hit', () => {
    const map = solidFloorMap();
    const heli = createHelicopter(WORLD.tile * 2 + 10, 10, HELI.hp);
    heli.xspeed = 0;
    heli.yspeed = 0;
    const wreck = createHeliWreck(heli);
    let groundHits = 0;
    let hitY = 0;
    // Drop until floor.
    for (let i = 0; i < 200 && wreck.active; i += 1) {
      stepHeliWreck(wreck, map, 1, (_x, y) => {
        groundHits += 1;
        hitY = y;
      });
    }
    expect(groundHits).toBe(1);
    expect(wreck.active).toBe(false);
    // Flash shards at y - tile/2.
    expect(hitY).toBeCloseTo(wreck.y - WORLD.tile / 2, 5);
  });

  it('shardFrame bounces and dies after 3 floor hits', () => {
    const map = solidFloorMap();
    const rng = createSpawnRng(3);
    const [shard] = createHeliShards(WORLD.tile * 2, 20, 1, rng);
    expect(shard).toBeDefined();
    const metal: number[] = [];
    const counter = { value: 0 };
    for (let i = 0; i < 400 && shard!.active; i += 1) {
      stepHeliShard(shard!, map, 1, counter, rng, (index) => {
        metal.push(index);
      });
    }
    expect(shard!.active).toBe(false);
    expect(shard!.bounces).toBeGreaterThanOrEqual(HELI_DEATH.shardMaxBounces);
    expect(metal.every((m) => m >= 0 && m < HELI_DEATH.metalSoundCount)).toBe(
      true,
    );
  });

  it('rings one metal clang per 3 bounces, counted across all shards', () => {
    // Flash `!((sbounce++)%3)`: the counter is a global, so a burst rings a few
    // times in total rather than restarting the gate for each shard.
    const map = solidFloorMap();
    const rng = createSpawnRng(11);
    const counter = { value: 0 };
    const shards = createHeliShards(WORLD.tile * 2, 20, 4, rng);
    let clangs = 0;
    for (let i = 0; i < 400; i += 1) {
      for (const shard of shards) {
        if (shard.active) {
          stepHeliShard(shard, map, 1, counter, rng, () => {
            clangs += 1;
          });
        }
      }
    }
    expect(shards.every((s) => !s.active)).toBe(true);
    // The counter ticks exactly once per bounce, so it is the bounce total.
    const bounces = counter.value;
    expect(bounces).toBeGreaterThan(HELI_DEATH.metalBounceInterval);
    expect(clangs).toBe(Math.ceil(bounces / HELI_DEATH.metalBounceInterval));
  });

  it('guyFall settles when vertical speed is low', () => {
    const map = solidFloorMap();
    const heli = createHelicopter(WORLD.tile * 3, 20, HELI.hp);
    const rng = createSpawnRng(1);
    const pilot = createFallingPilot(heli, rng);
    // Force a soft landing path: already nearly stopped on the floor.
    pilot.x = WORLD.tile * 3;
    pilot.y = (map.height - 1) * WORLD.tile - 1;
    pilot.xspeed = 0;
    pilot.yspeed = 2;
    expect(stepFallingPilot(pilot, map, 1)).toBe(true);
    expect(pilot.active).toBe(false);
  });
});
