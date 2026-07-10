import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { phaserScaleConfig, SCALE_PARENT_ID } from './config/scale';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { mountFullscreenButton } from './ui/fullscreenButton';
import { mountOrientationGuard } from './ui/orientationGuard';
import { mountTouchControlsHud } from './ui/touchControlsHud';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: SCALE_PARENT_ID,
  backgroundColor: '#000000',
  scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene],
  scale: phaserScaleConfig(),
  // Issue #31: enable the Gamepad Plugin for Standard Gamepad / Steam Input.
  input: {
    gamepad: true,
  },
};

const game = new Phaser.Game(config);

// Mount inside the fullscreen target so chrome stays visible in FS
// (Fullscreen API only paints the target element and its descendants).
const chromeParent = document.getElementById(SCALE_PARENT_ID) ?? document.body;

mountFullscreenButton({
  parent: chromeParent,
  scale: {
    isFullscreen: () => game.scale.isFullscreen,
    startFullscreen: () => {
      game.scale.startFullscreen();
    },
    stopFullscreen: () => {
      game.scale.stopFullscreen();
    },
  },
});

// Issue #30: portrait rotate prompt + on-screen touch controls (touch devices).
mountOrientationGuard({ parent: chromeParent });
mountTouchControlsHud({ parent: chromeParent });
