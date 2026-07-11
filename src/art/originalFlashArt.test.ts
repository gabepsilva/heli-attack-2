/**
 * Issue #95 — ship temporary original Flash sprites (iopred ha2/assets).
 * Asserts acceptance criteria and exact catalog / pivot / stub mappings.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_PLAYER_FINAL_SCALE, ART_WORLD_FINAL_SCALE } from '../config/art';
import { renderArtSpecMarkdown } from './artSpec';
import {
  FLASH_ORIGINAL_SOURCES,
  FLASH_STUB_FRAME_IDS,
  SPRITE_DEFS,
  finalSourcePath,
  gameDrawSize,
  getSpriteDef,
  textureSize,
} from './catalog';

const root = resolve(import.meta.dirname, '../..');
const gfxDir = resolve(root, 'reference/ha2-source/gfx');

function pngSize(abs: string): { w: number; h: number } {
  const buf = readFileSync(abs);
  expect([...buf.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const w = (buf[16]! << 24) | (buf[17]! << 16) | (buf[18]! << 8) | buf[19]!;
  const h = (buf[20]! << 24) | (buf[21]! << 16) | (buf[22]! << 8) | buf[23]!;
  return { w, h };
}

function fileBytesEqual(a: string, b: string): boolean {
  return readFileSync(a).equals(readFileSync(b));
}

/** Nearest-neighbor upscale via ImageMagick; returns path to temp PNG. */
function nnUpscale(src: string, scale: number, dest: string): void {
  const r = spawnSync(
    'convert',
    [src, '-filter', 'point', '-resize', `${scale * 100}%`, dest],
    { encoding: 'utf8' },
  );
  expect(r.status, r.stderr).toBe(0);
}

