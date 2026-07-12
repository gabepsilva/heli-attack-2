/**
 * Atlas image construction shared by the scenes: every sprite wants its
 * catalog pivot as the origin and its catalog draw size as the display size,
 * and getting either wrong silently misplaces or mis-scales the sprite.
 */

import Phaser from 'phaser';

import { gameDrawSize, getSpriteDef, type SpriteId } from '../art/catalog';
import { ATLAS_KEY } from '../config/art';

/**
 * Atlas image at the catalog pivot and draw size, parked at the origin for the
 * scene to position. Pass `size` for sprites the game draws at a tuned size
 * rather than the catalog's (e.g. the gun at `GUN.spriteW/H`).
 */
export function addAtlasImage(
  scene: Phaser.Scene,
  frame: SpriteId,
  size?: { w: number; h: number },
): Phaser.GameObjects.Image {
  const def = getSpriteDef(frame);
  const draw = size ?? gameDrawSize(def);
  return scene.add
    .image(0, 0, ATLAS_KEY, frame)
    .setOrigin(def.pivot.x, def.pivot.y)
    .setDisplaySize(draw.w, draw.h);
}
