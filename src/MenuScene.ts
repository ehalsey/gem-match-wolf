import * as Phaser from 'phaser'

import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { TextButton } from './TextButton'
import { ScoreComparisonWidget } from './ScoreComparisonWidget'
import { LevelSystem, type Challenge } from './LevelSystem'

const MENU_HEIGHT = BOARD_SIZE

export default class MenuScene extends Phaser.Scene {
  zone: Phaser.GameObjects.Zone
  levelLabel: Phaser.GameObjects.Text
  difficultyLabel: Phaser.GameObjects.Text
  scoreLabel: Phaser.GameObjects.Text
  scoreValue: Phaser.GameObjects.Text
  movesLabel: Phaser.GameObjects.Text
  movesValue: Phaser.GameObjects.Text
  challengeLabel: Phaser.GameObjects.Text
  challengeProgress: Phaser.GameObjects.Text
  newGameButton: Phaser.GameObjects.Text
  scoreComparisonWidget: ScoreComparisonWidget

  constructor () {
    super({
      key: 'MenuScene',
      active: true
    })
  }

  create () {
    this.cameras.main.setViewport(0, 0, MENU_WIDTH, MENU_HEIGHT)

    // Get current level config
    const levelConfig = LevelSystem.getCurrentLevelConfig()

    // Level and difficulty display
    this.levelLabel = this.add.text(0, 0, `Level ${levelConfig.level}`)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('#FFD700')
      .setAlign('center')
      .setFontStyle('bold')

    const difficultyColors = {
      easy: '#00FF00',
      medium: '#FFA500',
      hard: '#FF4444'
    }

    this.difficultyLabel = this.add.text(0, 22, levelConfig.difficulty.toUpperCase())
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor(difficultyColors[levelConfig.difficulty])
      .setAlign('center')

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

    // Challenge display
    this.challengeLabel = this.add.text(10, 0, 'CHALLENGE')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setFontStyle('bold')

    this.challengeProgress = this.add.text(10, 20, levelConfig.challenge.description)
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('white')
      .setWordWrapWidth(MENU_WIDTH - 20)

    this.zone = this.add.zone(0, 0, MENU_WIDTH, MENU_HEIGHT).setOrigin(0)
    Phaser.Display.Align.In.TopCenter(this.levelLabel, this.zone, 0, 10)
    Phaser.Display.Align.In.TopCenter(this.difficultyLabel, this.zone, 0, 32)
    Phaser.Display.Align.In.TopCenter(this.scoreLabel, this.zone, 0, -20)
    Phaser.Display.Align.In.TopCenter(this.scoreValue, this.zone, 0, -60)
    Phaser.Display.Align.In.TopCenter(this.movesLabel, this.zone, 0, -120)
    Phaser.Display.Align.In.TopCenter(this.movesValue, this.zone, 0, -160)
    Phaser.Display.Align.In.TopCenter(this.newGameButton, this.zone, 0, -205)
    Phaser.Display.Align.In.TopCenter(leaderboardButton, this.zone, 0, -245)

    // Position challenge display
    this.challengeLabel.setPosition(10, 560)
    this.challengeProgress.setPosition(10, 580)

    // Score comparison widget
    this.scoreComparisonWidget = new ScoreComparisonWidget(this, 10, 280, MENU_WIDTH - 20)
    this.scoreComparisonWidget.update(0)

    // TODO: hint button

    this.registry.events.on('changedata', this.updateData, this)
    this.registry.events.on('PERSONAL_BEST_UPDATED', this.onPersonalBestUpdated, this)
    this.registry.events.on('CHALLENGE_UPDATED', this.onChallengeUpdated, this)
  }

  onPersonalBestUpdated () {
    if (this.scoreComparisonWidget) {
      this.scoreComparisonWidget.updatePersonalBest()
    }
  }

  onChallengeUpdated (challenge: Challenge) {
    if (this.challengeProgress) {
      const progressText = `${challenge.currentValue} / ${challenge.targetValue}`
      const completionPercent = Math.floor((challenge.currentValue / challenge.targetValue) * 100)

      this.challengeProgress.setText(`${challenge.description}\n${progressText} (${completionPercent}%)`)

      // Change color based on completion
      if (challenge.currentValue >= challenge.targetValue) {
        this.challengeProgress.setColor('#00FF00')  // Green when complete
      } else if (completionPercent >= 75) {
        this.challengeProgress.setColor('#FFD700')  // Gold when close
      } else {
        this.challengeProgress.setColor('white')
      }
    }
  }

  updateData (parent: any, key: string, data: any, previousData: any) {
    if (key === 'score') {
      this.scoreValue.setText(data)
      Phaser.Display.Align.In.TopCenter(this.scoreValue, this.zone, 0, -60)
      // Update score comparison widget
      if (this.scoreComparisonWidget) {
        this.scoreComparisonWidget.update(data)
      }
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
