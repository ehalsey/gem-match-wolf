import * as Phaser from 'phaser'
import { BOARD_SIZE, MENU_WIDTH } from './constants'
import { HighScoreAPI, LeaderboardEntry } from './api/HighScoreAPI'
import { LocalScores } from './LocalScores'
import { TextButton } from './TextButton'

export default class LeaderboardScene extends Phaser.Scene {
  private highScoreAPI: HighScoreAPI
  private leaderboardContainer: Phaser.GameObjects.Container | null = null
  private loadingText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({
      key: 'LeaderboardScene',
      active: false
    })
  }

  create() {
    this.highScoreAPI = new HighScoreAPI()

    // Background
    const background = this.add.rectangle(0, 0, BOARD_SIZE + MENU_WIDTH, BOARD_SIZE, 0x000000, 0.95)
      .setOrigin(0)
      .setInteractive() // Block clicks to game behind

    // Title
    const title = this.add.text(0, 30, 'LEADERBOARD')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(32)
      .setColor('#FFD700')
      .setFontStyle('bold')

    Phaser.Display.Align.In.TopCenter(title, background, 0, -30)

    // Close button
    const closeButton = new TextButton(this, 0, 0, 'Close')
    closeButton.on('pointerup', () => {
      this.scene.stop('LeaderboardScene')
    })
    Phaser.Display.Align.In.TopRight(closeButton, background, -20, -20)

    // Personal Best section
    this.createPersonalBestSection(background)

    // Loading text
    this.loadingText = this.add.text(0, 0, 'Loading leaderboard...')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('#CCCCCC')

    Phaser.Display.Align.In.Center(this.loadingText, background)

    // Load global leaderboard
    this.loadLeaderboard()
  }

  createPersonalBestSection(background: Phaser.GameObjects.Rectangle) {
    const personalBest = LocalScores.getPersonalBest()

    if (!personalBest) return

    const pbY = 90

    const pbTitle = this.add.text(0, pbY, 'Your Personal Best')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#4CAF50')
      .setFontStyle('bold')

    const pbScore = this.add.text(0, pbY + 30, `${personalBest.score.toLocaleString()} pts`)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(24)
      .setColor('#FFD700')
      .setFontStyle('bold')

    const pbDetails = this.add.text(
      0, pbY + 60,
      `${personalBest.moves} moves | ${personalBest.duration}s | ${personalBest.playerName}`
    )
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#CCCCCC')

    Phaser.Display.Align.In.TopCenter(pbTitle, background, 0, -pbY)
    Phaser.Display.Align.In.TopCenter(pbScore, background, 0, -(pbY + 30))
    Phaser.Display.Align.In.TopCenter(pbDetails, background, 0, -(pbY + 60))

    // Separator line
    const separator = this.add.rectangle(0, pbY + 90, background.width - 80, 2, 0x444444)
      .setOrigin(0.5)
    Phaser.Display.Align.In.TopCenter(separator, background, 0, -(pbY + 90))
  }

  async loadLeaderboard() {
    try {
      const response = await this.highScoreAPI.getLeaderboard(50)

      if (this.loadingText) {
        this.loadingText.destroy()
        this.loadingText = null
      }

      if (!response.success || response.leaderboard.length === 0) {
        const emptyText = this.add.text(0, 0, 'No scores yet. Be the first!')
          .setOrigin(0.5)
          .setFontFamily('Arial')
          .setFontSize(18)
          .setColor('#CCCCCC')

        const background = this.add.rectangle(0, 0, BOARD_SIZE + MENU_WIDTH, BOARD_SIZE, 0x000000, 0)
          .setOrigin(0)
        Phaser.Display.Align.In.Center(emptyText, background, 0, 40)
        return
      }

      this.displayLeaderboard(response.leaderboard)

    } catch (error) {
      console.error('Error loading leaderboard:', error)

      if (this.loadingText) {
        this.loadingText.setText('Failed to load leaderboard')
        this.loadingText.setColor('#FF4444')
      }
    }
  }

  displayLeaderboard(entries: LeaderboardEntry[]) {
    const startY = LocalScores.getPersonalBest() ? 220 : 100
    const rowHeight = 30
    const maxVisible = 15

    // Create scrollable container
    const containerHeight = Math.min(entries.length, maxVisible) * rowHeight
    const background = this.add.rectangle(0, 0, BOARD_SIZE + MENU_WIDTH, BOARD_SIZE, 0x000000, 0)
      .setOrigin(0)

    // Title for global leaderboard
    const globalTitle = this.add.text(0, startY, 'Global Top 50')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('#4CAF50')
      .setFontStyle('bold')
    Phaser.Display.Align.In.TopCenter(globalTitle, background, 0, -startY)

    // Headers
    const headerY = startY + 35
    const rankHeader = this.add.text(50, headerY, 'Rank')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#888888')
      .setFontStyle('bold')

    const nameHeader = this.add.text(150, headerY, 'Name')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#888888')
      .setFontStyle('bold')

    const scoreHeader = this.add.text(MENU_WIDTH + BOARD_SIZE - 180, headerY, 'Score')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#888888')
      .setFontStyle('bold')

    const movesHeader = this.add.text(MENU_WIDTH + BOARD_SIZE - 80, headerY, 'Moves')
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#888888')
      .setFontStyle('bold')

    // Entries
    let y = headerY + 35

    for (let i = 0; i < Math.min(entries.length, maxVisible); i++) {
      const entry = entries[i]

      // Rank
      const rankColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#FFFFFF'
      const rankText = this.add.text(50, y, `#${entry.rank}`)
        .setFontFamily('Arial')
        .setFontSize(16)
        .setColor(rankColor)
        .setFontStyle(i < 3 ? 'bold' : 'normal')

      // Name
      const nameText = this.add.text(150, y, entry.playerName)
        .setFontFamily('Arial')
        .setFontSize(16)
        .setColor('#FFFFFF')

      // Score
      const scoreText = this.add.text(MENU_WIDTH + BOARD_SIZE - 180, y, entry.score.toLocaleString())
        .setFontFamily('Arial')
        .setFontSize(16)
        .setColor('#FFD700')

      // Moves
      const movesText = this.add.text(MENU_WIDTH + BOARD_SIZE - 80, y, entry.moves.toString())
        .setFontFamily('Arial')
        .setFontSize(14)
        .setColor('#CCCCCC')

      y += rowHeight
    }

    if (entries.length > maxVisible) {
      const moreText = this.add.text(0, y + 10, `...and ${entries.length - maxVisible} more`)
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(14)
        .setColor('#888888')
        .setFontStyle('italic')
      Phaser.Display.Align.In.TopCenter(moreText, background, 0, -(y + 10))
    }
  }
}
