import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { phaserScaleConfig, SCALE_PARENT_ID } from './config/scale';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { mountFullscreenButton } from './ui/fullscreenButton';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: SCALE_PARENT_ID,
  backgroundColor: '#000000',
  scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene],
  scale: phaserScaleConfig(),
};

const game = new Phaser.Game(config);

mountFullscreenButton({
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
