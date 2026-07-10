/**
 * Flash-accurate game-event → catalog sound mapping (issue #27).
 *
 * Weapon fire ids match decompiled `guns[i].sound` (sgun / sshotgun / …).
 * Pickup VO ids match `sp*` SoundBoard names. One-shot combat cues match
 * `shjump` / `shurt` / `sheliboom`.
 */

import type { PowerupCollectResult } from '../combat/powerupDrop';
import { POWERUP } from '../config/constants';
import { WEAPON_COUNT } from '../config/weapons';
import type { SoundId } from './catalog';

/**
 * Fire SFX per arsenal index — Flash `guns[0..13].sound`.
 * `null` = FireMines (no fire sound). ShotgunRockets / RPG use rocket /
 * grenade respectively (not the pickup VO filenames).
 */
export const WEAPON_FIRE_SOUNDS: readonly (SoundId | null)[] = [
  'gun', // 0 MachineGun — sgun
  'gun', // 1 AkimboMac10 — sgun
  'shotgun', // 2 Shotgun — sshotgun
  'rocket', // 3 ShotgunRockets — srocket
  'grenade', // 4 GrenadeLauncher — sgrenade
  'grenade', // 5 RPG — sgrenade
  'rocket', // 6 RocketLauncher — srocket
  'rocket', // 7 SeekerLauncher — srocket
  'flame', // 8 FlameThrower — sflame (soundhold)
  null, // 9 FireMines — sound:null
  'rocket', // 10 A-BombLauncher — srocket
  'railgun', // 11 RailGun — srailgun
  'grapple', // 12 GrappleCannon — sgrapple
  'railgun', // 13 ShoulderCannon — srailgun
] as const;

/** Weapon pickup VO — Flash `spmac10` … `spgrapplecannon` by gun index. */
export const WEAPON_PICKUP_SOUNDS: Readonly<Record<number, SoundId>> = {
  1: 'spmac10',
  2: 'spshotgun',
  3: 'spshotgunrockets',
  4: 'spgrenadelauncher',
  5: 'sprpg',
  6: 'sprocketlauncher',
  7: 'spseekerlauncher',
  8: 'spflamethrower',
  9: 'spfiremines',
  10: 'spabomb',
  11: 'sprailgun',
  12: 'spgrapplecannon',
};

/** Timed state pickup VO — Flash `sptridamage` … `spjetpack` by powerupOn. */
export const STATE_PICKUP_SOUNDS: Readonly<Record<number, SoundId>> = {
  [POWERUP.TriDamage]: 'sptridamage',
  [POWERUP.Invulnerability]: 'spinvulnerability',
  [POWERUP.PredatorMode]: 'sppredatormode',
  [POWERUP.TimeRift]: 'sptimerift',
  [POWERUP.Jetpack]: 'spjetpack',
};

/** Health crate pickup — Flash `sphealth`. */
export const HEALTH_PICKUP_SOUND: SoundId = 'sphealth';

/** Hyper-jump burst — Flash `shjump`. */
export const HYPER_JUMP_SOUND: SoundId = 'hjump';

/** Player took damage — Flash `shurt`. */
export const HURT_SOUND: SoundId = 'hurt';

/** Helicopter destroyed — Flash `sheliboom`. */
export const HELI_BOOM_SOUND: SoundId = 'heliboom';

/** Arsenal indices whose fire SFX is a held loop (Flash `soundhold:1`). */
export const WEAPON_FIRE_HOLD: ReadonlySet<number> = new Set([8]);

/** Discrete cues the sim queues for the audio binder. */
export type GameAudioEvent =
  | { type: 'weaponFire'; weaponIndex: number }
  | { type: 'hyperJump' }
  | { type: 'hurt' }
  | { type: 'heliBoom' }
  | { type: 'powerup'; collect: PowerupCollectResult };

/** Resolve a weapon fire to its catalog id, or null when silent. */
export function soundForWeaponFire(weaponIndex: number): SoundId | null {
  if (weaponIndex < 0 || weaponIndex >= WEAPON_FIRE_SOUNDS.length) {
    return null;
  }
  return WEAPON_FIRE_SOUNDS[weaponIndex] ?? null;
}

/** True when this arsenal slot uses Flash soundhold (loop + volume gate). */
export function weaponFireIsHold(weaponIndex: number): boolean {
  return WEAPON_FIRE_HOLD.has(weaponIndex);
}

/** Resolve a powerup collect result to its Flash pickup VO. */
export function soundForPowerupCollect(
  collect: PowerupCollectResult,
): SoundId | null {
  if (collect.kind === 'health') {
    return HEALTH_PICKUP_SOUND;
  }
  if (collect.kind === 'weapon') {
    return WEAPON_PICKUP_SOUNDS[collect.amount] ?? null;
  }
  return STATE_PICKUP_SOUNDS[collect.amount] ?? null;
}

/** Resolve one queued event to a one-shot catalog id (hold flame excluded). */
export function soundForAudioEvent(event: GameAudioEvent): SoundId | null {
  switch (event.type) {
    case 'weaponFire':
      if (weaponFireIsHold(event.weaponIndex)) {
        return null;
      }
      return soundForWeaponFire(event.weaponIndex);
    case 'hyperJump':
      return HYPER_JUMP_SOUND;
    case 'hurt':
      return HURT_SOUND;
    case 'heliBoom':
      return HELI_BOOM_SOUND;
    case 'powerup':
      return soundForPowerupCollect(event.collect);
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Spec sanity — table length matches the 14-gun arsenal. */
export function eventMapMatchesFlashArsenal(): boolean {
  return (
    WEAPON_FIRE_SOUNDS.length === WEAPON_COUNT &&
    WEAPON_FIRE_SOUNDS[0] === 'gun' &&
    WEAPON_FIRE_SOUNDS[3] === 'rocket' &&
    WEAPON_FIRE_SOUNDS[5] === 'grenade' &&
    WEAPON_FIRE_SOUNDS[8] === 'flame' &&
    WEAPON_FIRE_SOUNDS[9] === null &&
    WEAPON_PICKUP_SOUNDS[1] === 'spmac10' &&
    STATE_PICKUP_SOUNDS[POWERUP.TriDamage] === 'sptridamage' &&
    HEALTH_PICKUP_SOUND === 'sphealth' &&
    HYPER_JUMP_SOUND === 'hjump' &&
    HURT_SOUND === 'hurt' &&
    HELI_BOOM_SOUND === 'heliboom'
  );
}
