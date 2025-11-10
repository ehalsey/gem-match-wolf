import * as Phaser from 'phaser'

import {
  BOARD_SIZE,
  MENU_WIDTH
} from './constants'
import GameScene from './GameScene'
import MenuScene from './MenuScene'
import LeaderboardScene from './LeaderboardScene'
import LevelCompleteScene from './LevelCompleteScene'
import { LevelSystem } from './LevelSystem'

declare global {
  interface Window {
    game: Phaser.Game
    LevelSystem: typeof LevelSystem
  }
}

const config: Phaser.Types.Core.GameConfig = {
  title: 'Bejeweled',
  width: BOARD_SIZE + MENU_WIDTH,
  height: BOARD_SIZE,
  parent: document.getElementsByClassName('CanvasContainer')[0] as HTMLElement,
  scene: [MenuScene, GameScene, LeaderboardScene, LevelCompleteScene]
}

const game = new Phaser.Game(config)

window.game = game
window.LevelSystem = LevelSystem
