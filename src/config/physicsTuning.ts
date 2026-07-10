/**
 * Live physics tuning harness (issue #8).
 *
 * Mutates the shared {@link WORLD} / {@link PLAYER} objects so every physics
 * module that reads those constants picks up edits on the next sim tick —
 * no reload required. Spec seeds stay in {@link WORLD_DEFAULTS} /
 * {@link PLAYER_DEFAULTS}; {@link resetTunables} restores them.
 */

import {
  PLAYER,
  PLAYER_DEFAULTS,
  WORLD,
  WORLD_DEFAULTS,
  resetPhysicsConstants,
} from './constants';

/** Tunable keys exposed by the debug overlay / query-param harness. */
export const TUNABLE_KEYS = [
  'gravity',
  'terminal',
  'walkAccel',
  'walkCap',
  'hardCap',
  'friction',
  'jumpVel',
  'jumpHoldFrames',
  'boostVel',
  'boostChargeFrames',
] as const;

export type TunableKey = (typeof TUNABLE_KEYS)[number];

type WorldTunableKey = 'gravity' | 'terminal';
type PlayerTunableKey = Exclude<TunableKey, WorldTunableKey>;

const WORLD_KEYS: ReadonlySet<TunableKey> = new Set(['gravity', 'terminal']);

/** Human-readable labels for the overlay form. */
export const TUNABLE_LABELS: Record<TunableKey, string> = {
  gravity: 'gravity',
  terminal: 'terminal',
  walkAccel: 'walkAccel',
  walkCap: 'walkCap',
  hardCap: 'hardCap',
  friction: 'friction',
  jumpVel: 'jumpVel',
  jumpHoldFrames: 'jumpHoldFrames',
  boostVel: 'boostVel',
  boostChargeFrames: 'boostChargeFrames',
};

export function isTunableKey(key: string): key is TunableKey {
  return (TUNABLE_KEYS as readonly string[]).includes(key);
}

function isWorldTunable(key: TunableKey): key is WorldTunableKey {
  return WORLD_KEYS.has(key);
}

/** Current live value for a tunable (reads WORLD / PLAYER). */
export function getTunable(key: TunableKey): number {
  if (isWorldTunable(key)) {
    return WORLD[key];
  }
  return PLAYER[key];
}

/** Spec-default value for a tunable (immutable seed). */
export function getTunableDefault(key: TunableKey): number {
  if (isWorldTunable(key)) {
    return WORLD_DEFAULTS[key];
  }
  return PLAYER_DEFAULTS[key];
}

/**
 * Set a live tunable. Rejects non-finite numbers. Integer-ish keys
 * (`jumpHoldFrames`, `boostChargeFrames`) are truncated toward zero.
 */
export function setTunable(key: TunableKey, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`tunable ${key} must be a finite number`);
  }

  const next =
    key === 'jumpHoldFrames' || key === 'boostChargeFrames'
      ? Math.trunc(value)
      : value;

  if (isWorldTunable(key)) {
    WORLD[key] = next;
    return;
  }

  const playerKey: PlayerTunableKey = key;
  PLAYER[playerKey] = next;
}

/** Snapshot of every tunable → current live value. */
export function getAllTunables(): Record<TunableKey, number> {
  const out = {} as Record<TunableKey, number>;
  for (const key of TUNABLE_KEYS) {
    out[key] = getTunable(key);
  }
  return out;
}

/** Restore every physics constant to the exact spec seed. */
export function resetTunables(): void {
  resetPhysicsConstants();
}

/**
 * Apply query-string overrides (`?gravity=2&jumpVel=-12`).
 * Unknown keys are ignored; invalid numbers are skipped.
 * Returns the keys that were successfully applied.
 */
export function applyTunablesFromSearch(
  search: string | URLSearchParams,
): TunableKey[] {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;

  const applied: TunableKey[] = [];
  for (const key of TUNABLE_KEYS) {
    const raw = params.get(key);
    if (raw === null || raw === '') {
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      continue;
    }
    setTunable(key, value);
    applied.push(key);
  }
  return applied;
}

/**
 * Parse whether debug info should start visible.
 * Absent → hidden (clean play); `?debug` / `1` / `true` / `on` → shown;
 * `?debug=0` / `false` / `off` / `no` → hidden.
 */
export function parseDebugOverlayVisible(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  const raw = params.get('debug');
  if (raw === null) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return !(
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'off' ||
    normalized === 'no'
  );
}
