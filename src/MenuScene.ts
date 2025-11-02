import * as Phaser from 'phaser'

import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { TextButton } from './TextButton'
import { ScoreComparisonWidget } from './ScoreComparisonWidget'
import { LevelSystem, type Challenge } from './LevelSystem'

const MENU_HEIGHT = BOARD_SIZE

export default class MenuScene extends Phaser.Scene {
  zone: Phaser.GameObjects.Zone
  levelLabel: Phaser.GameObjects.Text
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

    // Level display - color-coded by difficulty
    const difficultyColors = {
      easy: '#00FF00',
      medium: '#FFA500',
      hard: '#FF4444'
    }

    this.levelLabel = this.add.text(15, 15, `Level ${levelConfig.level}`)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor(difficultyColors[levelConfig.difficulty])
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Score display - left-aligned with smaller text
    this.scoreLabel = this.add.text(15, 45, 'Score')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.scoreValue = this.add.text(15, 65, '0')
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Moves display - left-aligned with smaller text
    this.movesLabel = this.add.text(15, 95, 'Moves')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.movesValue = this.add.text(15, 115, levelConfig.moves.toString())
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.newGameButton = new TextButton(this, 0, 150, 'New Game')
    this.newGameButton.on('pointerup', () => {
      this.registry.events.emit('NEW_GAME')
    })

    const leaderboardButton = new TextButton(this, 0, 220, 'Leaderboard')
    leaderboardButton.on('pointerup', () => {
      this.scene.launch('LeaderboardScene')
    })

    // Challenge display
    this.challengeLabel = this.add.text(15, 0, 'CHALLENGE')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setFontStyle('bold')

    this.challengeProgress = this.add.text(15, 20, levelConfig.challenge.description)
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('white')
      .setWordWrapWidth(MENU_WIDTH - 30)

    this.zone = this.add.zone(0, 0, MENU_WIDTH, MENU_HEIGHT).setOrigin(0)

    // Position buttons centered
    const centerX = MENU_WIDTH / 2
    this.newGameButton.setPosition(centerX, 145)
    leaderboardButton.setPosition(centerX, 185)

    // Score comparison widget (below buttons)
    this.scoreComparisonWidget = new ScoreComparisonWidget(this, 15, 225, MENU_WIDTH - 30)
    this.scoreComparisonWidget.update(0)

    // Position challenge display at bottom (with margin from bottom)
    this.challengeLabel.setPosition(15, 380)
    this.challengeProgress.setPosition(15, 400)

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
    }
  }
}
