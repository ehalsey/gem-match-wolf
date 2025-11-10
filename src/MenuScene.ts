import * as Phaser from 'phaser'

import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { LevelSystem, type Challenge } from './LevelSystem'

const MENU_HEIGHT = BOARD_SIZE

export default class MenuScene extends Phaser.Scene {
  zone: Phaser.GameObjects.Zone
  levelLabel: Phaser.GameObjects.Text
  livesLabel: Phaser.GameObjects.Text
  livesValue: Phaser.GameObjects.Text
  lifeTimer: Phaser.GameObjects.Text | null
  coinsLabel: Phaser.GameObjects.Text
  coinsValue: Phaser.GameObjects.Text
  hammersLabel: Phaser.GameObjects.Text
  hammersButton: Phaser.GameObjects.Text
  scoreLabel: Phaser.GameObjects.Text
  scoreValue: Phaser.GameObjects.Text
  movesLabel: Phaser.GameObjects.Text
  movesValue: Phaser.GameObjects.Text
  challengeLabel: Phaser.GameObjects.Text
  challengeProgress: Phaser.GameObjects.Text
  challengeGemIcon: Phaser.GameObjects.Sprite | null
  newGameButton: Phaser.GameObjects.Text
  leaderboardButton: Phaser.GameObjects.Text
  lifeRegenTimer: Phaser.Time.TimerEvent | null

  constructor () {
    super({
      key: 'MenuScene',
      active: true
    })
  }

  create () {
    this.cameras.main.setViewport(0, 0, MENU_WIDTH, MENU_HEIGHT)

    // Process life regeneration on scene creation
    LevelSystem.processLifeRegeneration()

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

    // Lives display with timer
    const lives = LevelSystem.getLives()
    const maxLives = 5
    this.livesLabel = this.add.text(15, 40, 'Lives')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.livesValue = this.add.text(15, 57, `❤️ ${lives}/${maxLives}`)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FF4444')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Life regeneration timer (shown only when lives < max)
    this.lifeTimer = null
    if (lives < maxLives) {
      this.lifeTimer = this.add.text(90, 57, '')
        .setFontFamily('Arial')
        .setFontSize(12)
        .setColor('#888888')
        .setAlign('left')
        .setOrigin(0, 0)
      this.updateLifeTimer()
    }

    // Coins display
    this.coinsLabel = this.add.text(15, 80, 'Coins')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.coinsValue = this.add.text(15, 97, `🪙 ${LevelSystem.getCoins()}`)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Hammers display and button
    this.hammersLabel = this.add.text(15, 120, 'Hammers')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.hammersButton = this.add.text(15, 137, `🔨 ${LevelSystem.getHammers()}`)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#8B4513')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (LevelSystem.getHammers() > 0) {
          this.registry.events.emit('HAMMER_ACTIVATED')
        }
      })
      .on('pointerover', () => {
        if (LevelSystem.getHammers() > 0) {
          this.hammersButton.setColor('#CD853F')
        }
      })
      .on('pointerout', () => {
        this.hammersButton.setColor('#8B4513')
      })

    // Score display - now shows level score only
    this.scoreLabel = this.add.text(15, 165, 'Level Score')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.scoreValue = this.add.text(15, 185, '0')
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Moves display - left-aligned with smaller text
    this.movesLabel = this.add.text(15, 215, 'Moves')
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFD700')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    this.movesValue = this.add.text(15, 235, levelConfig.moves.toString())
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')
      .setAlign('left')
      .setFontStyle('bold')
      .setOrigin(0, 0)

    // Compact button text
    this.newGameButton = this.add.text(15, 265, 'New Game')
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

    this.leaderboardButton = this.add.text(15, 290, 'Leaderboard')
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
    this.challengeLabel.setPosition(15, 315)
    this.challengeProgress.setPosition(35, 335)
    if (this.challengeGemIcon) {
      this.challengeGemIcon.setPosition(20, 343)
    }

    // Start life regeneration timer (updates every second)
    this.lifeRegenTimer = this.time.addEvent({
      delay: 1000,
      callback: this.updateLifeTimer,
      callbackScope: this,
      loop: true
    })

    // TODO: hint button

    this.registry.events.on('changedata', this.updateData, this)
    this.registry.events.on('CHALLENGE_UPDATED', this.onChallengeUpdated, this)
    this.registry.events.on('LIVES_UPDATED', this.onLivesUpdated, this)
    this.registry.events.on('HAMMERS_UPDATED', this.onHammersUpdated, this)
    this.registry.events.on('COINS_UPDATED', this.onCoinsUpdated, this)
    this.registry.events.on('SCORE_FLYOUT', this.onScoreFlyout, this)
  }

  onHammersUpdated () {
    const hammers = LevelSystem.getHammers()
    this.hammersButton.setText(`🔨 ${hammers}`)
  }

  onScoreFlyout (data: { startX: number, startY: number, score: number, color: string, strokeColor: string, multiplier: number, gameSpeed: number }) {
    // Create flying score text that will fly over the menu to the scoreboard
    // Start with larger size for better visibility
    const flyingScore = this.add.text(data.startX, data.startY, `+${data.score}`, {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: data.color,
      fontStyle: 'bold',
      stroke: data.strokeColor,
      strokeThickness: 6
    })
      .setOrigin(0.5)
      .setDepth(10000)  // High depth so it renders over everything in MenuScene
      .setScale(1.5)  // Start even bigger for dramatic effect

    // Target position: the score display
    const targetX = 15
    const targetY = 145

    // Two-stage animation: pop up, then fly to scoreboard
    const duration = (baseDuration: number) => baseDuration / data.gameSpeed

    // Stage 1: Pop up with dramatic scale pulse
    this.tweens.add({
      targets: flyingScore,
      y: data.startY - 50,
      scale: data.multiplier > 1 ? 1.8 : 1.6,
      duration: duration(250),
      ease: 'Back.easeOut',
      onComplete: () => {
        // Stage 2: Fly to scoreboard
        this.tweens.add({
          targets: flyingScore,
          x: targetX,
          y: targetY,
          scale: 0.5,
          alpha: 0,
          duration: duration(800),
          ease: 'Cubic.easeIn',
          onComplete: () => flyingScore.destroy()
        })
      }
    })
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

  updateLifeTimer () {
    const lives = LevelSystem.getLives()
    const maxLives = 5

    if (lives >= maxLives) {
      // Hide timer if at max lives
      if (this.lifeTimer) {
        this.lifeTimer.setVisible(false)
      }
      return
    }

    const timeUntilNext = LevelSystem.getTimeUntilNextLife()
    const minutes = Math.floor(timeUntilNext / 60000)
    const seconds = Math.floor((timeUntilNext % 60000) / 1000)

    if (this.lifeTimer) {
      this.lifeTimer.setText(`⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`)
      this.lifeTimer.setVisible(true)
    }

    // Check if we should regenerate a life
    LevelSystem.processLifeRegeneration()
    const newLives = LevelSystem.getLives()
    if (newLives !== lives) {
      // Lives were regenerated, update display
      this.livesValue.setText(`❤️ ${newLives}/${maxLives}`)
      this.registry.events.emit('LIVES_UPDATED')
    }
  }

  onCoinsUpdated () {
    const coins = LevelSystem.getCoins()
    this.coinsValue.setText(`🪙 ${coins}`)
  }
}
