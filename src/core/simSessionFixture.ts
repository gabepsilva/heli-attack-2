/**
 * Shared fixture for suites that exercise mid-run combat.
 *
 * A fresh {@link SimSession} opens in the Flash `heroStart` parachute drop:
 * the player falls from `y = -50` under the canopy, cannot walk or fire, and
 * the sky stays empty until the chute collapses. Tests about shooting,
 * powerups, or scoring all want the state *after* that intro, so they skip it
 * here instead of each simulating the descent — and so a future change to the
 * intro touches one file rather than every combat suite.
 */

import { ensureHeliPopulation } from '../combat/heliSpawn';
import { PLAYER_SPAWN } from '../player/player';
import { LEVEL1_HEIGHT_PX, LEVEL1_WIDTH_PX } from '../world/level1';
import { SimSession } from './simSession';

/**
 * Y that drops the player in-bounds just above the floor. The real spawn
 * ({@link PLAYER_SPAWN}) sits at -50, above the tile grid, which only makes
 * sense while the chute owns motion.
 */
export const COMBAT_SPAWN_Y = 200;

/**
 * Skip `heroStart` on an existing session and seed the opening helicopter —
 * the same handoff `update` performs when the canopy finishes collapsing.
 * Call after {@link SimSession.reset}, which re-arms the parachute.
 */
export function enterCombat(session: SimSession): void {
  session.player.endParachute();
  session.player.placeAt(PLAYER_SPAWN.x, COMBAT_SPAWN_Y);
  ensureHeliPopulation(
    session.helicopters,
    session.heliSpawn,
    LEVEL1_WIDTH_PX,
    LEVEL1_HEIGHT_PX,
    session.spawnRng,
  );
}

/** A session past the spawn parachute, with one helicopter in the sky. */
export function createCombatSession(): SimSession {
  const session = new SimSession();
  enterCombat(session);
  return session;
}
