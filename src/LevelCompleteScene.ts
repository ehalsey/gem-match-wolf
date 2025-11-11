import * as Phaser from 'phaser'
import { LevelSystem, type LevelResult } from './LevelSystem'
import { BOARD_SIZE, MENU_WIDTH } from './constants'

/**
 * Level Complete Scene
 * Shows stars earned, score, coins, and new best indicator
 */
export default class LevelCompleteScene extends Phaser.Scene {
  private result: LevelResult | null = null

  constructor() {
    super({
      key: 'LevelCompleteScene',
      active: false
    })
  }

  init(data: { result: LevelResult }) {
    this.result = data.result
  }

  create() {
    if (!this.result) {
      console.error('LevelCompleteScene: No result data provided')
      return
    }

    // Set viewport to cover game area
    this.cameras.main.setViewport(MENU_WIDTH, 0, BOARD_SIZE, BOARD_SIZE)

    // Semi-transparent background
    const background = this.add.rectangle(0, 0, BOARD_SIZE, BOARD_SIZE, 0x000000, 0.85)
      .setOrigin(0)

    const centerX = BOARD_SIZE / 2
    let yOffset = 80

    // Title
    const title = this.add.text(centerX, yOffset, 'LEVEL COMPLETE!', {
      fontSize: '36px',
      fontFamily: 'Arial',
      color: '#00FF00',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)

    yOffset += 60

    // Stars display
    this.createStarsDisplay(centerX, yOffset)
    yOffset += 80

    // Score
    const scoreText = this.add.text(centerX, yOffset, `Score: ${this.result.score}`, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)

    yOffset += 40

    // New Best indicator
    if (this.result.isNewBest) {
      const newBestText = this.add.text(centerX, yOffset, '🎉 NEW BEST! 🎉', {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#FFD700',
        fontStyle: 'bold'
      })
        .setOrigin(0.5)

      // Pulse animation
      this.tweens.add({
        targets: newBestText,
        scale: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      yOffset += 50
    } else if (this.result.previousBestScore > 0) {
      // Show previous best
      const prevBestText = this.add.text(centerX, yOffset, `Previous Best: ${this.result.previousBestScore}`, {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#888888'
      })
        .setOrigin(0.5)

      yOffset += 40
    }

    // Coins earned
    const coinsText = this.add.text(centerX, yOffset, `+${this.result.coinsEarned} 🪙`, {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)

    // Coin earned animation
    this.tweens.add({
      targets: coinsText,
      scale: { from: 0.5, to: 1 },
      duration: 400,
      ease: 'Back.easeOut'
    })

    yOffset += 60

    // Next Level button
    const nextButton = this.add.text(centerX, yOffset, 'Next Level →', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#00FF00',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.handleNextLevel()
      })
      .on('pointerover', () => {
        nextButton.setColor('#ffffff')
      })
      .on('pointerout', () => {
        nextButton.setColor('#00FF00')
      })

    // Fade in animation
    this.cameras.main.fadeIn(300)

    // Emit event to notify other scenes
    this.registry.events.emit('COINS_UPDATED')
  }

  private createStarsDisplay(centerX: number, y: number) {
    if (!this.result) return

    const starSpacing = 60
    const totalWidth = (this.result.stars - 1) * starSpacing
    const startX = centerX - totalWidth / 2

    for (let i = 0; i < 3; i++) {
      const x = startX + i * starSpacing
      const isEarned = i < this.result.stars

      // Star text (using emoji)
      const star = this.add.text(x, y, isEarned ? '⭐' : '☆', {
        fontSize: '48px'
      })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0)

      // Animate each star in sequence
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: i * 200,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (isEarned) {
            // Extra bounce for earned stars
            this.tweens.add({
              targets: star,
              scale: 1.2,
              duration: 200,
              yoyo: true,
              ease: 'Sine.easeInOut'
            })
          }
        }
      })
    }
  }

  private handleNextLevel() {
    // Fade out
    this.cameras.main.fadeOut(200, 0, 0, 0, (camera: any, progress: number) => {
      if (progress === 1) {
        // Close this scene and trigger next level in GameScene
        this.scene.stop()
        this.registry.events.emit('LOAD_NEXT_LEVEL')
      }
    })
  }
}
