import * as Phaser from 'phaser'
import { ScoreStorageService, LeaderboardEntry } from './ScoreStorageService'

/**
 * Widget showing score comparison indicators during gameplay
 */
export class ScoreComparisonWidget extends Phaser.GameObjects.Container {
  private personalBestText: Phaser.GameObjects.Text
  private personalBestIndicator: Phaser.GameObjects.Text
  private progressBar: Phaser.GameObjects.Graphics
  private progressBarBg: Phaser.GameObjects.Graphics
  private progressText: Phaser.GameObjects.Text
  private leaderboardTitle: Phaser.GameObjects.Text
  private leaderboardEntries: Phaser.GameObjects.Text[]
  private milestoneNotification: Phaser.GameObjects.Container | null
  private notificationTween: Phaser.Tweens.Tween | null

  private personalBest: number
  private lastScore: number
  private widgetWidth: number
  private readonly PROGRESS_BAR_HEIGHT = 8

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y)
    this.widgetWidth = width
    this.lastScore = 0
    this.leaderboardEntries = []
    this.milestoneNotification = null
    this.notificationTween = null

    // Load personal best
    this.personalBest = ScoreStorageService.getPersonalBest()

    this.createPersonalBestDisplay()
    this.createProgressBar()
    this.createLeaderboardDisplay()

    scene.add.existing(this)
  }

  /**
   * Create personal best comparison display
   */
  private createPersonalBestDisplay(): void {
    const startY = 0

    const label = this.scene.add.text(0, startY, 'Personal Best')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setFontStyle('bold')
      .setOrigin(0)

    this.personalBestText = this.scene.add.text(0, startY + 20, `${this.personalBest}`)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('white')
      .setOrigin(0)

    // Indicator shows if beating or trailing personal best
    this.personalBestIndicator = this.scene.add.text(0, startY + 40, '')
      .setFontFamily('Arial')
      .setFontSize(12)
      .setOrigin(0)

    this.add([label, this.personalBestText, this.personalBestIndicator])
  }

  /**
   * Create progress bar to next leaderboard position
   */
  private createProgressBar(): void {
    const startY = 70

    this.progressText = this.scene.add.text(0, startY, 'Next Target: ---')
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#87CEEB')
      .setOrigin(0)

    // Progress bar background
    this.progressBarBg = this.scene.add.graphics()
    this.progressBarBg.fillStyle(0x333333, 0.8)
    this.progressBarBg.fillRoundedRect(0, startY + 18, this.widgetWidth - 20, this.PROGRESS_BAR_HEIGHT, 4)

    // Progress bar fill
    this.progressBar = this.scene.add.graphics()

    this.add([this.progressText, this.progressBarBg, this.progressBar])
  }

  /**
   * Create mini leaderboard display
   */
  private createLeaderboardDisplay(): void {
    const startY = 105

    this.leaderboardTitle = this.scene.add.text(0, startY, 'Leaderboard')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#FFD700')
      .setFontStyle('bold')
      .setOrigin(0)

    this.add(this.leaderboardTitle)

    // Create text objects for leaderboard entries (will update in updateLeaderboard)
    for (let i = 0; i < 5; i++) {
      const entryText = this.scene.add.text(0, startY + 22 + (i * 18), '')
        .setFontFamily('Arial')
        .setFontSize(11)
        .setOrigin(0)
      this.leaderboardEntries.push(entryText)
      this.add(entryText)
    }
  }

  /**
   * Update widget with current score
   */
  update(currentScore: number): void {
    this.updatePersonalBestDisplay(currentScore)
    this.updateProgressBar(currentScore)
    this.updateLeaderboard(currentScore)
    
    // Check for milestone (passing a player)
    if (this.lastScore > 0) {
      const milestone = ScoreStorageService.checkMilestone(this.lastScore, currentScore)
      if (milestone) {
        this.showMilestoneNotification(milestone)
      }
    }

    this.lastScore = currentScore
  }

  /**
   * Update personal best indicator
   */
  private updatePersonalBestDisplay(currentScore: number): void {
    if (currentScore > this.personalBest) {
      this.personalBestIndicator.setText('🎉 New Best!')
      this.personalBestIndicator.setColor('#00FF00')
    } else if (currentScore > this.personalBest * 0.8) {
      const diff = this.personalBest - currentScore
      this.personalBestIndicator.setText(`-${diff} to beat`)
      this.personalBestIndicator.setColor('#FFA500')
    } else {
      const diff = this.personalBest - currentScore
      this.personalBestIndicator.setText(`-${diff} to best`)
      this.personalBestIndicator.setColor('#888888')
    }
  }

  /**
   * Update progress bar to next target
   */
  private updateProgressBar(currentScore: number): void {
    const nextTarget = ScoreStorageService.getNextTarget(currentScore)
    
    this.progressBar.clear()

    if (!nextTarget) {
      this.progressText.setText('🏆 #1 Position!')
      this.progressText.setColor('#FFD700')
      // Fill bar completely with gold
      this.progressBar.fillStyle(0xFFD700, 1)
      this.progressBar.fillRoundedRect(0, 88, this.widgetWidth - 20, this.PROGRESS_BAR_HEIGHT, 4)
      return
    }

    const targetScore = nextTarget.score
    this.progressText.setText(`Next: ${nextTarget.name} (${targetScore})`)
    this.progressText.setColor('#87CEEB')

    // Calculate progress percentage
    // Use previous target or 0 as baseline
    const leaderboard = ScoreStorageService.getLeaderboard()
    const playerRank = ScoreStorageService.getPlayerRank(currentScore)
    const previousScore = playerRank < leaderboard.length ? 
      (leaderboard[playerRank] ? leaderboard[playerRank].score : 0) : 0
    
    const range = targetScore - previousScore
    const progress = range > 0 ? (currentScore - previousScore) / range : 0
    const progressWidth = Math.max(2, Math.min(this.widgetWidth - 20, progress * (this.widgetWidth - 20)))

    // Color based on progress
    let color = 0x4488FF // blue
    if (progress > 0.8) color = 0x00FF00 // green
    else if (progress > 0.5) color = 0xFFD700 // gold
    
    this.progressBar.fillStyle(color, 1)
    this.progressBar.fillRoundedRect(0, 88, progressWidth, this.PROGRESS_BAR_HEIGHT, 4)
  }

  /**
   * Update leaderboard display with nearby scores
   */
  private updateLeaderboard(currentScore: number): void {
    const nearbyScores = ScoreStorageService.getNearbyScores(currentScore)

    // Clear all entries first
    this.leaderboardEntries.forEach(entry => entry.setText(''))

    // Display nearby scores and current player
    let displayIndex = 0
    let playerShown = false

    for (const entry of nearbyScores) {
      if (displayIndex >= this.leaderboardEntries.length) break

      // Show player's current position if between entries
      if (!playerShown && currentScore > entry.score) {
        if (displayIndex < this.leaderboardEntries.length) {
          this.leaderboardEntries[displayIndex].setText(`▶ You: ${currentScore}`)
          this.leaderboardEntries[displayIndex].setColor('#00FF00')
          this.leaderboardEntries[displayIndex].setFontStyle('bold')
          displayIndex++
          playerShown = true
        }
      }

      if (displayIndex < this.leaderboardEntries.length) {
        const rankText = entry.rank ? `${entry.rank}.` : ''
        this.leaderboardEntries[displayIndex].setText(`${rankText} ${entry.name}: ${entry.score}`)
        this.leaderboardEntries[displayIndex].setColor('#CCCCCC')
        this.leaderboardEntries[displayIndex].setFontStyle('normal')
        displayIndex++
      }
    }

    // If player hasn't been shown yet (score is below all displayed entries or above all)
    if (!playerShown && displayIndex < this.leaderboardEntries.length) {
      this.leaderboardEntries[displayIndex].setText(`▶ You: ${currentScore}`)
      this.leaderboardEntries[displayIndex].setColor('#00FF00')
      this.leaderboardEntries[displayIndex].setFontStyle('bold')
    }
  }

  /**
   * Show milestone notification when player passes someone
   */
  private showMilestoneNotification(passedPlayer: LeaderboardEntry): void {
    // Remove existing notification if any
    if (this.milestoneNotification) {
      if (this.notificationTween) {
        this.notificationTween.stop()
      }
      this.milestoneNotification.destroy()
    }

    // Create notification container
    const notifBg = this.scene.add.rectangle(0, 0, this.widgetWidth - 10, 50, 0x000000, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xFFD700)

    const notifText = this.scene.add.text(0, 0, `You passed\n${passedPlayer.name}!`)
      .setFontFamily('Arial')
      .setFontSize(13)
      .setColor('#FFD700')
      .setAlign('center')
      .setOrigin(0.5)
      .setFontStyle('bold')

    this.milestoneNotification = this.scene.add.container(this.widgetWidth / 2, -30, [notifBg, notifText])
    this.add(this.milestoneNotification)

    // Animate notification: slide in, hold, fade out
    this.notificationTween = this.scene.tweens.add({
      targets: this.milestoneNotification,
      y: 200,
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
      hold: 2000,
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.milestoneNotification,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            if (this.milestoneNotification) {
              this.milestoneNotification.destroy()
              this.milestoneNotification = null
            }
          }
        })
      }
    })
  }

  /**
   * Update personal best record
   */
  updatePersonalBest(): void {
    this.personalBest = ScoreStorageService.getPersonalBest()
    this.personalBestText.setText(`${this.personalBest}`)
  }
}
