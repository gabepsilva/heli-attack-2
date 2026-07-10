/**
 * Issue #27 acceptance: each weapon / powerup / explosion / hurt / hyper-jump
 * maps to the exact Flash catalog sound id.
 */
import { describe, expect, it } from 'vitest';
import { POWERUP } from '../config/constants';
import { WEAPON_COUNT } from '../config/weapons';
import {
  eventMapMatchesFlashArsenal,
  HEALTH_PICKUP_SOUND,
  HELI_BOOM_SOUND,
  HURT_SOUND,
  HYPER_JUMP_SOUND,
  soundForAudioEvent,
  soundForPowerupCollect,
  soundForWeaponFire,
  STATE_PICKUP_SOUNDS,
  weaponFireIsHold,
  WEAPON_FIRE_SOUNDS,
  WEAPON_PICKUP_SOUNDS,
} from './eventMap';

describe('eventMap (issue #27 AC — correct Flash sounds)', () => {
  it('locks the fire table to the 14-gun Flash guns[].sound list', () => {
    expect(eventMapMatchesFlashArsenal()).toBe(true);
    expect(WEAPON_FIRE_SOUNDS).toHaveLength(WEAPON_COUNT);
    expect(WEAPON_FIRE_SOUNDS).toEqual([
      'gun',
      'gun',
      'shotgun',
      'rocket', // ShotgunRockets → srocket (not shotgunrockets VO)
      'grenade',
      'grenade', // RPG → sgrenade
      'rocket',
      'rocket',
      'flame',
      null, // FireMines silent on fire
      'rocket',
      'railgun',
      'grapple',
      'railgun',
    ]);
  });

  it('resolves every arsenal fire index to the Flash sound (or null)', () => {
    for (let i = 0; i < WEAPON_COUNT; i += 1) {
      expect(soundForWeaponFire(i)).toBe(WEAPON_FIRE_SOUNDS[i]!);
    }
    expect(soundForWeaponFire(-1)).toBeNull();
    expect(soundForWeaponFire(WEAPON_COUNT)).toBeNull();
  });

  it('marks only FlameThrower (index 8) as soundhold', () => {
    expect(weaponFireIsHold(8)).toBe(true);
    expect(weaponFireIsHold(0)).toBe(false);
    expect(
      soundForAudioEvent({ type: 'weaponFire', weaponIndex: 8 }),
    ).toBeNull();
    expect(soundForAudioEvent({ type: 'weaponFire', weaponIndex: 0 })).toBe(
      'gun',
    );
  });

  it('maps weapon / health / state pickups to sp* VO ids', () => {
    expect(soundForPowerupCollect({ kind: 'health', amount: 20 })).toBe(
      HEALTH_PICKUP_SOUND,
    );
    expect(HEALTH_PICKUP_SOUND).toBe('sphealth');

    expect(WEAPON_PICKUP_SOUNDS).toEqual({
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
    });
    expect(soundForPowerupCollect({ kind: 'weapon', amount: 2 })).toBe(
      'spshotgun',
    );

    expect(STATE_PICKUP_SOUNDS).toEqual({
      [POWERUP.TriDamage]: 'sptridamage',
      [POWERUP.Invulnerability]: 'spinvulnerability',
      [POWERUP.PredatorMode]: 'sppredatormode',
      [POWERUP.TimeRift]: 'sptimerift',
      [POWERUP.Jetpack]: 'spjetpack',
    });
    expect(
      soundForPowerupCollect({
        kind: 'state',
        amount: POWERUP.Invulnerability,
      }),
    ).toBe('spinvulnerability');
  });

  it('maps combat one-shots to hjump / hurt / heliboom', () => {
    expect(soundForAudioEvent({ type: 'hyperJump' })).toBe(HYPER_JUMP_SOUND);
    expect(HYPER_JUMP_SOUND).toBe('hjump');
    expect(soundForAudioEvent({ type: 'hurt' })).toBe(HURT_SOUND);
    expect(HURT_SOUND).toBe('hurt');
    expect(soundForAudioEvent({ type: 'heliBoom' })).toBe(HELI_BOOM_SOUND);
    expect(HELI_BOOM_SOUND).toBe('heliboom');
  });
});
