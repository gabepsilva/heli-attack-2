/**
 * Sound catalog: logical ids → multi-format URLs under public/audio/.
 * Prefer .ogg / .webm; .mp3 is the fallback for older browsers.
 */

export const SOUND_IDS = [
  'hjump',
  'hurt',
  'gun',
  'boom',
  'bigboom',
  'heliboom',
  'grenade',
  'grapple',
  'railgun',
  'rocket',
  'shotgun',
  'shotgunrockets',
  'flame',
  'metal0',
  'metal1',
  'metal2',
  'metal3',
  'heli',
  'music',
  'spabomb',
  'spfiremines',
  'spflamethrower',
  'spgrapplecannon',
  'spgrenadelauncher',
  'sphealth',
  'spinvulnerability',
  'spjetpack',
  'spmac10',
  'sppredatormode',
  'sprailgun',
  'sprocketlauncher',
  'sprpg',
  'spseekerlauncher',
  'spshotgun',
  'spshotgunrockets',
  'sptimerift',
  'sptridamage',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

/** Ordered format preference for {@link AudioManager.load}. */
export const AUDIO_FORMATS = ['ogg', 'webm', 'mp3'] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];

/** Base path for committed web-ready audio (Vite `public/`). */
export const AUDIO_PUBLIC_BASE = 'audio';

/** Multi-format URL list for a catalog sound (relative to site root). */
export function soundUrls(id: SoundId): string[] {
  return AUDIO_FORMATS.map((ext) => `${AUDIO_PUBLIC_BASE}/${id}.${ext}`);
}

export function isSoundId(value: string): value is SoundId {
  return (SOUND_IDS as readonly string[]).includes(value);
}
