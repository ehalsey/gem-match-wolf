import * as Phaser from 'phaser'

import {
  BOARD_SIZE,
  CELL_SIZE,
  MENU_WIDTH,
  NUMBER_OF_CELLS_PER_ROW as size
} from './constants'
import { ConfirmPopup } from './ConfirmPopup'
import { ScoreStorageService } from './ScoreStorageService'
import { LevelSystem, type Challenge, type LevelConfig } from './LevelSystem'
import { MatchDetector } from './game/MatchDetector'
import { PowerUpSystem } from './game/PowerUpSystem'
import { type Cell, type PowerUpType, type Position } from './types'

const gems = [
  'blue',
  'green',
  'red',
  'pink',
  'yellow'
]

/**
 * Number of cells required to trigger an explosion
 */
const explosionThreshold = 3
const swapDuration = 540 // ms (3x slower)
const destroyDuration = 540 // ms (3x slower)

export default class GameScene extends Phaser.Scene {
  board: Cell[][]
  initialBoardState: Array<{row: number, column: number, color: string}> | null
  selectedCell: Cell
  draggedCell: Cell | null
  dragStartX: number
  dragStartY: number
  moveInProgress: boolean
  score: number
  moves: number
  zone: Phaser.GameObjects.Zone
  isGameOver: boolean
  gameOverScreen: Phaser.GameObjects.Container
  debugGraphics: Phaser.GameObjects.Graphics
  debugMode: boolean
  testBoard: string | null
  lastSwap: { from: Position, to: Position } | null
  currentChallenge: Challenge
  levelConfig: LevelConfig
  powerUpSystem: PowerUpSystem

  constructor () {
    super({
      key: 'GameScene',
      active: true
    })
  }

  // Parse URL parameters for testing
  getUrlParams () {
    const params = new URLSearchParams(window.location.search)
    return {
      seed: params.get('seed'),
      debug: params.get('debug') === 'true',
      board: params.get('board')
    }
  }

  preload () {
    gems.forEach(gem => this.load.image(gem, `assets/${gem}.png`))

    // Load power-up sprites
    this.load.image('horizontal-rocket', 'assets/horizontal-rocket.png')
    this.load.image('vertical-rocket', 'assets/vertical-rocket.png')
    this.load.image('tnt', 'assets/tnt.png')
    this.load.image('light-ball', 'assets/light-ball.png')
    this.load.image('fly-away', 'assets/fly-away.png')

    // Load sound effects
    this.load.audio('swap', 'assets/sounds/SwapForward.mp3')
    this.load.audio('swap-back', 'assets/sounds/SwapBackWardSound.mp3')
    this.load.audio('match', 'assets/sounds/MatchSound.mp3')
    this.load.audio('explode', 'assets/sounds/MatchItemExplodeSound.mp3')
    this.load.audio('booster-created', 'assets/sounds/BoosterCreationSound.mp3')
    this.load.audio('rocket', 'assets/sounds/Rocket.mp3')
    this.load.audio('light-ball-sound', 'assets/sounds/LightBallPoweringEffect.wav')
  }

  create () {
    this.cameras.main.setPosition(MENU_WIDTH, 0)
    this.zone = this.add.zone(0, 0, BOARD_SIZE, BOARD_SIZE).setOrigin(0)

    // Parse URL parameters for testing
    const params = this.getUrlParams()
    this.debugMode = params.debug
    this.testBoard = params.board

    // Set seed if provided
    if (params.seed) {
      const seedValue = params.seed
      Phaser.Math.RND.sow([seedValue])
      console.log(`[DEBUG] Seed set to: ${seedValue}`)
    }

    // Log debug mode status
    if (this.debugMode) {
      console.log('[DEBUG] Debug mode enabled')
      console.log('[DEBUG] Available console commands:')
      console.log('  - gameDebug.setSeed(number)')
      console.log('  - gameDebug.spawnPowerup(type, row, col)')
      console.log('  - gameDebug.loadTestBoard(name)')
      console.log('  - gameDebug.logBoard()')
      console.log('  - gameDebug.getWinningMoves()')
      console.log('[DEBUG] Available test boards: match5, match4h, match4v, lshape, rect3x2, rect2x3, square, square-left, tnt-test, double-flyaway')
    }

    this.createBackground()

    // Create particle texture
    this.createParticleTexture()

    // Initialize power-up system
    this.powerUpSystem = new PowerUpSystem(this)

    // Create debug graphics layer
    this.debugGraphics = this.add.graphics()
    this.debugGraphics.setDepth(10000)

    this.initBoard()

    // Save initial board state for retry functionality
    this.saveInitialBoardState()

    // Initialize level and challenge
    this.levelConfig = LevelSystem.getCurrentLevelConfig()
    this.currentChallenge = { ...this.levelConfig.challenge }  // Clone the challenge

    this.setScore(0)
    this.setMoves(this.levelConfig.moves)

    // Notify MenuScene of initial challenge state
    this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
    this.registry.events.emit('LIVES_UPDATED')

    // Expose debug commands to console (always available)
    this.exposeDebugCommands()

    // TODO: clicking on "new game" triggers this...
    this.input.on('pointerdown', this.onPointerDown, this)

    // Set up drag and drop handlers
    this.input.on('dragstart', this.onDragStart, this)
    this.input.on('drag', this.onDrag, this)
    this.input.on('dragend', this.onDragEnd, this)

    this.registry.events.on('NEW_GAME', () => {
      this.handleStartNewGame()
    })
  }

  handleStartNewGame () {
    if (this.isGameOver) {
      this.startNewGame()
    } else {
      const confirmPopup = new ConfirmPopup(this, 0, 0, 'Are you sure you want to start a new game? You will lose current progress!', () => {
        this.startNewGame()
      })
      Phaser.Display.Align.In.Center(confirmPopup, this.zone)
    }
  }

  startNewGame () {
    this.isGameOver = false
    this.destroyBoard()
    this.initBoard()

    // Save initial board state for retry functionality
    this.saveInitialBoardState()

    // Initialize level and challenge
    this.levelConfig = LevelSystem.getCurrentLevelConfig()
    this.currentChallenge = { ...this.levelConfig.challenge }

    this.setScore(0)
    this.setMoves(this.levelConfig.moves)

    // Notify MenuScene of challenge reset and lives update
    this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
    this.registry.events.emit('LIVES_UPDATED')

    if (this.gameOverScreen) {
      this.gameOverScreen.destroy()
      this.gameOverScreen = null
    }
  }

  destroyBoard () {
    this.board.forEach(row => row.forEach(cell => cell.sprite.destroy()))
  }

  createBackground () {
    // Add gradient background
    const bg = this.add.rectangle(
      BOARD_SIZE / 2,
      BOARD_SIZE / 2,
      BOARD_SIZE,
      BOARD_SIZE,
      0x1a1a2e
    )

    // Add checkerboard pattern with softer colors
    this.add.grid(
      BOARD_SIZE / 2, // x
      BOARD_SIZE / 2, // y
      BOARD_SIZE, // width
      BOARD_SIZE, // height
      CELL_SIZE, // cellWidth
      CELL_SIZE // cellHeight
    )
      .setFillStyle(0x16213e, 0.8)
      .setAltFillStyle(0x0f3460, 0.8)
      .setOutlineStyle(0x533483, 0.5)
  }

  createParticleTexture () {
    // Create a simple white circle texture for particles
    const graphics = this.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture('particle', 16, 16)
    graphics.destroy()
  }

