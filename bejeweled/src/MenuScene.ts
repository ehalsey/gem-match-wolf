import * as Phaser from 'phaser'

import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { TextButton } from './TextButton'

const MENU_HEIGHT = BOARD_SIZE

// Version injected at build time by webpack
declare const APP_VERSION: string

export default class MenuScene extends Phaser.Scene {
  zone: Phaser.GameObjects.Zone
  scoreLabel: Phaser.GameObjects.Text
  scoreValue: Phaser.GameObjects.Text
  movesLabel: Phaser.GameObjects.Text
  movesValue: Phaser.GameObjects.Text
  newGameButton: Phaser.GameObjects.Text
  versionText: Phaser.GameObjects.Text

  constructor () {
    super({
      key: 'MenuScene',
      active: true
    })
  }

  create () {
    this.cameras.main.setViewport(0, 0, MENU_WIDTH, MENU_HEIGHT)

    // Score display
    this.scoreLabel = this.add.text(0, 0, 'Score')
      .setFontFamily('Arial')
      .setFontSize(22)
      .setColor('#FFD700')
      .setAlign('center')
      .setFontStyle('bold')

    this.scoreValue = this.add.text(0, 35, '0')
      .setFontFamily('Arial')
      .setFontSize(28)
      .setColor('white')
      .setAlign('center')
      .setFontStyle('bold')

    // Moves display
    this.movesLabel = this.add.text(0, 0, 'Moves')
      .setFontFamily('Arial')
      .setFontSize(22)
      .setColor('#FFD700')
      .setAlign('center')
      .setFontStyle('bold')

    this.movesValue = this.add.text(0, 35, '30')
      .setFontFamily('Arial')
      .setFontSize(28)
      .setColor('white')
      .setAlign('center')
      .setFontStyle('bold')

    this.newGameButton = new TextButton(this, 0, 150, 'New Game')
    this.newGameButton.on('pointerup', () => {
      this.registry.events.emit('NEW_GAME')
    })

    const leaderboardButton = new TextButton(this, 0, 220, 'Leaderboard')
    leaderboardButton.on('pointerup', () => {
      this.scene.launch('LeaderboardScene')
    })

    // Version display at bottom
    this.versionText = this.add.text(0, 0, `v${APP_VERSION}`)
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#888888')
      .setAlign('center')

    this.zone = this.add.zone(0, 0, MENU_WIDTH, MENU_HEIGHT).setOrigin(0)
    Phaser.Display.Align.In.TopCenter(this.scoreLabel, this.zone, 0, -20)
    Phaser.Display.Align.In.TopCenter(this.scoreValue, this.zone, 0, -60)
    Phaser.Display.Align.In.TopCenter(this.movesLabel, this.zone, 0, -120)
    Phaser.Display.Align.In.TopCenter(this.movesValue, this.zone, 0, -160)
    Phaser.Display.Align.In.TopCenter(this.newGameButton, this.zone, 0, -250)
    Phaser.Display.Align.In.TopCenter(leaderboardButton, this.zone, 0, -320)
    Phaser.Display.Align.In.BottomCenter(this.versionText, this.zone, 0, -10)

    // TODO: hint button

    this.registry.events.on('changedata', this.updateData, this)
  }

  updateData (parent: any, key: string, data: any, previousData: any) {
    if (key === 'score') {
      this.scoreValue.setText(data)
      Phaser.Display.Align.In.TopCenter(this.scoreValue, this.zone, 0, -60)
    } else if (key === 'moves') {
      this.movesValue.setText(data)
      // Change color based on moves remaining
      if (data <= 5) {
        this.movesValue.setColor('#FF4444')
      } else if (data <= 10) {
        this.movesValue.setColor('#FFA500')
      } else {
        this.movesValue.setColor('white')
      }
      Phaser.Display.Align.In.TopCenter(this.movesValue, this.zone, 0, -160)
    }
  }
}
