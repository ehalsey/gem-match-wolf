import * as Phaser from 'phaser'

import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { LevelSystem, type Challenge } from './LevelSystem'

const MENU_HEIGHT = BOARD_SIZE

export default class MenuScene extends Phaser.Scene {
  zone: Phaser.GameObjects.Zone
  levelLabel: Phaser.GameObjects.Text
  livesLabel: Phaser.GameObjects.Text
  livesValue: Phaser.GameObjects.Text
  scoreLabel: Phaser.GameObjects.Text
  scoreValue: Phaser.GameObjects.Text
  movesLabel: Phaser.GameObjects.Text
  movesValue: Phaser.GameObjects.Text
  challengeLabel: Phaser.GameObjects.Text
  challengeProgress: Phaser.GameObjects.Text
  challengeGemIcon: Phaser.GameObjects.Sprite | null
  newGameButton: Phaser.GameObjects.Text
  leaderboardButton: Phaser.GameObjects.Text

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

    // Lives display
    this.livesLabel = this.add.text(15, 40, 'Lives')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.livesValue = this.add.text(15, 57, `❤️ ${LevelSystem.getLives()}`)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FF4444')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Score display - left-aligned with smaller text
    this.scoreLabel = this.add.text(15, 85, 'Score')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.scoreValue = this.add.text(15, 105, '0')
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Moves display - left-aligned with smaller text
    this.movesLabel = this.add.text(15, 135, 'Moves')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.movesValue = this.add.text(15, 155, levelConfig.moves.toString())
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Compact button text
    this.newGameButton = this.add.text(15, 185, 'New Game')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#4da6ff')
      .setFontStyle('bold')
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.registry.events.emit('NEW_GAME')
      })
      .on('pointerover', () => {
        this.newGameButton.setColor('#ffffff')
      })
      .on('pointerout', () => {
        this.newGameButton.setColor('#4da6ff')
      })

    this.leaderboardButton = this.add.text(15, 210, 'Leaderboard')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#4da6ff')
      .setFontStyle('bold')
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.scene.launch('LeaderboardScene')
      })
      .on('pointerover', () => {
        this.leaderboardButton.setColor('#ffffff')
      })
      .on('pointerout', () => {
        this.leaderboardButton.setColor('#4da6ff')
      })

    // Challenge display
    this.challengeLabel = this.add.text(15, 0, 'CHALLENGE')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setFontStyle('bold')

    this.challengeProgress = this.add.text(35, 20, levelConfig.challenge.description)
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('white')
      .setWordWrapWidth(MENU_WIDTH - 45)

    // Add gem icon for color-match challenges
    this.challengeGemIcon = null
    if (levelConfig.challenge.type === 'color-match' && levelConfig.challenge.color) {
      this.challengeGemIcon = this.add.sprite(20, 28, levelConfig.challenge.color)
        .setDisplaySize(20, 20)
    }

    this.zone = this.add.zone(0, 0, MENU_WIDTH, MENU_HEIGHT).setOrigin(0)

    // Position challenge display
    this.challengeLabel.setPosition(15, 250)
    this.challengeProgress.setPosition(35, 270)
    if (this.challengeGemIcon) {
      this.challengeGemIcon.setPosition(20, 278)
    }

    // TODO: hint button

    this.registry.events.on('changedata', this.updateData, this)
    this.registry.events.on('CHALLENGE_UPDATED', this.onChallengeUpdated, this)
    this.registry.events.on('LIVES_UPDATED', this.onLivesUpdated, this)
  }

  onLivesUpdated () {
    const lives = LevelSystem.getLives()
    this.livesValue.setText(`❤️ ${lives}`)

    // Change color based on lives remaining
    if (lives <= 1) {
      this.livesValue.setColor('#FF0000')  // Bright red when critical
    } else if (lives <= 2) {
      this.livesValue.setColor('#FF4444')  // Red when low
    } else {
      this.livesValue.setColor('#FF6666')  // Lighter red when okay
    }
  }

  onChallengeUpdated (challenge: Challenge) {
    // Update level label
    const currentLevel = LevelSystem.getCurrentLevel()
    if (this.levelLabel) {
      this.levelLabel.setText(`Level ${currentLevel}`)
    }

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

    // Update gem icon for color-match challenges
    if (this.challengeGemIcon) {
      this.challengeGemIcon.destroy()
      this.challengeGemIcon = null
    }

    if (challenge.type === 'color-match' && challenge.color) {
      this.challengeGemIcon = this.add.sprite(20, 278, challenge.color)
        .setDisplaySize(20, 20)
    }
  }

  updateData (parent: any, key: string, data: any, previousData: any) {
    if (key === 'score') {
      this.scoreValue.setText(data)
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
