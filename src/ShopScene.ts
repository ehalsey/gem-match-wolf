import * as Phaser from 'phaser'
import { LevelSystem } from './LevelSystem'
import { BOARD_SIZE, MENU_WIDTH } from './constants'

/**
 * Shop Scene - Buy lives and power-ups with coins
 */
export default class ShopScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'ShopScene',
      active: false
    })
  }

  create() {
    // Set viewport to cover game area
    this.cameras.main.setViewport(MENU_WIDTH, 0, BOARD_SIZE, BOARD_SIZE)

    // Semi-transparent background
    const background = this.add.rectangle(0, 0, BOARD_SIZE, BOARD_SIZE, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()  // Block clicks to game underneath

    const centerX = BOARD_SIZE / 2
    let yOffset = 40

    // Title
    const title = this.add.text(centerX, yOffset, '🏪 SHOP', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)

    yOffset += 50

    // Current coins display
    const coins = LevelSystem.getCoins()
    const coinsDisplay = this.add.text(centerX, yOffset, `Your Coins: ${coins} 🪙`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)

    yOffset += 60

    // Lives section
    const lives = LevelSystem.getLives()
    const maxLives = 5

    this.createShopItem(
      centerX,
      yOffset,
      '❤️ Buy 1 Life',
      `10 🪙`,
      lives >= maxLives ? 'MAX LIVES' : null,
      () => {
        if (LevelSystem.buyLife()) {
          this.updateCoinsDisplay(coinsDisplay)
          this.showPurchaseSuccess('Bought 1 life!')
          this.registry.events.emit('LIVES_UPDATED')
          // Refresh shop to update button states
          this.scene.restart()
        } else {
          this.showPurchaseError(lives >= maxLives ? 'Already at max lives!' : 'Not enough coins!')
        }
      }
    )

    yOffset += 100

    // Refill all lives option
    if (lives < maxLives) {
      const livesNeeded = maxLives - lives
      this.createShopItem(
        centerX,
        yOffset,
        `❤️ Refill All Lives (+${livesNeeded})`,
        `50 🪙`,
        null,
        () => {
          if (LevelSystem.refillAllLives()) {
            this.updateCoinsDisplay(coinsDisplay)
            this.showPurchaseSuccess('Refilled all lives!')
            this.registry.events.emit('LIVES_UPDATED')
            this.scene.restart()
          } else {
            this.showPurchaseError('Not enough coins!')
          }
        }
      )
      yOffset += 100
    }

    // Hammers section
    this.createShopItem(
      centerX,
      yOffset,
      '🔨 Buy 1 Hammer',
      `20 🪙`,
      null,
      () => {
        if (LevelSystem.buyHammer()) {
          this.updateCoinsDisplay(coinsDisplay)
          this.showPurchaseSuccess('Bought 1 hammer!')
          this.registry.events.emit('HAMMERS_UPDATED')
          this.scene.restart()
        } else {
          this.showPurchaseError('Not enough coins!')
        }
      }
    )

    yOffset += 100

    // Hammer pack (better value)
    this.createShopItem(
      centerX,
      yOffset,
      '🔨 Buy 3 Hammers',
      `50 🪙 (SAVE 10!)`,
      null,
      () => {
        if (LevelSystem.buyHammerPack()) {
          this.updateCoinsDisplay(coinsDisplay)
          this.showPurchaseSuccess('Bought 3 hammers!')
          this.registry.events.emit('HAMMERS_UPDATED')
          this.scene.restart()
        } else {
          this.showPurchaseError('Not enough coins!')
        }
      }
    )

    yOffset += 80

    // Close button
    const closeButton = this.add.text(centerX, yOffset, 'Close', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#4da6ff',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.closeShop()
      })
      .on('pointerover', () => {
        closeButton.setColor('#ffffff')
      })
      .on('pointerout', () => {
        closeButton.setColor('#4da6ff')
      })

    // Fade in animation
    this.cameras.main.fadeIn(200)
  }

  private createShopItem(
    centerX: number,
    y: number,
    itemText: string,
    priceText: string,
    disabledText: string | null,
    onPurchase: () => void
  ) {
    const isDisabled = disabledText !== null

    // Container background
    const bgColor = isDisabled ? 0x444444 : 0x1a1a1a
    const bg = this.add.rectangle(centerX, y, BOARD_SIZE - 80, 80, bgColor, 0.8)

    // Item name
    const itemLabel = this.add.text(centerX - 100, y - 15, itemText, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: isDisabled ? '#888888' : '#ffffff',
      fontStyle: 'bold'
    })
      .setOrigin(0, 0.5)

    // Price or disabled message
    const priceLabel = this.add.text(centerX - 100, y + 15, disabledText || priceText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: isDisabled ? '#888888' : '#FFD700'
    })
      .setOrigin(0, 0.5)

    // Buy button
    if (!isDisabled) {
      const buyButton = this.add.text(centerX + 120, y, 'BUY', {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#00FF00',
        fontStyle: 'bold'
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', onPurchase)
        .on('pointerover', () => {
          buyButton.setColor('#ffffff')
          bg.setFillStyle(0x2a2a2a, 0.9)
        })
        .on('pointerout', () => {
          buyButton.setColor('#00FF00')
          bg.setFillStyle(bgColor, 0.8)
        })
    }
  }

  private updateCoinsDisplay(coinsDisplay: Phaser.GameObjects.Text) {
    const coins = LevelSystem.getCoins()
    coinsDisplay.setText(`Your Coins: ${coins} 🪙`)

    // Brief pulse animation
    this.tweens.add({
      targets: coinsDisplay,
      scale: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeInOut'
    })

    // Emit event to update MenuScene
    this.registry.events.emit('COINS_UPDATED')
  }

  private showPurchaseSuccess(message: string) {
    const centerX = BOARD_SIZE / 2
    const successText = this.add.text(centerX, 50, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#00FF00',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setAlpha(0)

    // Fade in and out
    this.tweens.add({
      targets: successText,
      alpha: 1,
      y: 30,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: successText,
            alpha: 0,
            duration: 300,
            onComplete: () => successText.destroy()
          })
        })
      }
    })
  }

  private showPurchaseError(message: string) {
    const centerX = BOARD_SIZE / 2
    const errorText = this.add.text(centerX, 50, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#FF4444',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setAlpha(0)

    // Shake and fade
    this.tweens.add({
      targets: errorText,
      alpha: 1,
      y: 30,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Shake
        this.tweens.add({
          targets: errorText,
          x: centerX - 5,
          duration: 50,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            this.time.delayedCall(1500, () => {
              this.tweens.add({
                targets: errorText,
                alpha: 0,
                duration: 300,
                onComplete: () => errorText.destroy()
              })
            })
          }
        })
      }
    })
  }

  private closeShop() {
    this.cameras.main.fadeOut(200, 0, 0, 0, (camera: any, progress: number) => {
      if (progress === 1) {
        this.scene.stop()
      }
    })
  }
}
