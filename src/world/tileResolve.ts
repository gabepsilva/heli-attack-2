import { WORLD } from '../config/constants';
import type { AabbBody } from './aabbBody';
import { hitCheck } from './hitCheck';
import type { TileMap } from './tileMap';

/**
 * Classic HA2 AABB tile resolve (from `hero` X/Y collision in the decompiled AS).
 *
 * Order: clamp speed to one tile → resolve X (walls) → resolve Y (floors/ceilings).
 * Predicting destination tiles *before* committing the move, combined with the
 * terminal clamp of {@link WORLD.terminal} (== tile size), is what prevents
 * tunneling through a solid tile at full fall speed.
 *
 * `timeStep` scales displacement (and is 1 under normal play). Tile probes use
 * the unscaled velocity like the original (`xchange` / `ychange` before `* timeStep`).
 */
export function resolveAabbAgainstTiles(
  map: TileMap,
  body: AabbBody,
  timeStep: number,
): void {
  const tile = map.tileSize;

  // Terminal fall / rise clamp — spec: clamped to tileHeight (50).
  if (body.vy > WORLD.terminal) {
    body.vy = WORLD.terminal;
  }
  if (body.vy < -WORLD.terminal) {
    body.vy = -WORLD.terminal;
  }
  if (body.vx > tile) {
    body.vx = tile;
  }
  if (body.vx < -tile) {
    body.vx = -tile;
  }

  const xchange = body.vx;
  const ychange = body.vy;
  body.onGround = false;

  resolveX(map, body, xchange, timeStep, tile);
  resolveY(map, body, ychange, timeStep, tile);
}

function resolveX(
  map: TileMap,
  body: AabbBody,
  xchange: number,
  timeStep: number,
  tile: number,
): void {
  if (xchange === 0) {
    return;
  }

  // Probe with +1 on top like the original (avoids false wall hits while grounded).
  const tiley = Math.floor((body.y + 1) / tile);
  const tile2y = Math.floor((body.y + body.h) / tile);

  if (xchange > 0) {
    const tile2x = Math.floor((body.x + xchange + body.w) / tile);
    const hits =
      tile2x >= map.width
        ? 1
        : hitCheck(map, tiley, tile2x, tile2y, tile2x, 1, 1, 1);
    if (!hits) {
      body.x += xchange * timeStep;
    } else {
      // Snap so the body's right edge sits 1px left of the solid tile column.
      body.x = tile2x * tile - body.w - 1;
      body.vx = 0;
    }
  } else {
    const tilex = Math.floor((body.x + xchange) / tile);
    const hits =
      tilex < 0 ? 1 : hitCheck(map, tiley, tilex, tile2y, tilex, 1, 1, 1);
    if (!hits) {
      body.x += xchange * timeStep;
    } else {
      // Original: (tilex+1)*tileWidth - 1 (when sprite == hitbox width).
      body.x = (tilex + 1) * tile - 1;
      body.vx = 0;
    }
  }
}

function resolveY(
  map: TileMap,
  body: AabbBody,
  ychange: number,
  timeStep: number,
  tile: number,
): void {
  if (ychange === 0) {
    return;
  }

  // Recompute X span after possible X snap (original does this).
  const tilex = Math.floor((body.x + 1) / tile);
  const tile2x = Math.floor((body.x + body.w) / tile);

  if (ychange > 0) {
    const tile2y = Math.floor((body.y + ychange + body.h) / tile);
    if (!hitCheck(map, tile2y, tilex, tile2y, tile2x, 0)) {
      body.y += ychange * timeStep;
    } else {
      // Snap so the body's bottom sits 1px above the solid tile row.
      body.y = tile2y * tile - body.h - 1;
      body.vy = 0;
      body.onGround = true;
    }
  } else {
    const tiley = Math.floor((body.y + ychange) / tile);
    if (!hitCheck(map, tiley, tilex, tiley, tile2x, 0)) {
      body.y += ychange * timeStep;
    } else {
      // Original: (tiley+1)*tileHeight - 1 (when sprite == hitbox height).
      body.y = (tiley + 1) * tile - 1;
      body.vy = 0;
    }
  }
}