  initBoard () {
    // Create empty board
    this.board = createEmptyBoard(size)

    // Check if a test board was requested via URL
    if (this.testBoard) {
      this.loadTestBoard(this.testBoard)
      return
    }

    // Fill board using gem types for current level difficulty
    const levelGems = this.levelConfig ? this.levelConfig.gemTypes : gems
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]

        const possibleColors = []
        for (let color of levelGems) {
          cell.color = color
          // Check for both 3+ matches AND 2x2 squares
          if (!MatchDetector.shouldExplode(cell, this.board) && !MatchDetector.wouldCreate2x2Square(cell, this.board)) {
            possibleColors.push(color)
          }
        }
        cell.color = Phaser.Math.RND.pick(possibleColors)
        cell.empty = false

        const x = column * CELL_SIZE + CELL_SIZE / 2
        const y = row * CELL_SIZE + CELL_SIZE / 2
        cell.sprite = this.add.sprite(x, y, cell.color)
          .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)  // Scale to fit cell with small margin
          .setInteractive({ draggable: true })
      }
    }
  }

  setScore (score: number) {
    this.score = score
    this.registry.set('score', score)
    this.updateChallengeForScore(score)
  }

  setMoves (moves: number) {
    this.moves = moves
    this.registry.set('moves', moves)
  }

  decrementMoves () {
    this.setMoves(this.moves - 1)
    // Note: Don't check level completion here - wait for cascades to finish
  }

  /**
   * Update challenge progress based on score changes
   */
  updateChallengeForScore (newScore: number) {
    if (this.currentChallenge.type === 'score-target') {
      this.currentChallenge.currentValue = newScore
      this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
    }
  }

  /**
   * Update challenge progress when gems are matched
   */
  updateChallengeForMatches (chains: Cell[][]) {
    if (this.currentChallenge.type === 'color-match') {
      const targetColor = this.currentChallenge.color
      let matchedCount = 0

      chains.forEach(chain => {
        chain.forEach(cell => {
          if (cell.color === targetColor) {
            matchedCount++
          }
        })
      })

      if (matchedCount > 0) {
        this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, matchedCount)
        this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
      }
    }
  }

  /**
   * Update challenge progress when power-ups are created
   */
  updateChallengeForPowerUp (powerUpType: PowerUpType) {
    if (this.currentChallenge.type === 'power-up-create') {
      if (powerUpType === this.currentChallenge.powerUpType) {
        this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, 1)
        this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
      }
    }
  }

  /**
   * Check if level is complete or failed
   */
  checkLevelCompletion () {
    const challengeComplete = LevelSystem.isChallengeComplete(this.currentChallenge)

    if (challengeComplete) {
      // Level completed!
      this.gameOver('Level Complete!', true)
    } else if (this.moves <= 0) {
      // Out of moves and challenge not complete - offer retry if lives remain
      const hasLives = LevelSystem.hasLivesRemaining()
      this.gameOver('Out of moves!', false, hasLives)
    }
  }

  /**
   * Save initial board state for retry functionality
   */
  saveInitialBoardState () {
    this.initialBoardState = []
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]
        this.initialBoardState.push({
          row: cell.row,
          column: cell.column,
          color: cell.color
        })
      }
    }
  }

  /**
   * Restore board to initial state for retry
   */
  restoreInitialBoardState () {
    if (!this.initialBoardState) {
      console.error('[RETRY] No initial board state saved!')
      return
    }

    // Destroy current board
    this.destroyBoard()

    // Recreate board with saved state
    this.board = createEmptyBoard(size)

    for (const cellData of this.initialBoardState) {
      const cell = this.board[cellData.row][cellData.column]
      cell.color = cellData.color
      cell.empty = false
      cell.powerup = null

      const x = cellData.column * CELL_SIZE + CELL_SIZE / 2
      const y = cellData.row * CELL_SIZE + CELL_SIZE / 2
      cell.sprite = this.add.sprite(x, y, cell.color)
        .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
        .setInteractive({ draggable: true })
    }

    console.log('[RETRY] Board restored to initial state')
  }

  /**
   * Retry current level with a life
   */
  retryLevel () {
    // Decrement lives
    const remainingLives = LevelSystem.decrementLives()
    console.log(`[RETRY] Lives remaining: ${remainingLives}`)

    // Reset game state
    this.isGameOver = false

    // Restore initial board
    this.restoreInitialBoardState()

    // Reset challenge progress
    this.currentChallenge = { ...this.levelConfig.challenge }

    // Reset score and moves
    this.setScore(0)
    this.setMoves(this.levelConfig.moves)

    // Notify MenuScene
    this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
    this.registry.events.emit('LIVES_UPDATED')

    // Remove game over screen
    if (this.gameOverScreen) {
      this.gameOverScreen.destroy()
      this.gameOverScreen = null
    }
  }

  async onPointerDown (pointer: Phaser.Input.Pointer) {
    // console.log('pointer down', { ...pointer })

    if (pointer.camera !== this.cameras.main) {
      console.log('ignore other cameras')
      return
    }
    if (this.moveInProgress) {
      return
    }

    const pointedCell = this.getCellAt(pointer)

    // Note: Power-ups can no longer be activated by direct click
    // They MUST be swapped/dragged to activate, giving players strategic control
    // to position rockets or choose Light Ball target colors

    if (this.selectedCell == null) {
      this.selectCell(pointedCell)
      return
    }

    const firstCell = this.selectedCell
    const secondCell = pointedCell
    this.deselectCell()

    if (firstCell === secondCell) {
      return
    }

    if (!MatchDetector.cellsAreNeighbours(firstCell, secondCell)) {
      this.selectCell(secondCell)
      return
    }

    this.moveInProgress = true

    // Track the swap for smart power-up positioning (capture positions before swap)
    this.lastSwap = this.captureSwapContext(firstCell, secondCell)

    this.swapCells(firstCell, secondCell)
    this.sound.play('swap', { volume: 0.3 })

    await this.moveSpritesWhereTheyBelong()

    // Check if either swapped cell is a power-up and activate it
    const hasPowerUp = firstCell.powerup || secondCell.powerup
    if (hasPowerUp) {
      console.log('=== POWER-UP SWAPPED! ===')
      if (firstCell.powerup) {
        console.log(`Activating ${firstCell.powerup} at [${firstCell.row}, ${firstCell.column}]`)
        this.triggerPowerUp(firstCell, secondCell)  // Pass the gem it was swapped with
      }
      if (secondCell.powerup) {
        console.log(`Activating ${secondCell.powerup} at [${secondCell.row}, ${secondCell.column}]`)
        this.triggerPowerUp(secondCell, firstCell)  // Pass the gem it was swapped with
      }
      await this.destroyCells()
      await this.makeCellsFall()
      await this.refillBoard()
    }

    if (MatchDetector.boardShouldExplode(this.board) || hasPowerUp) {
      // Valid move - decrement moves counter
      this.decrementMoves()

      let cascades = 0
      while (MatchDetector.boardShouldExplode(this.board)) {
        const chains = MatchDetector.getExplodingChains(this.board)

        // Track challenge progress for matched gems
        this.updateChallengeForMatches(chains)

        console.log('=== BEFORE POWER-UP CREATION ===')
        this.logBoardState()

        // Create power-ups from chains of 4+ gems
        // Pass swap context on first cascade, null on subsequent cascades
        this.powerUpSystem.createPowerUpsFromChains(
          this.board,
          chains,
          (type) => this.updateChallengeForPowerUp(type),
          cascades === 0 ? this.lastSwap : null
        )

        console.log('=== AFTER POWER-UP CREATION ===')
        this.logBoardState()

        // Note: Power-ups are NOT activated on creation - they stay on board
        // They only activate when involved in a future match or swap

        console.log('=== BEFORE DESTROY ===')
        this.logBoardState()

        // Show floating score text for each chain
        this.showFloatingScores(chains, cascades)

        await this.destroyCells()

        console.log('=== AFTER DESTROY ===')
        this.logBoardState()

        this.setScore(this.score + this.computeScore(chains, cascades))

        await this.makeCellsFall()

        await this.refillBoard()

        // TODO: add score in leaderboard

        cascades++
      }

      // Check level completion after all cascades settle
      if (this.moves <= 0) {
        this.checkLevelCompletion()
        return  // Don't check for "no more moves" if game is over
      }

      const winningMoves = this.getWinningMoves()
      console.log(`${winningMoves.length} winning moves`)
      if (this.debugMode) {
        console.log('[DEBUG] Board state after cascades:')
        this.logBoard()
        console.log('[DEBUG] Skipping "no more moves" check in debug mode')
      }
      // Skip game over check in debug mode to allow continued testing
      if (winningMoves.length === 0 && !this.debugMode) {
        this.gameOver('No more moves!')
      }
    } else {
      // Invalid move - swap back and play error sound
      this.sound.play('swap-back', { volume: 0.3 })
      this.swapCells(firstCell, secondCell)
      await this.moveSpritesWhereTheyBelong()
    }

    this.moveInProgress = false
  }

  getWinningMoves (): { cell1: Cell, cell2: Cell }[] {
    const winningMoves: { cell1: Cell, cell2: Cell }[] = []

    for (let row = 0; row < size - 1; row++) {
      for (let column = 0; column < size - 1; column++) {
        const cell = this.board[row][column]
        const right = this.board[row][column + 1]
        const down = this.board[row + 1][column]

        // Swap right
        this.swapCells(cell, right)
        if (MatchDetector.boardShouldExplode(this.board)) {
          winningMoves.push({ cell1: cell, cell2: right })
        }
        this.swapCells(cell, right)

        // Swap down
        this.swapCells(cell, down)
        if (MatchDetector.boardShouldExplode(this.board)) {
          winningMoves.push({ cell1: cell, cell2: down })
        }
        this.swapCells(cell, down)
      }
    }

    return winningMoves
  }

  gameOver (message: string = 'Game Over', isLevelComplete: boolean = false, canRetry: boolean = false) {
    this.isGameOver = true

    // If level complete, advance to next level
    if (isLevelComplete) {
      const nextLevel = LevelSystem.advanceLevel()
      console.log(`Level complete! Advanced to level ${nextLevel}`)
    }

    // Update personal best
    const isNewBest = ScoreStorageService.updatePersonalBest(this.score)

    const gameOverBackground = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    // Color the title based on success or failure
    const titleColor = isLevelComplete ? '#00FF00' : '#FF4444'

    const gameOverTitle = this.add.text(0, -50, message)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(32)
      .setColor(titleColor)
      .setFontStyle('bold')

    const finalScoreText = this.add.text(0, 10, `Final Score: ${this.score}`)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(24)
      .setColor('#FFD700')
      .setFontStyle('bold')

    // Add new best indicator if applicable
    const newBestText = isNewBest ? this.add.text(0, 40, '🎉 New Personal Best! 🎉')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('#00FF00')
      .setFontStyle('bold') : null

    // Add retry button if player can retry
    let retryButton: Phaser.GameObjects.Text | null = null
    if (canRetry) {
      const livesRemaining = LevelSystem.getLives()
      retryButton = this.add.text(0, isNewBest ? 70 : 60, `Retry (${livesRemaining} ❤️ remaining)`)
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(20)
        .setColor('#4da6ff')
        .setFontStyle('bold')
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.retryLevel()
        })
        .on('pointerover', () => {
          retryButton.setColor('#ffffff')
        })
        .on('pointerout', () => {
          retryButton.setColor('#4da6ff')
        })
    }

    // Add next level / new game button
    let actionButton: Phaser.GameObjects.Text | null = null
    if (isLevelComplete) {
      // Show "Next Level" button for successful completion
      actionButton = this.add.text(0, isNewBest ? 70 : 60, 'Next Level →')
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(24)
        .setColor('#00FF00')
        .setFontStyle('bold')
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.startNewGame()
        })
        .on('pointerover', () => {
          actionButton.setColor('#ffffff')
        })
        .on('pointerout', () => {
          actionButton.setColor('#00FF00')
        })
    } else if (!canRetry) {
      // Show "New Game" button when out of lives
      actionButton = this.add.text(0, isNewBest ? 70 : 60, 'New Game')
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(20)
        .setColor('#4da6ff')
        .setFontStyle('bold')
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.registry.events.emit('NEW_GAME')
        })
        .on('pointerover', () => {
          actionButton.setColor('#ffffff')
        })
        .on('pointerout', () => {
          actionButton.setColor('#4da6ff')
        })
    }

    // Small hint text at bottom
    const hintText = canRetry ? 'Or click "New Game" in menu to start over' : ''
    const restartHint = hintText ? this.add.text(0, canRetry ? (isNewBest ? 105 : 95) : (isNewBest ? 70 : 60), hintText)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#666666') : null

    this.gameOverScreen = this.add.container(0, 0)
      .add(gameOverBackground)
      .add(gameOverTitle)
      .add(finalScoreText)
      .setDepth(1)

    if (newBestText) {
      this.gameOverScreen.add(newBestText)
      Phaser.Display.Align.In.Center(newBestText, gameOverBackground, 0, 40)
    }

    if (retryButton) {
      this.gameOverScreen.add(retryButton)
      Phaser.Display.Align.In.Center(retryButton, gameOverBackground, 0, isNewBest ? 70 : 60)
    }

    if (actionButton) {
      this.gameOverScreen.add(actionButton)
      Phaser.Display.Align.In.Center(actionButton, gameOverBackground, 0, isNewBest ? 70 : 60)
    }

    if (restartHint) {
      this.gameOverScreen.add(restartHint)
      Phaser.Display.Align.In.Center(restartHint, gameOverBackground, 0, canRetry ? (isNewBest ? 105 : 95) : (isNewBest ? 70 : 60))
    }

    Phaser.Display.Align.In.Center(gameOverTitle, gameOverBackground, 0, -50)
    Phaser.Display.Align.In.Center(finalScoreText, gameOverBackground, 0, 10)

    // Notify MenuScene to update personal best display
    this.registry.events.emit('PERSONAL_BEST_UPDATED')
  }

  computeScore (chains: Cell[][], cascades: number): number {
    return chains
      .map(chain => 50 * (chain.length + 1 - explosionThreshold))
      .reduce((score, chainScore) => score + chainScore, 0) * (cascades + 1)
  }

  showFloatingScores (chains: Cell[][], cascades: number) {
    for (const chain of chains) {
      // Calculate score for this specific chain
      const chainScore = 50 * (chain.length + 1 - explosionThreshold) * (cascades + 1)

      // Find the center of the chain
      const middleIndex = Math.floor(chain.length / 2)
      const centerCell = chain[middleIndex]

      // Calculate world position
      const x = centerCell.column * CELL_SIZE + CELL_SIZE / 2
      const y = centerCell.row * CELL_SIZE + CELL_SIZE / 2

      // Create floating text
      const scoreText = this.add.text(x, y, `+${chainScore}`, {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#FFD700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
        .setOrigin(0.5)
        .setDepth(100)

      // Animate: float up and fade out
      this.tweens.add({
        targets: scoreText,
        y: y - 80,
        alpha: 0,
        duration: 1500,
        ease: 'Cubic.easeOut',
        onComplete: () => scoreText.destroy()
      })
    }
  }


  activatePowerUps (chains: Cell[][]) {
    // Find all power-ups that are adjacent to matching chains and activate them
    const allChainCells = new Set(chains.flat())

    for (const chain of chains) {
      for (const cell of chain) {
        // Check if this cell or its neighbors have power-ups
        const neighbors = this.getNeighbors(cell)
        for (const neighbor of neighbors) {
          if (neighbor.powerup && !neighbor.empty) {
            this.triggerPowerUp(neighbor)
          }
        }
      }
    }
  }

  getNeighbors (cell: Cell): Cell[] {
    const neighbors: Cell[] = []
    const { row, column } = cell

    // Up
    if (row > 0) neighbors.push(this.board[row - 1][column])
    // Down
    if (row < size - 1) neighbors.push(this.board[row + 1][column])
    // Left
    if (column > 0) neighbors.push(this.board[row][column - 1])
    // Right
    if (column < size - 1) neighbors.push(this.board[row][column + 1])

    return neighbors
  }

  triggerPowerUp (cell: Cell, swappedWith?: Cell, targetedCells?: Set<Cell>) {
    if (!cell.powerup) return

    // Initialize targetedCells Set if this is the first call in the chain
    if (!targetedCells) {
      targetedCells = new Set<Cell>()
    }

    const powerUpType = cell.powerup

    // Play sound based on power-up type
    if (powerUpType === 'light-ball') {
      this.sound.play('light-ball-sound', { volume: 0.4 })
    } else if (powerUpType === 'horizontal-rocket' || powerUpType === 'vertical-rocket') {
      this.sound.play('rocket', { volume: 0.4 })
    } else if (powerUpType === 'tnt') {
      this.sound.play('explode', { volume: 0.5 })
    } else if (powerUpType === 'fly-away') {
      this.sound.play('rocket', { volume: 0.4 })
    }

    // Create power-up activation effects
    const x = cell.column * CELL_SIZE + CELL_SIZE / 2
    const y = cell.row * CELL_SIZE + CELL_SIZE / 2
    this.createPowerUpEffect(x, y, powerUpType, cell)

    // Clear the power-up property and mark for destruction
    cell.powerup = null
    cell.empty = true

    // Mark additional cells based on power-up type
    // Also chain-activate any power-ups we hit
    switch (powerUpType) {
      case 'horizontal-rocket':
        // Destroy entire row
        for (let col = 0; col < size; col++) {
          const targetCell = this.board[cell.row][col]
          // Chain-activate any power-ups in the row
          if (targetCell.powerup && targetCell !== cell) {
            console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
            this.triggerPowerUp(targetCell, undefined, targetedCells)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'vertical-rocket':
        // Destroy entire column
        for (let row = 0; row < size; row++) {
          const targetCell = this.board[row][cell.column]
          // Chain-activate any power-ups in the column
          if (targetCell.powerup && targetCell !== cell) {
            console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
            this.triggerPowerUp(targetCell, undefined, targetedCells)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'light-ball':
        // Destroy all gems of the same color
        // If swapped with a gem, use that gem's color; otherwise pick adjacent color
        let targetColor: string | null = null
        if (swappedWith && !swappedWith.empty && !swappedWith.powerup && swappedWith.color) {
          targetColor = swappedWith.color
          console.log(`Light ball swapped with ${targetColor}, destroying all ${targetColor} gems`)
        } else {
          targetColor = this.getAdjacentGemColor(cell)
          console.log(`Light ball clicked, picking adjacent color: ${targetColor}`)
        }

        if (targetColor) {
          for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
              const targetCell = this.board[row][col]
              if (targetCell.color === targetColor) {
                // Chain-activate any power-ups of matching color
                if (targetCell.powerup) {
                  console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                  this.triggerPowerUp(targetCell, undefined, targetedCells)
                } else {
                  targetCell.empty = true
                }
              }
            }
          }
        }
        break

      case 'tnt':
        // Destroy in a cross pattern (4 directions, 2 cells each)
        const directions = [
          { dr: -1, dc: 0 },  // up
          { dr: 1, dc: 0 },   // down
          { dr: 0, dc: -1 },  // left
          { dr: 0, dc: 1 }    // right
        ]
        for (const dir of directions) {
          // Extend blast radius to 2 cells in each direction
          for (let distance = 1; distance <= 2; distance++) {
            const targetRow = cell.row + (dir.dr * distance)
            const targetCol = cell.column + (dir.dc * distance)
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const targetCell = this.board[targetRow][targetCol]
              if (targetCell.powerup) {
                console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                this.triggerPowerUp(targetCell, undefined, targetedCells)
              } else {
                targetCell.empty = true
              }
            }
          }
        }
        break

      case 'fly-away':
        // Find best target to fly to, explode at start, fly, explode at end
        const bestTarget = this.findBestFlyAwayTarget(cell, targetedCells)
        if (bestTarget) {
          // Mark this target as taken so other fly-aways won't target it
          targetedCells.add(bestTarget)
          
          // First explosion at current position (cross pattern)
          for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
            const targetRow = cell.row + dir.dr
            const targetCol = cell.column + dir.dc
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const targetCell = this.board[targetRow][targetCol]
              // Chain-activate any power-ups hit by the starting explosion
              if (targetCell.powerup) {
                console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}] from fly-away start`)
                this.triggerPowerUp(targetCell, undefined, targetedCells)
              } else {
                targetCell.empty = true
              }
            }
          }

          // Animate fly-away sprite flying to target
          // The target explosion will happen inside the animation's onComplete callback
          this.animateFlyAway(cell, bestTarget)
        }
        break
    }
  }

  findBestFlyAwayTarget (fromCell: Cell, targetedCells?: Set<Cell>): Cell | null {
    // Find the cell with the most matches (best strategic value)
    // Exclude cells that are already targeted by other fly-aways
    let bestCell: Cell | null = null
    let bestScore = 0

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        // Skip if cell is empty, a power-up, the source cell, or already targeted
        if (cell.empty || cell.powerup || cell === fromCell) continue
        if (targetedCells && targetedCells.has(cell)) continue

        // Count how many neighbors match this cell's color
        const neighbors = this.getNeighbors(cell)
        const matchCount = neighbors.filter(n => !n.empty && !n.powerup && n.color === cell.color).length

        if (matchCount > bestScore) {
          bestScore = matchCount
          bestCell = cell
        }
      }
    }

    return bestCell
  }

  animateFlyAway (fromCell: Cell, toCell: Cell) {
    const startX = fromCell.column * CELL_SIZE + CELL_SIZE / 2
    const startY = fromCell.row * CELL_SIZE + CELL_SIZE / 2
    const endX = toCell.column * CELL_SIZE + CELL_SIZE / 2
    const endY = toCell.row * CELL_SIZE + CELL_SIZE / 2

    // Create a temporary sprite for the flying animation
    const flyingSprite = this.add.sprite(startX, startY, 'fly-away')
      .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
      .setDepth(2000)

    // Calculate orbit radius for spinning around target
    const orbitRadius = CELL_SIZE * 0.7

    // Step 1: Fly to target while spinning
    this.tweens.add({
      targets: flyingSprite,
      x: endX,
      y: endY,
      angle: 360,
      duration: 1200,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        // Step 2: Orbit around target once
        let orbitAngle = 0
        this.tweens.add({
          targets: { progress: 0 },
          progress: 1,
          duration: 800,
          ease: 'Linear',
          onUpdate: (tween) => {
            const progress = tween.progress
            orbitAngle = progress * Math.PI * 2
            flyingSprite.x = endX + Math.cos(orbitAngle) * orbitRadius
            flyingSprite.y = endY + Math.sin(orbitAngle) * orbitRadius
            flyingSprite.angle = 360 + (progress * 360)
          },
          onComplete: () => {
            // Create explosion effect at target
            this.createPowerUpEffect(endX, endY, 'fly-away', toCell)

            // NOW destroy the target and surrounding cells (cross pattern)
            for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
              const targetRow = toCell.row + dir.dr
              const targetCol = toCell.column + dir.dc
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                const targetCell = this.board[targetRow][targetCol]
                if (targetCell.powerup) {
                  console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                  this.triggerPowerUp(targetCell)
                } else if (!targetCell.empty) {
                  // Mark empty and visually destroy the cell
                  targetCell.empty = true
                  this.destroyCell(targetCell)
                }
              }
            }
            // Mark target itself for destruction and visually destroy it
            if (!toCell.empty) {
              toCell.empty = true
              this.destroyCell(toCell)
            }

            // Destroy the flying sprite
            flyingSprite.destroy()

            // Wait for destruction animations to complete, then trigger cascade
            this.time.delayedCall(destroyDuration, async () => {
              // Now trigger the fall/refill/cascade logic
              await this.makeCellsFall()
              await this.refillBoard()

              // Continue with cascades if there are more matches
              while (MatchDetector.boardShouldExplode(this.board)) {
                const chains = MatchDetector.getExplodingChains(this.board)
                this.powerUpSystem.createPowerUpsFromChains(
                  this.board,
                  chains,
                  (type) => this.updateChallengeForPowerUp(type),
                  null
                )
                await this.destroyCells()
                this.setScore(this.score + this.computeScore(chains, 0))
                await this.makeCellsFall()
                await this.refillBoard()
              }
            })
          }
        })
      }
    })
  }

  createPowerUpEffect (x: number, y: number, powerUpType: PowerUpType, cell: Cell) {
    if (powerUpType === 'horizontal-rocket') {
      // Create horizontal laser effect
      for (let col = 0; col < size; col++) {
        const particleX = col * CELL_SIZE + CELL_SIZE / 2
        const particles = this.add.particles(particleX, y, 'particle', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 300,
          quantity: 5,
          tint: 0xff6600,
          blendMode: 'ADD'
        })
        this.time.delayedCall(400, () => particles.destroy())
      }
    } else if (powerUpType === 'vertical-rocket') {
      // Create vertical laser effect
      for (let row = 0; row < size; row++) {
        const particleY = row * CELL_SIZE + CELL_SIZE / 2
        const particles = this.add.particles(x, particleY, 'particle', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 300,
          quantity: 5,
          tint: 0xff6600,
          blendMode: 'ADD'
        })
        this.time.delayedCall(400, () => particles.destroy())
      }
    } else if (powerUpType === 'light-ball') {
      // Create massive rainbow explosion
      const particles = this.add.particles(x, y, 'particle', {
        speed: { min: 150, max: 400 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        quantity: 50,
        tint: [0xff0000, 0xff9900, 0xffff00, 0x00ff00, 0x0099ff, 0x9900ff],
        blendMode: 'ADD',
        angle: { min: 0, max: 360 }
      })
      this.time.delayedCall(900, () => particles.destroy())
    } else if (powerUpType === 'tnt') {
      // Create TNT cross explosion (4 directional bursts)
      const directions = [
        { angle: 270, y: -1 },  // up
        { angle: 90, y: 1 },    // down
        { angle: 180, x: -1 },  // left
        { angle: 0, x: 1 }      // right
      ]
      for (const dir of directions) {
        const offsetX = (dir.x || 0) * CELL_SIZE / 2
        const offsetY = (dir.y || 0) * CELL_SIZE / 2
        const particles = this.add.particles(x + offsetX, y + offsetY, 'particle', {
          speed: { min: 100, max: 200 },
          scale: { start: 0.6, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 500,
          quantity: 15,
          tint: [0xff6600, 0xff9900, 0xffcc00],
          blendMode: 'ADD',
          angle: { min: dir.angle - 30, max: dir.angle + 30 }
        })
        this.time.delayedCall(600, () => particles.destroy())
      }
    } else if (powerUpType === 'fly-away') {
      // Create fly-away missile trail effect
      const particles = this.add.particles(x, y, 'particle', {
        speed: { min: 50, max: 150 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 600,
        quantity: 20,
        tint: [0x00ccff, 0x00ffff, 0xffffff],
        blendMode: 'ADD',
        angle: { min: 0, max: 360 }
      })
      this.time.delayedCall(700, () => particles.destroy())
    }
  }

  getAdjacentGemColor (cell: Cell): string | null {
    const neighbors = this.getNeighbors(cell)
    for (const neighbor of neighbors) {
      if (!neighbor.empty && !neighbor.powerup && neighbor.color) {
        return neighbor.color
      }
    }
    return null
  }

  logBoardState () {
    console.log('Board State:')
    for (let row = 0; row < size; row++) {
      const rowData = []
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        const spriteExists = cell.sprite && !cell.sprite.scene ? 'DESTROYED_SPRITE' : 'OK'
        const display = cell.empty
          ? '____'
          : cell.powerup
            ? `[${cell.powerup.substring(0, 4).toUpperCase()}]`
            : cell.color.substring(0, 4).toUpperCase()
        rowData.push(`${display}(${spriteExists})`)
      }
      console.log(`Row ${row}: ${rowData.join(' | ')}`)
    }
  }

  async makeCellsFall () {
    for (let column = 0; column < size; column++) {
      for (let row = size - 1; row >= 0; row--) {
        const cell = this.board[row][column]
        const lowestEmptyCell = this.getLowestEmptyCellBelow(cell)

        if (lowestEmptyCell !== null && !cell.empty) {
          this.swapCells(cell, lowestEmptyCell)
        }
      }
    }
    await this.moveSpritesWhereTheyBelong()
  }

  async refillBoard () {
    // Use gem types from level config for consistent difficulty
    const levelGems = this.levelConfig ? this.levelConfig.gemTypes : gems

    for (let column = 0; column < size; column++) {
      let numberOfEmptyCells = 0
      while (numberOfEmptyCells < size && this.board[numberOfEmptyCells][column].empty) {
        numberOfEmptyCells++
      }

      for (let row = 0; row < numberOfEmptyCells; row++) {
        const cell = this.board[row][column]
        cell.color = Phaser.Math.RND.pick(levelGems)
        cell.empty = false
        cell.powerup = null

        const x = column * CELL_SIZE + CELL_SIZE / 2
        const y = (row - numberOfEmptyCells) * CELL_SIZE + CELL_SIZE / 2
        cell.sprite = this.add.sprite(x, y, cell.color)
          .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)  // Scale to fit cell with small margin
          .setInteractive({ draggable: true })
      }
    }
    await this.moveSpritesWhereTheyBelong()
  }

  async moveSpritesWhereTheyBelong () {
    const cells = this.board.flat()
    const animationsPromises = []

    for (const cell of cells) {
      const sprite = cell.sprite
      const expectedX = cell.column * CELL_SIZE + CELL_SIZE / 2
      const expectedY = cell.row * CELL_SIZE + CELL_SIZE / 2
      if (sprite.x !== expectedX || sprite.y !== expectedY) {
        const animationPromise = new Promise<void>(resolve => {
          this.tweens.add({
            targets: sprite,
            x: expectedX,
            y: expectedY,
            duration: swapDuration,
            onComplete: () => resolve()
          })
        })
        animationsPromises.push(animationPromise)
      }
    }

    await Promise.all(animationsPromises)

    // Update debug display after animations
    this.updateDebugDisplay()
  }

  updateDebugDisplay () {
    // Debug borders disabled
    this.debugGraphics.clear()
  }

  getLowestEmptyCellBelow (cell: Cell): Cell {
    for (let row = size - 1; row > cell.row; row--) {
      const belowCell = this.board[row][cell.column]
      if (belowCell.empty) {
        return belowCell
      }
    }
    return null
  }


  async destroyCells () {
    const cellsToDestroy = this.getCellsToDestroy()

    // Play explosion sound if we're destroying cells
    if (cellsToDestroy.length > 0) {
      this.sound.play('explode', { volume: 0.3 })
    }

    await Promise.all(
      cellsToDestroy.map(cell => this.destroyCell(cell))
    )
  }

  destroyCell (cell: Cell) {
    return new Promise<void>(resolve => {
      cell.empty = true

      // Create particle explosion
      this.createGemParticles(cell)

      // Simple pop: scale up slightly and fade out quickly
      this.tweens.add({
        targets: cell.sprite,
        scale: 1.3,
        alpha: 0,
        duration: destroyDuration,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // IMPORTANT: Destroy the sprite to prevent ghost gems
          if (cell.sprite) {
            cell.sprite.destroy()
            cell.sprite = null
          }
          resolve()
        }
      })
    })
  }

  createGemParticles (cell: Cell) {
    const x = cell.column * CELL_SIZE + CELL_SIZE / 2
    const y = cell.row * CELL_SIZE + CELL_SIZE / 2

    // Get color based on gem type
    const colorMap: { [key: string]: number } = {
      blue: 0x4da6ff,
      green: 0x4dff4d,
      red: 0xff4d4d,
      pink: 0xff66ff,
      yellow: 0xffff4d
    }

    const color = colorMap[cell.color] || 0xffffff

    // Create particle emitter
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: 8,
      tint: color,
      blendMode: 'ADD'
    })

    // Auto-destroy after particles fade
    this.time.delayedCall(500, () => particles.destroy())
  }

  getCellsToDestroy (): Cell[] {
    return this.board.flat().filter(cell =>
      // Destroy cells that should explode (matching 3+) or are marked as empty
      (MatchDetector.shouldExplode(cell, this.board) || cell.empty) && !cell.powerup
    )
  }

  selectCell (cell: Cell) {
    this.selectedCell = cell

    // Quick spin animation on click
    this.tweens.add({
      targets: this.selectedCell.sprite,
      angle: 15,
      duration: 300,
      yoyo: true,
      ease: 'Sine.easeInOut'
    })

    // Add a gentle glow effect by brightening the sprite
    this.selectedCell.sprite.setTint(0xffeeaa)

    // Add a subtle pulse
    this.tweens.add({
      targets: this.selectedCell.sprite,
      alpha: 0.85,
      yoyo: true,
      repeat: -1,
      duration: 1200
    })
  }

  deselectCell () {
    this.tweens.killTweensOf(this.selectedCell.sprite)
    this.selectedCell.sprite.clearTint()
    this.selectedCell.sprite.alpha = 1
    this.selectedCell.sprite.angle = 0
    this.selectedCell = null
  }

  captureSwapContext (firstCell: Cell, secondCell: Cell): { from: Position, to: Position } {
    return {
      from: { row: firstCell.row, column: firstCell.column },
      to: { row: secondCell.row, column: secondCell.column }
    }
  }

  swapCells (firstCell: Cell, secondCell: Cell) {
    const firstCellCopy = { ...firstCell }
    firstCell.row = secondCell.row
    firstCell.column = secondCell.column
    secondCell.row = firstCellCopy.row
    secondCell.column = firstCellCopy.column

    this.board[firstCell.row][firstCell.column] = firstCell
    this.board[secondCell.row][secondCell.column] = secondCell
  }

  getCellAt (pointer: Phaser.Input.Pointer): Cell {
    const row = Math.floor(pointer.worldY / CELL_SIZE)
    const column = Math.floor(pointer.worldX / CELL_SIZE)

    return this.board[row][column]
  }

  onDragStart (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Sprite) {
    if (this.moveInProgress) {
      console.log('Drag blocked: move in progress')
      return
    }

    // Find the cell for this sprite
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.sprite === gameObject) {
          this.draggedCell = cell
          this.dragStartX = gameObject.x
          this.dragStartY = gameObject.y

          console.log(`Drag started on ${cell.color} at [${cell.row}, ${cell.column}]`)

          // Bring sprite to top and make it slightly larger (1.17x = 0.9 * 1.3)
          gameObject.setDepth(1000)
          gameObject.setDisplaySize(CELL_SIZE * 1.17, CELL_SIZE * 1.17)

          // Clear any selection
          if (this.selectedCell) {
            this.deselectCell()
          }

          this.updateDebugDisplay()
          return
        }
      }
    }
  }

  onDrag (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Sprite, dragX: number, dragY: number) {
    if (!this.draggedCell || this.moveInProgress) {
      return
    }

    // Make sprite follow pointer
    gameObject.x = dragX
    gameObject.y = dragY
  }

  async onDragEnd (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Sprite) {
    if (!this.draggedCell || this.moveInProgress) {
      console.log('Drag end blocked:', !this.draggedCell ? 'no dragged cell' : 'move in progress')
      return
    }

    const draggedCell = this.draggedCell

    // ALWAYS reset sprite appearance immediately, no matter what
    gameObject.setDepth(0)
    gameObject.setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
    gameObject.setAlpha(1)

    // Stop any running tweens on this sprite
    this.tweens.killTweensOf(gameObject)

    // Determine which cell we're over
    const targetRow = Math.floor(pointer.worldY / CELL_SIZE)
    const targetCol = Math.floor(pointer.worldX / CELL_SIZE)

    console.log(`Drag ended at [${targetRow}, ${targetCol}], dragged from [${draggedCell.row}, ${draggedCell.column}]`)

    // Check if target is valid and is a neighbor
    if (
      targetRow >= 0 && targetRow < size &&
      targetCol >= 0 && targetCol < size
    ) {
      const targetCell = this.board[targetRow][targetCol]
      console.log(`Target cell: ${targetCell.color} at [${targetCell.row}, ${targetCell.column}]`)

      // If it's the same cell, check if it's a power-up and activate it
      if (targetCell === draggedCell) {
        console.log('Same cell - checking for power-up activation')

        if (draggedCell.powerup) {
          // Activate the power-up without swapping
          console.log(`=== POWER-UP ACTIVATED (click) ===`)
          console.log(`Activating ${draggedCell.powerup} at [${draggedCell.row}, ${draggedCell.column}]`)

          this.moveInProgress = true
          this.draggedCell = null

          // Log BEFORE power-up activation
          console.log('\n🔵 BEFORE POWER-UP TRIGGER:')
          this.logBoard()

          // Trigger the power-up (no swappedWith parameter for click activation)
          this.triggerPowerUp(draggedCell)

          console.log('\n🟡 AFTER POWER-UP TRIGGER (before destroy/fall/refill):')
          this.logBoard()

          await this.destroyCells()
          await this.makeCellsFall()
          await this.refillBoard()

          console.log('\n🟢 AFTER DESTROY/FALL/REFILL:')
          this.logBoard()

          // Decrement moves for using the power-up
          this.decrementMoves()

          // Continue game loop for cascades
          let cascades = 0
          while (MatchDetector.boardShouldExplode(this.board)) {
            const chains = MatchDetector.getExplodingChains(this.board)

            // Track challenge progress for matched gems
            this.updateChallengeForMatches(chains)

            this.powerUpSystem.createPowerUpsFromChains(
              this.board,
              chains,
              (type) => this.updateChallengeForPowerUp(type),
              null
            )
            this.showFloatingScores(chains, cascades)
            await this.destroyCells()
            await this.makeCellsFall()
            await this.refillBoard()
            cascades++
          }

          // Check level completion after all cascades settle
          if (this.moves <= 0) {
            this.checkLevelCompletion()
          }

          this.moveInProgress = false
          this.updateDebugDisplay()
        } else {
          // Not a power-up, just snap back
          console.log('Not a power-up - snapping back')
          gameObject.x = this.dragStartX
          gameObject.y = this.dragStartY
          this.draggedCell = null
          this.updateDebugDisplay()
        }
        return
      }

      // If it's a neighbor, perform the swap
      const areNeighbors = MatchDetector.cellsAreNeighbours(draggedCell, targetCell)
      console.log(`Are neighbors: ${areNeighbors}`)
      if (areNeighbors) {
        const firstCell = draggedCell
        const secondCell = targetCell

        console.log('Performing swap...')
        this.moveInProgress = true
        this.draggedCell = null

        // Track the swap for smart power-up positioning (capture positions before swap)
        this.lastSwap = this.captureSwapContext(firstCell, secondCell)

        this.swapCells(firstCell, secondCell)
        this.sound.play('swap', { volume: 0.3 })

        console.log('Moving sprites...')
        await this.moveSpritesWhereTheyBelong()
        console.log('Sprites moved')

        // Check if either swapped cell is a power-up and activate it
        const hasPowerUp = firstCell.powerup || secondCell.powerup
        if (hasPowerUp) {
          console.log('=== POWER-UP SWAPPED (via drag)! ===')

          console.log('\n🔵 BEFORE POWER-UP TRIGGER (swap):')
          this.logBoard()

          if (firstCell.powerup) {
            console.log(`Activating ${firstCell.powerup} at [${firstCell.row}, ${firstCell.column}]`)
            this.triggerPowerUp(firstCell, secondCell)  // Pass the gem it was swapped with
          }
          if (secondCell.powerup) {
            console.log(`Activating ${secondCell.powerup} at [${secondCell.row}, ${secondCell.column}]`)
            this.triggerPowerUp(secondCell, firstCell)  // Pass the gem it was swapped with
          }

          console.log('\n🟡 AFTER POWER-UP TRIGGER (swap, before destroy/fall/refill):')
          this.logBoard()

          await this.destroyCells()
          await this.makeCellsFall()
          await this.refillBoard()

          console.log('\n🟢 AFTER DESTROY/FALL/REFILL (swap):')
          this.logBoard()
        }

        const shouldExplode = MatchDetector.boardShouldExplode(this.board)
        const hasSpecialPatterns = this.powerUpSystem.hasSpecialPatterns(this.board, this.lastSwap)
        console.log(`Board should explode: ${shouldExplode}, has power-up: ${hasPowerUp}, has special patterns: ${hasSpecialPatterns}`)

        if (shouldExplode || hasPowerUp || hasSpecialPatterns) {
          // Valid move - decrement moves counter
          console.log('Valid move! Processing...')
          this.decrementMoves()

          let cascades = 0

          // First, handle special patterns if they exist but no regular matches
          if (hasSpecialPatterns && !shouldExplode) {
            console.log('Processing special patterns without regular matches')
            const patterns = this.powerUpSystem.detectSpecialPatterns(this.board, this.lastSwap)

            // Create synthetic chains from pattern cells
            const syntheticChains = patterns.map(p => p.cells)

            // Track challenge progress for matched gems
            this.updateChallengeForMatches(syntheticChains)

            // Create power-ups from the special patterns
            this.powerUpSystem.createPowerUpsFromChains(
              this.board,
              syntheticChains,
              (type) => this.updateChallengeForPowerUp(type),
              this.lastSwap
            )

            this.showFloatingScores(syntheticChains, cascades)
            await this.destroyCells()
            await this.makeCellsFall()
            await this.refillBoard()
            cascades++
          }

          // Then continue with regular cascade loop for any subsequent matches
          while (MatchDetector.boardShouldExplode(this.board)) {
            const chains = MatchDetector.getExplodingChains(this.board)

            // Track challenge progress for matched gems
            this.updateChallengeForMatches(chains)

            console.log('=== BEFORE POWER-UP CREATION (drag) ===')
            this.logBoardState()

            // Create power-ups from chains of 4+ gems
            // Pass swap context on first cascade, null on subsequent cascades
            this.powerUpSystem.createPowerUpsFromChains(
              this.board,
              chains,
              (type) => this.updateChallengeForPowerUp(type),
              cascades === 0 ? this.lastSwap : null
            )

            console.log('=== AFTER POWER-UP CREATION (drag) ===')
            this.logBoardState()

            console.log('=== BEFORE DESTROY (drag) ===')
            this.logBoardState()

            // Show floating score text for each chain
            this.showFloatingScores(chains, cascades)

            await this.destroyCells()

            console.log('=== AFTER DESTROY (drag) ===')
            this.logBoardState()

            this.setScore(this.score + this.computeScore(chains, cascades))

            await this.makeCellsFall()

            await this.refillBoard()

            cascades++
          }

          // Check level completion after all cascades settle
          if (this.moves <= 0) {
            this.checkLevelCompletion()
            this.moveInProgress = false
            this.updateDebugDisplay()
            return  // Don't check for "no more moves" if game is over
          }

          const winningMoves = this.getWinningMoves()
          console.log(`${winningMoves.length} winning moves`)
          if (this.debugMode) {
            console.log('[DEBUG] Skipping "no more moves" check in debug mode')
          }
          // Skip game over check in debug mode to allow continued testing
          if (winningMoves.length === 0 && !this.debugMode) {
            this.gameOver('No more moves!')
          }
        } else {
          // Invalid move - swap back and play error sound
          console.log('Invalid move! Swapping back...')
          this.sound.play('swap-back', { volume: 0.3 })
          this.swapCells(firstCell, secondCell)
          await this.moveSpritesWhereTheyBelong()
          console.log('Swapped back to original positions')
        }

        console.log('Move complete, setting moveInProgress to false')
        this.moveInProgress = false
        return
      }
    }

    // Not a valid neighbor or out of bounds - snap back to original position
    console.log('Not a valid neighbor or out of bounds - snapping back')
    gameObject.x = this.dragStartX
    gameObject.y = this.dragStartY
    this.draggedCell = null
    this.updateDebugDisplay()
  }

  // ===== DEBUG / TESTING METHODS =====

  exposeDebugCommands () {
    // Make debug methods accessible via console
    if (typeof window !== 'undefined') {
      (window as any).gameDebug = {
        setSeed: (seed: number) => this.setSeed(seed),
        spawnPowerup: (type: PowerUpType, row: number, col: number) => this.spawnPowerup(type, row, col),
        loadTestBoard: (name: string) => this.loadTestBoard(name),
        logBoard: () => this.logBoard(),
        getWinningMoves: () => this.getWinningMoves()
      }
    }
  }

  setSeed (seed: number) {
    Phaser.Math.RND.sow([seed.toString()])
    console.log(`[DEBUG] Random seed set to: ${seed}`)
    console.log('[DEBUG] Restart the game to see the effect')
  }

  spawnPowerup (type: PowerUpType, row: number, col: number) {
    if (row < 0 || row >= size || col < 0 || col >= size) {
      console.error(`[DEBUG] Invalid position: [${row}, ${col}]`)
      return
    }

    const cell = this.board[row][col]
    if (cell.empty) {
      console.error(`[DEBUG] Cannot spawn powerup on empty cell at [${row}, ${col}]`)
      return
    }

    cell.powerup = type
    cell.sprite.destroy()

    const x = col * CELL_SIZE + CELL_SIZE / 2
    const y = row * CELL_SIZE + CELL_SIZE / 2
    cell.sprite = this.add.sprite(x, y, type)
      .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
      .setInteractive({ draggable: true })

    console.log(`[DEBUG] Spawned ${type} at [${row}, ${col}]`)
  }

  loadTestBoard (name: string) {
    console.log(`[DEBUG] Loading test board: ${name}`)

    // Handle special test boards with power-ups
    if (name === 'tnt-test' || name === 'bomb-test') {
      // Load a simple test board for TNT
      const tntTestBoard = [
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ]

      // Load the board
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = tntTestBoard[row][col]

          if (cell.sprite) {
            cell.sprite.destroy()
          }

          cell.color = newColor
          cell.powerup = null
          cell.empty = false

          const x = col * CELL_SIZE + CELL_SIZE / 2
          const y = row * CELL_SIZE + CELL_SIZE / 2
          cell.sprite = this.add.sprite(x, y, cell.color)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
            .setInteractive({ draggable: true })
        }
      }

      // Spawn TNT in the center
      this.spawnPowerup('tnt', 4, 4)
      console.log(`[DEBUG] Loaded ${name} with TNT at center [4, 4]`)
      console.log('[DEBUG] Click the TNT to test blast radius (should destroy 2 cells in each direction)')
      return
    }

    if (name === 'double-flyaway') {
      // Load a simple test board for double fly-away testing
      const doubleFlyawayBoard = [
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ]

      // Load the board
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = doubleFlyawayBoard[row][col]

          if (cell.sprite) {
            cell.sprite.destroy()
          }

          cell.color = newColor
          cell.powerup = null
          cell.empty = false

          const x = col * CELL_SIZE + CELL_SIZE / 2
          const y = row * CELL_SIZE + CELL_SIZE / 2
          cell.sprite = this.add.sprite(x, y, cell.color)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
            .setInteractive({ draggable: true })
        }
      }

      // Spawn 2 fly-away power-ups next to each other
      this.spawnPowerup('fly-away', 4, 3)
      this.spawnPowerup('fly-away', 4, 4)
      console.log(`[DEBUG] Loaded ${name} with 2 fly-away power-ups at [4,3] and [4,4]`)
      console.log('[DEBUG] Click one to activate and test interaction between adjacent fly-aways')
      return
    }

    // Predefined test boards
    const testBoards: { [key: string]: string[][] } = {
      match5: [
        ['blue', 'blue', 'blue', 'blue', 'blue', 'red', 'green', 'yellow'],
        ['red', 'green', 'yellow', 'pink', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'green', 'yellow', 'pink', 'blue'],
        ['green', 'yellow', 'pink', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'blue', 'red', 'green', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'blue', 'red', 'green'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'blue', 'red', 'green'],
        ['red', 'green', 'yellow', 'pink', 'blue', 'red', 'green', 'yellow']
      ],
      lshape: [
        ['red', 'red', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'green', 'red', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['yellow', 'pink', 'red', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ],
      // Fly-away test from RIGHT: swap blue [1,1] with red [1,0] (swap FROM right cell TO left)
      // Pattern: [0,0]=red [0,1]=red [1,0]=red [1,1]=blue → swap to complete 2x2
      square: [
        ['red', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'green'],
        ['red', 'blue', 'red', 'pink', 'yellow', 'green', 'yellow', 'yellow'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ],
      // Fly-away test from LEFT: swap blue [1,0] with red [1,1] (swap FROM left cell TO right)
      // Pattern: [0,0]=red [0,1]=red [1,0]=blue [1,1]=red → swap to complete 2x2
      'square-left': [
        ['red', 'red', 'green', 'yellow', 'green', 'yellow', 'blue', 'green'],
        ['blue', 'red', 'yellow', 'green', 'yellow', 'green', 'green', 'yellow'],
        ['red', 'green', 'yellow', 'blue', 'red', 'green', 'yellow', 'green'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ],
      match4h: [
        ['blue', 'blue', 'blue', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ],
      match4v: [
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['red', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['red', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['red', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['pink', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['yellow', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['yellow', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow']
      ],
      rect3x2: [
        ['red', 'red', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['red', 'red', 'red', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ],
      rect2x3: [
        ['red', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'green'],
        ['red', 'red', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['red', 'red', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ]
    }

    if (!testBoards[name]) {
      console.error(`[DEBUG] Test board '${name}' not found. Available: ${Object.keys(testBoards).join(', ')}`)
      return
    }

    const boardConfig = testBoards[name]
    console.log(`[DEBUG] Loading ${name} with ${boardConfig.length} rows`)

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        const newColor = boardConfig[row][col]

        // Only update if color is different OR sprite doesn't exist
        if (cell.color !== newColor || !cell.sprite) {
          // Destroy existing sprite if it exists
          if (cell.sprite) {
            cell.sprite.destroy()
          }

          cell.color = newColor
          cell.powerup = null
          cell.empty = false

          const x = col * CELL_SIZE + CELL_SIZE / 2
          const y = row * CELL_SIZE + CELL_SIZE / 2

          // Check if texture exists
          if (!this.textures.exists(cell.color)) {
            console.error(`[DEBUG] Texture '${cell.color}' does not exist at [${row},${col}]!`)
          }

          cell.sprite = this.add.sprite(x, y, cell.color)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
            .setInteractive({ draggable: true })
        }
      }
    }

    console.log(`[DEBUG] Loaded test board: ${name}`)
  }

  logBoard () {
    console.log('========================================')
    console.log('[DEBUG] Current Board State:')
    console.log('========================================')
    for (let row = 0; row < size; row++) {
      const rowData = []
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.empty) {
          rowData.push('____')
        } else if (cell.powerup) {
          rowData.push(`[${cell.powerup.substring(0, 4).toUpperCase()}]`)
        } else {
          rowData.push(cell.color.substring(0, 4).toUpperCase())
        }
      }
      console.log(`Row ${row}: ${rowData.join(' | ')}`)
    }

    // Check for sprite inconsistencies (ghost gems)
    console.log('\n[DEBUG] Sprite Check:')
    let ghostCount = 0
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.empty && cell.sprite && cell.sprite.active) {
          console.warn(`  ⚠️  GHOST: Empty cell [${row},${col}] has active sprite!`)
          ghostCount++
        }
        if (!cell.empty && (!cell.sprite || !cell.sprite.active)) {
          console.warn(`  ⚠️  MISSING: Non-empty cell [${row},${col}] (${cell.color}) has no active sprite!`)
          ghostCount++
        }
      }
    }
    if (ghostCount === 0) {
      console.log('  ✓ No sprite inconsistencies detected')
    } else {
      console.error(`  ✗ Found ${ghostCount} sprite inconsistencies!`)
    }
    console.log('========================================\n')
  }
}

function createEmptyBoard (size: number): Cell[][] {
  const board = new Array(size)
  for (let row = 0; row < size; row++) {
    board[row] = new Array(size)
    for (let column = 0; column < size; column++) {
      board[row][column] = { row, column, color: null, sprite: null, empty: true, powerup: null }
    }
  }
  return board
}
