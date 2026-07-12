/**
 * The gun in the player's hands — one per arsenal slot, grip and muzzle taken
 * from the original art (see scripts/art/extract-swf-guns.py).
 */

import { describe, expect, it } from 'vitest';
import { gameDrawSize, getSpriteDef } from '../art/catalog';
import { WEAPONS, WEAPON_COUNT } from '../config/weapons';
import { HELD_GUNS, DEFAULT_HELD_GUN, heldGunFor } from './heldGun';

describe('held guns', () => {
  it('covers every weapon in the arsenal', () => {
    expect(HELD_GUNS).toHaveLength(WEAPON_COUNT);
    expect(DEFAULT_HELD_GUN).toBe(HELD_GUNS[0]);
  });

  it('gives each weapon its own gun, so switching actually changes the sprite', () => {
    const frames = HELD_GUNS.map((g) => g.frame).filter((f) => f !== null);
    // Every weapon that shows a gun shows a *different* gun.
    expect(new Set(frames).size).toBe(frames.length);
    expect(heldGunFor(0).frame).toBe('weapon_machinegun');
    expect(heldGunFor(11).frame).toBe('weapon_rail');
  });

  it('carries the ShoulderCannon cloaked — predator mode shows no gun', () => {
    const predator = heldGunFor(WEAPON_COUNT - 1);
    expect(WEAPONS[WEAPON_COUNT - 1]!.name).toBe('ShoulderCannon');
    expect(predator.frame).toBeNull();
    // Cloaked, but still armed: an invisible gun still needs a barrel.
    expect(predator.muzzle.x).toBeGreaterThan(0);
  });

  it('draws each gun at its own size — a railgun is not a machine gun', () => {
    const mg = gameDrawSize(getSpriteDef('weapon_machinegun'));
    const rail = gameDrawSize(getSpriteDef('weapon_rail'));
    expect(mg).toEqual({ w: 29, h: 16 });
    expect(rail).toEqual({ w: 57, h: 31 });
  });

  it('grips each gun where its hands are, not at a shared origin', () => {
    // Pivots come from the source art's registration point. If they were
    // eyeballed they would cluster; these genuinely differ per weapon.
    const pivots = HELD_GUNS.filter((g) => g.frame !== null).map(
      (g) => getSpriteDef(g.frame).pivot,
    );
    expect(new Set(pivots.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(8);
    // The mine is held out past the hand — the only grip left of the bitmap.
    expect(getSpriteDef('weapon_firemines').pivot.x).toBeLessThan(0);
  });

  it('falls back to the starting gun rather than throwing on a bad index', () => {
    expect(heldGunFor(-1)).toBe(DEFAULT_HELD_GUN);
    expect(heldGunFor(99)).toBe(DEFAULT_HELD_GUN);
  });
});
