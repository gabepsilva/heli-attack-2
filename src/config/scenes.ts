/** Phaser scene keys — shared so Boot ↔ Menu ↔ Game ↔ Pause ↔ GameOver stay consistent. */
export const SCENE_KEYS = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