describe('original Flash art swap (issue #95 acceptance)', () => {
  it('maps every catalog id to the documented iopred ha2/assets source', () => {
    expect(FLASH_ORIGINAL_SOURCES.player_idle).toBe('guy.png');
    expect(FLASH_ORIGINAL_SOURCES.player_duck).toBe('duck.png');
    expect(FLASH_ORIGINAL_SOURCES.player_jump).toBe('jump.png');
    expect(FLASH_ORIGINAL_SOURCES.player_jump2).toBe('jump2.png');
    expect(FLASH_ORIGINAL_SOURCES.player_step1).toBe('step1.png');
    expect(FLASH_ORIGINAL_SOURCES.player_step2).toBe('step2.png');
    expect(FLASH_ORIGINAL_SOURCES.player_death).toBe('guyburned.png');
    expect(FLASH_ORIGINAL_SOURCES.heli).toBe('heli.png');
    expect(FLASH_ORIGINAL_SOURCES.heli_hit).toBe('heli_hit.png');
    expect(FLASH_ORIGINAL_SOURCES.heli_destroyed).toBe('heliDestroyed.png');
    expect(FLASH_ORIGINAL_SOURCES.enemy_guy).toBe('enemyguy.png');
    expect(FLASH_ORIGINAL_SOURCES.bullet_player).toBe('bullett.png');
    expect(FLASH_ORIGINAL_SOURCES.bullet_enemy).toBe('enemybullet.png');
    expect(FLASH_ORIGINAL_SOURCES.weapon_machinegun).toBe('machineGun.png');
    expect(FLASH_ORIGINAL_SOURCES.grenade).toBe('grenade.png');
    expect(FLASH_ORIGINAL_SOURCES.rocket).toBe('Rocket.png');
    expect(FLASH_ORIGINAL_SOURCES.shotgunrocketbullet).toBe(
      'shotgunrocketbullet.png',
    );
    expect(FLASH_ORIGINAL_SOURCES.rpg).toBe('rpg.png');
    expect(FLASH_ORIGINAL_SOURCES.seekerbullet).toBe('seekerbullet.png');
    expect(FLASH_ORIGINAL_SOURCES.flame).toBe('flame.png');
    expect(FLASH_ORIGINAL_SOURCES.minebullet).toBe('minebullet.png');
    expect(FLASH_ORIGINAL_SOURCES.mine).toBe('mine.png');
    expect(FLASH_ORIGINAL_SOURCES.abombbullet).toBe('abombbullet.png');
    expect(FLASH_ORIGINAL_SOURCES.rail).toBe('rail.png');
    expect(FLASH_ORIGINAL_SOURCES.grapplebullet).toBe('grapplebullet.png');
    expect(FLASH_ORIGINAL_SOURCES.smoke).toBe('smoke.png');
    expect(FLASH_ORIGINAL_SOURCES.blood).toBe('blood.png');
    expect(FLASH_ORIGINAL_SOURCES.explosion).toBe('bigboom.png');
    expect(FLASH_ORIGINAL_SOURCES.powerup).toBe('powerup.png');
    expect(FLASH_ORIGINAL_SOURCES.powerhealth).toBe('powerhealth.png');
    expect(FLASH_ORIGINAL_SOURCES.powermachinegun).toBe('powermachinegun.png');
    expect(FLASH_ORIGINAL_SOURCES.poweruzi).toBe('old/poweruzi.png');
    expect(FLASH_ORIGINAL_SOURCES.powershotgun).toBe('powershotgun.png');
    expect(FLASH_ORIGINAL_SOURCES.powershotgunrocket).toBe(
      'powershotgunrocket.png',
    );
    expect(FLASH_ORIGINAL_SOURCES.powergen).toBe('powergen.png');
    expect(FLASH_ORIGINAL_SOURCES.powerrpg).toBe('powerrpg.png');
    expect(FLASH_ORIGINAL_SOURCES.powerrocketlauncher).toBe(
      'powerrocketlauncher.png',
    );
    expect(FLASH_ORIGINAL_SOURCES.powerseeker).toBe('powerseeker.png');
    expect(FLASH_ORIGINAL_SOURCES.powerflamethrower).toBe(
      'powerflamethrower.png',
    );
    expect(FLASH_ORIGINAL_SOURCES.powermine).toBe('powermine.png');
    expect(FLASH_ORIGINAL_SOURCES.powerabomb).toBe('powerabomb.png');
    expect(FLASH_ORIGINAL_SOURCES.powerrail).toBe('powerrail.png');
    expect(FLASH_ORIGINAL_SOURCES.powergrapple).toBe('powergrapple.png');
    expect(FLASH_ORIGINAL_SOURCES.powershouldercannon).toBe(
      'powershouldercannon.png',
    );
    expect(FLASH_ORIGINAL_SOURCES.tile_floor).toBe('new/Floor.png');
    expect(Object.keys(FLASH_ORIGINAL_SOURCES).sort()).toEqual(
      SPRITE_DEFS.map((d) => d.id).sort(),
    );
  });

  it('documents stubs for missing originals (hurt, strafe, muzzle)', () => {
    expect(FLASH_STUB_FRAME_IDS).toEqual([
      'player_hurt',
      'heli_strafe',
      'muzzle_flash',
    ]);
    expect(FLASH_ORIGINAL_SOURCES.player_hurt).toBe('guy.png');
    expect(FLASH_ORIGINAL_SOURCES.heli_strafe).toBe('heli.png');
    expect(FLASH_ORIGINAL_SOURCES.muzzle_flash).toBeNull();
    expect(getSpriteDef('player_hurt').role).toMatch(/stub: reuse guy\.png/i);
    expect(getSpriteDef('heli_strafe').role).toMatch(/stub: reuse heli\.png/i);
    expect(getSpriteDef('muzzle_flash').role).toMatch(/generated stub/i);
  });

  it('ships stub frames as byte-identical copies of their reuse sources', () => {
    const hurt = resolve(root, finalSourcePath(getSpriteDef('player_hurt')));
    const idle = resolve(root, finalSourcePath(getSpriteDef('player_idle')));
    const strafe = resolve(root, finalSourcePath(getSpriteDef('heli_strafe')));
    const heli = resolve(root, finalSourcePath(getSpriteDef('heli')));
    expect(fileBytesEqual(hurt, idle)).toBe(true);
    expect(fileBytesEqual(strafe, heli)).toBe(true);
    const muzzle = resolve(root, finalSourcePath(getSpriteDef('muzzle_flash')));
    expect(existsSync(muzzle)).toBe(true);
    expect(pngSize(muzzle)).toEqual({ w: 64, h: 64 });
  });

  it('keeps Flash pivots and game draw sizes (gun grip, feet, heli center)', () => {
    expect(getSpriteDef('player_idle').pivot).toEqual({ x: 0.5, y: 1 });
    expect(getSpriteDef('weapon_machinegun').pivot).toEqual({ x: 0.2, y: 0.5 });
    expect(getSpriteDef('heli').pivot).toEqual({ x: 0.5, y: 0.5 });
    expect(getSpriteDef('tile_floor').pivot).toEqual({ x: 0, y: 0 });
    expect(gameDrawSize(getSpriteDef('player_idle'))).toEqual({
      w: 48,
      h: 48,
    });
    expect(gameDrawSize(getSpriteDef('weapon_machinegun'))).toEqual({
      w: 29,
      h: 16,
    });
    expect(gameDrawSize(getSpriteDef('heli'))).toEqual({ w: 212, h: 106 });
    expect(ART_PLAYER_FINAL_SCALE).toBe(8);
    expect(ART_WORLD_FINAL_SCALE).toBe(4);
    expect(textureSize(getSpriteDef('player_idle'))).toEqual({
      w: 192,
      h: 392,
    });
    expect(textureSize(getSpriteDef('heli'))).toEqual({ w: 848, h: 424 });
  });

  it('matches committed textures to NN-upscaled Flash originals when gfx is present', () => {
    const guy = resolve(gfxDir, 'guy.png');
    if (!existsSync(guy)) {
      // CI keeps reference/ha2-source gitignored; committed art/ still ships.
      for (const def of SPRITE_DEFS) {
        expect(existsSync(resolve(root, finalSourcePath(def))), def.id).toBe(
          true,
        );
      }
      return;
    }

    const tmp = mkdtempSync(join(tmpdir(), 'ha2-flash-'));
    try {
      const checks: Array<{
        id: (typeof SPRITE_DEFS)[number]['id'];
        flash: string;
        scale: number;
      }> = [
        { id: 'player_idle', flash: 'guy.png', scale: ART_PLAYER_FINAL_SCALE },
        {
          id: 'player_death',
          flash: 'guyburned.png',
          scale: ART_PLAYER_FINAL_SCALE,
        },
        { id: 'heli', flash: 'heli.png', scale: ART_WORLD_FINAL_SCALE },
        { id: 'tile_floor', flash: 'Floor.png', scale: ART_WORLD_FINAL_SCALE },
        {
          id: 'weapon_machinegun',
          flash: 'machineGun.png',
          scale: ART_WORLD_FINAL_SCALE,
        },
      ];
      for (const { id, flash, scale } of checks) {
        const src = resolve(gfxDir, flash);
        const committed = resolve(root, finalSourcePath(getSpriteDef(id)));
        const expected = join(tmp, `${id}.png`);
        nnUpscale(src, scale, expected);
        const cmp = spawnSync(
          'compare',
          ['-metric', 'AE', committed, expected, 'null:'],
          { encoding: 'utf8' },
        );
        const ae = Number((cmp.stderr || cmp.stdout).trim().split(/\s+/)[0]);
        expect(ae, `${id} AE vs NN(${flash})`).toBe(0);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('documents temporary original Flash art in ART-SPEC and README', () => {
    const md = renderArtSpecMarkdown();
    expect(md).toMatch(/temporary original Flash/i);
    expect(md).toMatch(/Hi-res redraws TBD/i);
    expect(md).toContain('npm run art:import-original');
    expect(md).not.toMatch(
      /Do not\s+ship original GPL art as final product art/,
    );

    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    expect(readme).toMatch(/temporary[\s\S]*original Flash/i);
    expect(readme).toMatch(/hi-res redraws TBD/i);
    expect(readme).toContain('art:import-original');
  });
});
