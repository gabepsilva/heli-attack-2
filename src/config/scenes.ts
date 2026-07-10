/** Phaser scene keys — shared so Boot ↔ Game switching stays consistent. */
export const SCENE_KEYS = {
  Boot: 'BootScene',
  Game: 'GameScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
