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
  undoSnapshot: {
    board: Array<{row: number, column: number, color: string | null, powerup: PowerUpType | null, empty: boolean}>,
    score: number,
    moves: number
  } | null
  currentCombo: number
  comboText: Phaser.GameObjects.Text | null
  comboContainer: Phaser.GameObjects.Container | null
  winningMovesCache: { hash: string, moves: { cell1: Cell, cell2: Cell }[] } | null

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
      console.log('  - gameDebug.exportBoard() - Export current board state as JSON')
      console.log('  - gameDebug.captureMove(fromRow, fromCol, toRow, toCol, expectedBehavior) - Bug reporting tool')
      console.log('[DEBUG] Keyboard shortcuts:')
      console.log('  - U or Z: Undo last move')
      console.log('[DEBUG] Available test boards: match5, match4h, match4v, lshape-right-up, lshape-left-up, lshape-right-down, lshape-left-down, tshape-down, tshape-up, tshape-right, tshape-left, rect3x2, rect2x3, square, square-left, square-expand, tnt-test, double-flyaway, vertical-rocket-combo, horizontal-rocket-combo')
    }

    this.createBackground()

    // Create particle texture
    this.createParticleTexture()

    // Initialize power-up system
    this.powerUpSystem = new PowerUpSystem(this)

    // Initialize undo snapshot
    this.undoSnapshot = null

    // Create debug graphics layer
    this.debugGraphics = this.add.graphics()
    this.debugGraphics.setDepth(10000)

    this.initBoard()

    // Save initial board state for retry functionality
    this.saveInitialBoardState()

    // Initialize level and challenge
    this.levelConfig = LevelSystem.getCurrentLevelConfig()
    this.currentChallenge = { ...this.levelConfig.challenge }  // Clone the challenge

    // Load cumulative score from storage (score persists across levels)
    this.setScore(LevelSystem.getScore())
    this.setMoves(this.levelConfig.moves)

    // Notify MenuScene of initial challenge state
    this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
    this.registry.events.emit('LIVES_UPDATED')

    // Initialize combo system
    this.currentCombo = 0
    this.comboText = null
    this.comboContainer = null
    this.createComboDisplay()

    // Initialize winning moves cache
    this.winningMovesCache = null

    // Expose debug commands to console (always available)
    this.exposeDebugCommands()

    // TODO: clicking on "new game" triggers this...
    this.input.on('pointerdown', this.onPointerDown, this)

    // Set up drag and drop handlers
    this.input.on('dragstart', this.onDragStart, this)
    this.input.on('drag', this.onDrag, this)
    this.input.on('dragend', this.onDragEnd, this)

    // Set up keyboard handler for undo
    this.input.keyboard?.on('keydown-U', this.handleUndo, this)
    this.input.keyboard?.on('keydown-Z', this.handleUndo, this)

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
    this.undoSnapshot = null
    this.destroyBoard()
    this.initBoard()

    // Save initial board state for retry functionality
    this.saveInitialBoardState()

    // Reset level system to level 1 (this also resets score and lives)
    LevelSystem.reset()

    // Initialize level and challenge
    this.levelConfig = LevelSystem.getCurrentLevelConfig()
    this.currentChallenge = { ...this.levelConfig.challenge }

    // Score already reset to 0 by LevelSystem.reset()
    this.setScore(LevelSystem.getScore())
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
    // Score is tracked for leaderboards but is NOT a challenge win condition
    // Also persist to storage for cumulative scoring
    LevelSystem.setScore(score)
  }

  addScore (points: number) {
    // Add points to cumulative score and update local variable
    const newScore = LevelSystem.addScore(points)
    this.score = newScore
    this.registry.set('score', newScore)
  }

  setMoves (moves: number) {
    this.moves = moves
    this.registry.set('moves', moves)
  }

  createComboDisplay () {
    // Create a container for the combo display (centered at top of board)
    this.comboContainer = this.add.container(BOARD_SIZE / 2, 80)
    this.comboContainer.setDepth(3000)
    this.comboContainer.setAlpha(0) // Start hidden

    // Create background circle/badge
    const background = this.add.circle(0, 0, 50, 0x000000, 0.7)

    // Create combo text
    this.comboText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Create multiplier label
    const label = this.add.text(0, 30, 'COMBO', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.comboContainer.add([background, this.comboText, label])
  }

  updateComboDisplay (combo: number) {
    if (!this.comboText || !this.comboContainer) return

    this.currentCombo = combo

    if (combo <= 1) {
      // Hide combo display for no combo or first cascade
      this.tweens.add({
        targets: this.comboContainer,
        alpha: 0,
        scale: 0.8,
        duration: 300,
        ease: 'Power2'
      })
      return
    }

    // Update text
    this.comboText.setText(`${combo}x`)

    // Color based on combo level
    let color = '#ffffff'
    let backgroundColor = 0x000000
    if (combo >= 5) {
      color = '#ff0000' // Red for 5x+
      backgroundColor = 0x660000
    } else if (combo >= 4) {
      color = '#ff8800' // Orange for 4x
      backgroundColor = 0x663300
    } else if (combo >= 3) {
      color = '#ffff00' // Yellow for 3x
      backgroundColor = 0x666600
    } else {
      color = '#00ff00' // Green for 2x
      backgroundColor = 0x006600
    }

    this.comboText.setColor(color)

    // Update background color
    const background = this.comboContainer.getAt(0) as Phaser.GameObjects.Arc
    background.setFillStyle(backgroundColor, 0.8)

    // Show and pulse animation
    this.tweens.add({
      targets: this.comboContainer,
      alpha: 1,
      scale: 1.2,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut'
    })

    // Create particle burst effect
    this.createComboParticles(combo)
  }

  createComboParticles (combo: number) {
    const x = BOARD_SIZE / 2
    const y = 80

    // Particle count and color based on combo level
    let particleCount = Math.min(combo * 5, 30)
    let tintColor = 0x00ff00 // Green

    if (combo >= 5) {
      tintColor = 0xff0000 // Red
    } else if (combo >= 4) {
      tintColor = 0xff8800 // Orange
    } else if (combo >= 3) {
      tintColor = 0xffff00 // Yellow
    }

    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: particleCount,
      tint: tintColor,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 }
    })

    // Auto-destroy particles after they're done
    this.time.delayedCall(700, () => particles.destroy())
  }

  resetCombo () {
    this.currentCombo = 0
    this.updateComboDisplay(0)
  }

  decrementMoves () {
    this.setMoves(this.moves - 1)
    // Note: Don't check level completion here - wait for cascades to finish
  }

  /**
   * Update challenge progress based on score changes
   */
  // Removed: Score is no longer a challenge type
  // Score is always tracked but only for leaderboards, not level completion

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
   * Create a snapshot of the current board state for undo
   */
  createBoardSnapshot () {
    this.undoSnapshot = {
      board: [],
      score: this.score,
      moves: this.moves
    }

    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]
        this.undoSnapshot.board.push({
          row: cell.row,
          column: cell.column,
          color: cell.color,
          powerup: cell.powerup,
          empty: cell.empty
        })
      }
    }

    console.log('[UNDO] Board snapshot created')
  }

  /**
   * Restore board from the last snapshot
   */
  restoreBoardSnapshot () {
    if (!this.undoSnapshot) {
      console.log('[UNDO] No snapshot available to restore')
      return
    }

    // Destroy current board sprites
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]
        if (cell.sprite) {
          cell.sprite.destroy()
        }
      }
    }

    // Restore board state from snapshot
    for (const cellData of this.undoSnapshot.board) {
      const cell = this.board[cellData.row][cellData.column]
      cell.color = cellData.color
      cell.empty = cellData.empty
      cell.powerup = cellData.powerup

      // Create sprite if cell is not empty
      if (!cell.empty) {
        const x = cellData.column * CELL_SIZE + CELL_SIZE / 2
        const y = cellData.row * CELL_SIZE + CELL_SIZE / 2
        const spriteKey = cell.powerup || cell.color
        cell.sprite = this.add.sprite(x, y, spriteKey!)
          .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
          .setInteractive({ draggable: true })
      } else {
        cell.sprite = null
      }
    }

    // Restore score and moves
    this.setScore(this.undoSnapshot.score)
    this.setMoves(this.undoSnapshot.moves)

    console.log('[UNDO] Board restored from snapshot')
  }

  /**
   * Handle undo keyboard shortcut (U or Z key)
   */
  handleUndo () {
    if (this.moveInProgress) {
      console.log('[UNDO] Cannot undo while move is in progress')
      return
    }

    if (this.isGameOver) {
      console.log('[UNDO] Cannot undo when game is over')
      return
    }

    this.restoreBoardSnapshot()
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

    // DON'T reset score - it's cumulative across all levels
    // Only reset moves
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

    const hasSpecialPatterns = this.powerUpSystem.hasSpecialPatterns(this.board, this.lastSwap)
    if (MatchDetector.boardShouldExplode(this.board) || hasPowerUp || hasSpecialPatterns) {
      // Valid move - decrement moves counter
      this.decrementMoves()

      let cascades = 0
      while (MatchDetector.boardShouldExplode(this.board) || this.powerUpSystem.hasSpecialPatterns(this.board)) {
        const chains = MatchDetector.getExplodingChains(this.board)

        // Track challenge progress for matched gems
        this.updateChallengeForMatches(chains)

        console.log('=== BEFORE POWER-UP CREATION ===')
        this.logBoardState()

        // Create power-ups from chains of 4+ gems AND special patterns
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

        this.addScore(this.computeScore(chains, cascades))

        await this.makeCellsFall()

        await this.refillBoard()

        // TODO: add score in leaderboard

        cascades++

        // Update combo display
        this.updateComboDisplay(cascades + 1)
      }

      // Reset combo after cascades finish
      this.resetCombo()

      // Check level completion after all cascades settle
      this.checkLevelCompletion()

      // Don't check for "no more moves" if game is over
      if (this.moves <= 0) {
        return
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

  getBoardHash (): string {
    // Create a compact hash of the board state for caching
    let hash = ''
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.empty) {
          hash += 'E'
        } else if (cell.powerup) {
          hash += cell.powerup[0].toUpperCase()
        } else {
          hash += (cell.color || 'x')[0]
        }
      }
    }
    return hash
  }

  invalidateWinningMovesCache () {
    this.winningMovesCache = null
  }

  getWinningMoves (): { cell1: Cell, cell2: Cell }[] {
    // Check cache first
    const currentHash = this.getBoardHash()
    if (this.winningMovesCache && this.winningMovesCache.hash === currentHash) {
      return this.winningMovesCache.moves
    }

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

    // Cache the result
    this.winningMovesCache = { hash: currentHash, moves: winningMoves }

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
      const baseScore = 50 * (chain.length + 1 - explosionThreshold)
      const multiplier = cascades + 1
      const chainScore = baseScore * multiplier

      // Find the center of the chain
      const middleIndex = Math.floor(chain.length / 2)
      const centerCell = chain[middleIndex]

      // Calculate world position
      const x = centerCell.column * CELL_SIZE + CELL_SIZE / 2
      const y = centerCell.row * CELL_SIZE + CELL_SIZE / 2

      // Color based on multiplier
      let scoreColor = '#FFD700' // Gold
      let strokeColor = '#000000'
      if (multiplier >= 5) {
        scoreColor = '#FF0000' // Red for 5x+
        strokeColor = '#660000'
      } else if (multiplier >= 4) {
        scoreColor = '#FF8800' // Orange for 4x
        strokeColor = '#663300'
      } else if (multiplier >= 3) {
        scoreColor = '#FFFF00' // Yellow for 3x
        strokeColor = '#666600'
      } else if (multiplier >= 2) {
        scoreColor = '#00FF00' // Green for 2x
        strokeColor = '#006600'
      }

      // Create floating score text
      const scoreText = this.add.text(x, y, `+${chainScore}`, {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: scoreColor,
        fontStyle: 'bold',
        stroke: strokeColor,
        strokeThickness: 4
      })
        .setOrigin(0.5)
        .setDepth(100)

      // Show multiplier if > 1x
      if (multiplier > 1) {
        const multiplierText = this.add.text(x, y + 35, `x${multiplier}`, {
          fontSize: '18px',
          fontFamily: 'Arial',
          color: scoreColor,
          fontStyle: 'bold',
          stroke: strokeColor,
          strokeThickness: 3
        })
          .setOrigin(0.5)
          .setDepth(100)

        // Animate multiplier text with score
        this.tweens.add({
          targets: multiplierText,
          y: y - 45,
          alpha: 0,
          duration: 1500,
          ease: 'Cubic.easeOut',
          onComplete: () => multiplierText.destroy()
        })

        // Add extra sparkle particles for combos
        const particles = this.add.particles(x, y, 'particle', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 500,
          quantity: multiplier * 2,
          tint: this.getColorTintFromHex(scoreColor),
          blendMode: 'ADD',
          angle: { min: 0, max: 360 }
        })

        this.time.delayedCall(600, () => particles.destroy())
      }

      // Animate: float up and fade out with scale
      this.tweens.add({
        targets: scoreText,
        y: y - 80,
        alpha: 0,
        scale: multiplier > 1 ? 1.3 : 1,
        duration: 1500,
        ease: 'Cubic.easeOut',
        onComplete: () => scoreText.destroy()
      })
    }
  }

  getColorTintFromHex (hexColor: string): number {
    // Convert hex color string to number for particle tint
    return parseInt(hexColor.replace('#', '0x'))
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

  async triggerPowerUp (cell: Cell, swappedWith?: Cell, targetedCells?: Set<Cell>): Promise<void> {
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
    this.markCellForDestructionImmediate(cell)

    // Mark additional cells based on power-up type
    // Also chain-activate any power-ups we hit
    switch (powerUpType) {
      case 'horizontal-rocket':
        // Destroy entire row
        let horizontalChallengeCount = 0
        for (let col = 0; col < size; col++) {
          const targetCell = this.board[cell.row][col]
          // Chain-activate any power-ups in the row
          if (targetCell.powerup && targetCell !== cell) {
            console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
            await this.triggerPowerUp(targetCell, undefined, targetedCells)
          } else {
            // Count toward challenge if this is the challenge color
            if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetCell.color === this.currentChallenge.color) {
              horizontalChallengeCount++
            }
            this.markCellForDestructionImmediate(targetCell)
          }
        }
        // Update challenge progress
        if (horizontalChallengeCount > 0 && this.currentChallenge) {
          console.log(`[CHALLENGE] Horizontal rocket destroyed ${horizontalChallengeCount} ${this.currentChallenge.color} gems`)
          this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, horizontalChallengeCount)
          this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
        }
        break

      case 'vertical-rocket':
        // Destroy entire column
        let verticalChallengeCount = 0
        for (let row = 0; row < size; row++) {
          const targetCell = this.board[row][cell.column]
          // Chain-activate any power-ups in the column
          if (targetCell.powerup && targetCell !== cell) {
            console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
            await this.triggerPowerUp(targetCell, undefined, targetedCells)
          } else {
            // Count toward challenge if this is the challenge color
            if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetCell.color === this.currentChallenge.color) {
              verticalChallengeCount++
            }
            this.markCellForDestructionImmediate(targetCell)
          }
        }
        // Update challenge progress
        if (verticalChallengeCount > 0 && this.currentChallenge) {
          console.log(`[CHALLENGE] Vertical rocket destroyed ${verticalChallengeCount} ${this.currentChallenge.color} gems`)
          this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, verticalChallengeCount)
          this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
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
          // Track challenge progress if we're destroying the challenge color
          let challengeGemCount = 0
          if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetColor === this.currentChallenge.color) {
            console.log(`[CHALLENGE] Color bomb targeting challenge color: ${targetColor}`)
          }

          for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
              const targetCell = this.board[row][col]
              if (targetCell.color === targetColor) {
                // Chain-activate any power-ups of matching color
                if (targetCell.powerup) {
                  console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                  this.triggerPowerUp(targetCell, undefined, targetedCells)
                } else {
                  // Count toward challenge if this is the challenge color
                  if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetColor === this.currentChallenge.color) {
                    challengeGemCount++
                  }
                  this.markCellForDestructionImmediate(targetCell)
                }
              }
            }
          }

          // Update challenge progress for all destroyed gems of the challenge color
          if (challengeGemCount > 0 && this.currentChallenge) {
            console.log(`[CHALLENGE] Color bomb destroyed ${challengeGemCount} ${targetColor} gems`)
            this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, challengeGemCount)
            this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
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
        let tntChallengeCount = 0
        for (const dir of directions) {
          // Extend blast radius to 2 cells in each direction
          for (let distance = 1; distance <= 2; distance++) {
            const targetRow = cell.row + (dir.dr * distance)
            const targetCol = cell.column + (dir.dc * distance)
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const targetCell = this.board[targetRow][targetCol]
              if (targetCell.powerup) {
                console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                await this.triggerPowerUp(targetCell, undefined, targetedCells)
              } else {
                // Count toward challenge if this is the challenge color
                if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetCell.color === this.currentChallenge.color) {
                  tntChallengeCount++
                }
                this.markCellForDestructionImmediate(targetCell)
              }
            }
          }
        }
        // Update challenge progress
        if (tntChallengeCount > 0 && this.currentChallenge) {
          console.log(`[CHALLENGE] TNT destroyed ${tntChallengeCount} ${this.currentChallenge.color} gems`)
          this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, tntChallengeCount)
          this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
        }
        break

      case 'fly-away':
        // Find best target to fly to, explode at start, fly, explode at end
        const bestTarget = this.findBestFlyAwayTarget(cell, targetedCells)
        if (bestTarget) {
          // Mark this target as taken so other fly-aways won't target it
          targetedCells.add(bestTarget)

          // First explosion at current position (cross pattern)
          let flyAwayStartChallengeCount = 0
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
                // Count toward challenge if this is the challenge color
                if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetCell.color === this.currentChallenge.color) {
                  flyAwayStartChallengeCount++
                }
                this.markCellForDestructionImmediate(targetCell)
              }
            }
          }
          // Update challenge progress for start explosion
          if (flyAwayStartChallengeCount > 0 && this.currentChallenge) {
            console.log(`[CHALLENGE] Fly-away start explosion destroyed ${flyAwayStartChallengeCount} ${this.currentChallenge.color} gems`)
            this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, flyAwayStartChallengeCount)
            this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
          }

          // Animate fly-away sprite flying to target
          // The target explosion will happen inside the animation's onComplete callback
          await this.animateFlyAway(cell, bestTarget)
        }
        break
    }
  }

  async triggerVerticalRocketCombo (firstCell: Cell, secondCell: Cell): Promise<void> {
    // Test helper and combo trigger for two vertical rockets
    // First rocket clears column, second clears row
    if (firstCell.powerup !== 'vertical-rocket' || secondCell.powerup !== 'vertical-rocket') {
      console.error('Both cells must have vertical-rocket powerup')
      return
    }

    console.log('🚀🚀 VERTICAL ROCKET + VERTICAL ROCKET COMBO!')
    console.log(`First rocket (vertical) at [${firstCell.row}, ${firstCell.column}]`)
    console.log(`Second rocket (will clear row ${secondCell.row}) at [${secondCell.row}, ${secondCell.column}]`)

    // Play rocket sound
    this.sound.play('rocket', { volume: 0.4 })

    // Create effects for both rockets
    const x1 = firstCell.column * CELL_SIZE + CELL_SIZE / 2
    const y1 = firstCell.row * CELL_SIZE + CELL_SIZE / 2
    this.createPowerUpEffect(x1, y1, 'vertical-rocket', firstCell)

    const x2 = secondCell.column * CELL_SIZE + CELL_SIZE / 2
    const y2 = secondCell.row * CELL_SIZE + CELL_SIZE / 2
    this.createPowerUpEffect(x2, y2, 'horizontal-rocket', secondCell)

    // Clear both powerup properties
    firstCell.powerup = null
    secondCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(firstCell)
    this.markCellForDestructionImmediate(secondCell)

    // Destroy entire column (from first rocket)
    for (let row = 0; row < size; row++) {
      const targetCell = this.board[row][firstCell.column]
      if (targetCell.powerup && targetCell !== firstCell && targetCell !== secondCell) {
        console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
        await this.triggerPowerUp(targetCell)
      } else {
        this.markCellForDestructionImmediate(targetCell)
      }
    }

    // Destroy entire row (from second rocket)
    for (let col = 0; col < size; col++) {
      const targetCell = this.board[secondCell.row][col]
      if (targetCell.powerup && targetCell !== firstCell && targetCell !== secondCell) {
        console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
        await this.triggerPowerUp(targetCell)
      } else {
        this.markCellForDestructionImmediate(targetCell)
      }
    }
  }

  async triggerHorizontalRocketCombo (firstCell: Cell, secondCell: Cell): Promise<void> {
    // Test helper and combo trigger for two horizontal rockets
    // First rocket clears row, second clears column
    if (firstCell.powerup !== 'horizontal-rocket' || secondCell.powerup !== 'horizontal-rocket') {
      console.error('Both cells must have horizontal-rocket powerup')
      return
    }

    console.log('🚀🚀 HORIZONTAL ROCKET + HORIZONTAL ROCKET COMBO!')
    console.log(`First rocket (horizontal) at [${firstCell.row}, ${firstCell.column}]`)
    console.log(`Second rocket (will clear column ${secondCell.column}) at [${secondCell.row}, ${secondCell.column}]`)

    // Play rocket sound
    this.sound.play('rocket', { volume: 0.4 })

    // Create effects for both rockets
    const x1 = firstCell.column * CELL_SIZE + CELL_SIZE / 2
    const y1 = firstCell.row * CELL_SIZE + CELL_SIZE / 2
    this.createPowerUpEffect(x1, y1, 'horizontal-rocket', firstCell)

    const x2 = secondCell.column * CELL_SIZE + CELL_SIZE / 2
    const y2 = secondCell.row * CELL_SIZE + CELL_SIZE / 2
    this.createPowerUpEffect(x2, y2, 'vertical-rocket', secondCell)

    // Clear both powerup properties
    firstCell.powerup = null
    secondCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(firstCell)
    this.markCellForDestructionImmediate(secondCell)

    // Destroy entire row (from first rocket)
    for (let col = 0; col < size; col++) {
      const targetCell = this.board[firstCell.row][col]
      if (targetCell.powerup && targetCell !== firstCell && targetCell !== secondCell) {
        console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
        await this.triggerPowerUp(targetCell)
      } else {
        this.markCellForDestructionImmediate(targetCell)
      }
    }

    // Destroy entire column (from second rocket)
    for (let row = 0; row < size; row++) {
      const targetCell = this.board[row][secondCell.column]
      if (targetCell.powerup && targetCell !== firstCell && targetCell !== secondCell) {
        console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
        await this.triggerPowerUp(targetCell)
      } else {
        this.markCellForDestructionImmediate(targetCell)
      }
    }
  }

  async triggerLightBallTNTCombo (firstCell: Cell, secondCell: Cell): Promise<void> {
    console.log('💥⚡ LIGHT BALL + TNT COMBO! MEGA EXPLOSION!')

    // Play explosive sound
    this.sound.play('light-ball-sound', { volume: 0.5 })
    this.sound.play('explode', { volume: 0.5 })

    // Clear both powerup properties
    firstCell.powerup = null
    secondCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(firstCell)
    this.markCellForDestructionImmediate(secondCell)

    // Create massive explosion effect
    const x = firstCell.column * CELL_SIZE + CELL_SIZE / 2
    const y = firstCell.row * CELL_SIZE + CELL_SIZE / 2

    // Mega particle explosion
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 200, max: 400 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1000,
      quantity: 100,
      tint: [0xff0000, 0xff8800, 0xffff00],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 }
    })
    this.time.delayedCall(1100, () => particles.destroy())

    // Destroy a 5x5 area around the combo
    const centerRow = Math.floor((firstCell.row + secondCell.row) / 2)
    const centerCol = Math.floor((firstCell.column + secondCell.column) / 2)

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const targetRow = centerRow + dr
        const targetCol = centerCol + dc
        if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
          const targetCell = this.board[targetRow][targetCol]
          if (targetCell.powerup && targetCell !== firstCell && targetCell !== secondCell) {
            console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
            await this.triggerPowerUp(targetCell)
          } else {
            this.markCellForDestructionImmediate(targetCell)
          }
        }
      }
    }
  }

  async triggerLightBallLightBallCombo (firstCell: Cell, secondCell: Cell): Promise<void> {
    console.log('⚡⚡ DOUBLE LIGHT BALL COMBO! BOARD CLEAR!')

    // Play double light ball sound
    this.sound.play('light-ball-sound', { volume: 0.6 })

    // Clear both powerup properties
    firstCell.powerup = null
    secondCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(firstCell)
    this.markCellForDestructionImmediate(secondCell)

    // Create rainbow explosion across entire board
    const centerX = BOARD_SIZE / 2
    const centerY = BOARD_SIZE / 2

    const particles = this.add.particles(centerX, centerY, 'particle', {
      speed: { min: 300, max: 600 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1500,
      quantity: 150,
      tint: [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x8800ff],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 }
    })
    this.time.delayedCall(1600, () => particles.destroy())

    // Destroy ALL cells on the board
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const targetCell = this.board[row][col]
        if (!targetCell.empty) {
          this.markCellForDestructionImmediate(targetCell)
        }
      }
    }
  }

  async triggerLightBallRocketCombo (lightBallCell: Cell, rocketCell: Cell): Promise<void> {
    const rocketType = rocketCell.powerup
    console.log(`⚡🚀 LIGHT BALL + ${rocketType?.toUpperCase()} COMBO!`)

    // Play sounds
    this.sound.play('light-ball-sound', { volume: 0.5 })
    this.sound.play('rocket', { volume: 0.5 })

    // Determine rocket direction and get a color to target
    const isHorizontal = rocketType === 'horizontal-rocket'
    const targetColor = this.getAdjacentGemColor(lightBallCell)

    // Clear both powerup properties
    lightBallCell.powerup = null
    rocketCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(lightBallCell)
    this.markCellForDestructionImmediate(rocketCell)

    // Create enhanced effect
    const x = rocketCell.column * CELL_SIZE + CELL_SIZE / 2
    const y = rocketCell.row * CELL_SIZE + CELL_SIZE / 2

    // Destroy all gems of target color AND clear rocket line
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const targetCell = this.board[row][col]
        const isOnRocketLine = isHorizontal ? (row === rocketCell.row) : (col === rocketCell.column)
        const isTargetColor = !targetCell.empty && targetCell.color === targetColor

        if (isOnRocketLine || isTargetColor) {
          if (targetCell.powerup && targetCell !== lightBallCell && targetCell !== rocketCell) {
            await this.triggerPowerUp(targetCell)
          } else {
            this.markCellForDestructionImmediate(targetCell)
          }
        }
      }
    }
  }

  async triggerFlyAwayLightBallCombo (flyAwayCell: Cell, lightBallCell: Cell): Promise<void> {
    console.log('🚁⚡ FLY-AWAY + LIGHT BALL COMBO! MULTI-TARGET STRIKE!')

    // Play sounds
    this.sound.play('rocket', { volume: 0.5 })
    this.sound.play('light-ball-sound', { volume: 0.5 })

    // Clear both powerup properties
    flyAwayCell.powerup = null
    lightBallCell.powerup = null

    // Mark both cells for destruction
    this.markCellForDestructionImmediate(flyAwayCell)
    this.markCellForDestructionImmediate(lightBallCell)

    // Find 3 best targets and strike them all
    const targets: Cell[] = []
    for (let i = 0; i < 3; i++) {
      const usedCells = new Set(targets)
      const target = this.findBestFlyAwayTarget(flyAwayCell, usedCells)
      if (target) targets.push(target)
    }

    // Animate and destroy each target with enhanced effects
    for (const target of targets) {
      const startX = flyAwayCell.column * CELL_SIZE + CELL_SIZE / 2
      const startY = flyAwayCell.row * CELL_SIZE + CELL_SIZE / 2
      const endX = target.column * CELL_SIZE + CELL_SIZE / 2
      const endY = target.row * CELL_SIZE + CELL_SIZE / 2

      // Create flying sprite
      const flyingSprite = this.add.sprite(startX, startY, 'fly-away')
        .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
        .setDepth(2000)
        .setTint(0xff00ff) // Purple tint for combo

      // Quick flight animation
      await new Promise<void>(resolve => {
        this.tweens.add({
          targets: flyingSprite,
          x: endX,
          y: endY,
          angle: 720,
          duration: 600,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            // Create explosion
            const particles = this.add.particles(endX, endY, 'particle', {
              speed: { min: 100, max: 200 },
              scale: { start: 0.8, end: 0 },
              alpha: { start: 1, end: 0 },
              lifespan: 600,
              quantity: 30,
              tint: 0xff00ff,
              blendMode: 'ADD'
            })
            this.time.delayedCall(700, () => particles.destroy())

            // Destroy target and surrounding cells
            for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
              const targetRow = target.row + dir.dr
              const targetCol = target.column + dir.dc
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                this.markCellForDestructionImmediate(this.board[targetRow][targetCol])
              }
            }
            this.markCellForDestructionImmediate(target)

            flyingSprite.destroy()
            resolve()
          }
        })
      })
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

  animateFlyAway (fromCell: Cell, toCell: Cell): Promise<void> {
    return new Promise((resolve) => {
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
            onComplete: async () => {
              // Create explosion effect at target
              this.createPowerUpEffect(endX, endY, 'fly-away', toCell)

              // NOW destroy the target and surrounding cells (cross pattern)
              let flyAwayTargetChallengeCount = 0
              for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
                const targetRow = toCell.row + dir.dr
                const targetCol = toCell.column + dir.dc
                if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                  const targetCell = this.board[targetRow][targetCol]
                  if (targetCell.powerup) {
                    console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                    await this.triggerPowerUp(targetCell)
                  } else if (!targetCell.empty) {
                    // Count toward challenge if this is the challenge color
                    if (this.currentChallenge && this.currentChallenge.type === 'color-match' && targetCell.color === this.currentChallenge.color) {
                      flyAwayTargetChallengeCount++
                    }
                    // Visually destroy the cell (destroyCell will set empty)
                    this.destroyCell(targetCell)
                  }
                }
              }
              // Destroy target itself (destroyCell will set empty)
              if (!toCell.empty) {
                // Count toward challenge if this is the challenge color
                if (this.currentChallenge && this.currentChallenge.type === 'color-match' && toCell.color === this.currentChallenge.color) {
                  flyAwayTargetChallengeCount++
                }
                this.destroyCell(toCell)
              }

              // Update challenge progress for target explosion
              if (flyAwayTargetChallengeCount > 0 && this.currentChallenge) {
                console.log(`[CHALLENGE] Fly-away target explosion destroyed ${flyAwayTargetChallengeCount} ${this.currentChallenge.color} gems`)
                this.currentChallenge = LevelSystem.updateChallengeProgress(this.currentChallenge, flyAwayTargetChallengeCount)
                this.registry.events.emit('CHALLENGE_UPDATED', this.currentChallenge)
              }

              // Destroy the flying sprite
              flyingSprite.destroy()

              // Wait for destruction animations to complete using Promise
              await new Promise<void>(resolveDestruction => {
                this.time.delayedCall(destroyDuration, () => resolveDestruction())
              })

              // Now trigger the fall/refill/cascade logic
              await this.makeCellsFall()
              await this.refillBoard()

              // Continue with cascades if there are more matches or special patterns
              while (MatchDetector.boardShouldExplode(this.board) || this.powerUpSystem.hasSpecialPatterns(this.board)) {
                const chains = MatchDetector.getExplodingChains(this.board)
                this.powerUpSystem.createPowerUpsFromChains(
                  this.board,
                  chains,
                  (type) => this.updateChallengeForPowerUp(type),
                  null
                )
                await this.destroyCells()
                this.addScore(this.computeScore(chains, 0))
                await this.makeCellsFall()
                await this.refillBoard()
              }

              // Resolve the main promise when everything is complete
              resolve()
            }
          })
        }
      })
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
    // Invalidate cache since board changed
    this.invalidateWinningMovesCache()
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
        cell.markedForDestruction = false

        const x = column * CELL_SIZE + CELL_SIZE / 2
        const y = (row - numberOfEmptyCells) * CELL_SIZE + CELL_SIZE / 2
        cell.sprite = this.add.sprite(x, y, cell.color)
          .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)  // Scale to fit cell with small margin
          .setInteractive({ draggable: true })
      }
    }

    // Safeguard: Ensure all non-empty, non-powerup cells have sprites
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (!cell.empty && !cell.powerup && !cell.sprite) {
          console.warn(`[REFILL] Cell [${row},${col}] is non-empty but has no sprite! Creating sprite for ${cell.color}`)
          const x = col * CELL_SIZE + CELL_SIZE / 2
          const y = row * CELL_SIZE + CELL_SIZE / 2
          cell.sprite = this.add.sprite(x, y, cell.color)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
            .setInteractive({ draggable: true })
          cell.markedForDestruction = false
        }
      }
    }

    await this.moveSpritesWhereTheyBelong()
    // Invalidate cache since board changed
    this.invalidateWinningMovesCache()
  }

  async moveSpritesWhereTheyBelong () {
    const cells = this.board.flat()
    const animationsPromises = []

    for (const cell of cells) {
      const sprite = cell.sprite
      // Skip cells with no sprite (destroyed cells)
      if (!sprite) continue

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

  /**
   * Helper method to mark a cell for destruction and immediately destroy its sprite
   * This prevents "ghost sprites" - empty cells with visible sprites
   */
  markCellForDestructionImmediate (cell: Cell) {
    cell.markedForDestruction = true
    cell.empty = true
    // Immediately destroy the sprite to prevent ghost gems
    if (cell.sprite) {
      cell.sprite.destroy()
      cell.sprite = null
    }
  }

  destroyCell (cell: Cell) {
    return new Promise<void>(resolve => {
      cell.empty = true
      cell.markedForDestruction = false

      // If sprite is already destroyed (e.g., by markCellForDestructionImmediate),
      // just resolve immediately
      if (!cell.sprite) {
        resolve()
        return
      }

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
      // Destroy cells that should explode (matching 3+), are marked for destruction, or are already empty
      (MatchDetector.shouldExplode(cell, this.board) || cell.markedForDestruction || cell.empty) && !cell.powerup
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

          // Create undo snapshot before move
          this.createBoardSnapshot()

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
          while (MatchDetector.boardShouldExplode(this.board) || this.powerUpSystem.hasSpecialPatterns(this.board)) {
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

            // Update combo display
            this.updateComboDisplay(cascades + 1)
          }

          // Reset combo after cascades finish
          this.resetCombo()

          // Check level completion after all cascades settle
          this.checkLevelCompletion()

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

        // Create undo snapshot before move
        this.createBoardSnapshot()

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

          // Check for powerup combos
          const p1 = firstCell.powerup
          const p2 = secondCell.powerup

          // Light Ball + Light Ball = Board clear
          if (p1 === 'light-ball' && p2 === 'light-ball') {
            await this.triggerLightBallLightBallCombo(firstCell, secondCell)
          }
          // Light Ball + TNT = Mega explosion (5x5 area)
          else if ((p1 === 'light-ball' && p2 === 'tnt') || (p1 === 'tnt' && p2 === 'light-ball')) {
            await this.triggerLightBallTNTCombo(firstCell, secondCell)
          }
          // Light Ball + Rocket = Color clear + line clear
          else if ((p1 === 'light-ball' && (p2 === 'horizontal-rocket' || p2 === 'vertical-rocket')) ||
                   ((p1 === 'horizontal-rocket' || p1 === 'vertical-rocket') && p2 === 'light-ball')) {
            const lightBall = p1 === 'light-ball' ? firstCell : secondCell
            const rocket = p1 === 'light-ball' ? secondCell : firstCell
            await this.triggerLightBallRocketCombo(lightBall, rocket)
          }
          // Fly-Away + Light Ball = Multi-target strike
          else if ((p1 === 'fly-away' && p2 === 'light-ball') || (p1 === 'light-ball' && p2 === 'fly-away')) {
            const flyAway = p1 === 'fly-away' ? firstCell : secondCell
            const lightBall = p1 === 'fly-away' ? secondCell : firstCell
            await this.triggerFlyAwayLightBallCombo(flyAway, lightBall)
          }
          // Two vertical rockets
          else if (p1 === 'vertical-rocket' && p2 === 'vertical-rocket') {
            await this.triggerVerticalRocketCombo(firstCell, secondCell)
          }
          // Two horizontal rockets
          else if (p1 === 'horizontal-rocket' && p2 === 'horizontal-rocket') {
            await this.triggerHorizontalRocketCombo(firstCell, secondCell)
          }
          else {
            // Normal power-up activation (no combo)
            if (firstCell.powerup) {
              console.log(`Activating ${firstCell.powerup} at [${firstCell.row}, ${firstCell.column}]`)
              await this.triggerPowerUp(firstCell, secondCell)  // Pass the gem it was swapped with
            }
            if (secondCell.powerup) {
              console.log(`Activating ${secondCell.powerup} at [${secondCell.row}, ${secondCell.column}]`)
              await this.triggerPowerUp(secondCell, firstCell)  // Pass the gem it was swapped with
            }
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

            // Update combo display
            this.updateComboDisplay(cascades + 1)
          }

          // Then continue with regular cascade loop for any subsequent matches or special patterns
          while (MatchDetector.boardShouldExplode(this.board) || this.powerUpSystem.hasSpecialPatterns(this.board)) {
            const chains = MatchDetector.getExplodingChains(this.board)

            // Track challenge progress for matched gems
            this.updateChallengeForMatches(chains)

            console.log('=== BEFORE POWER-UP CREATION (drag) ===')
            this.logBoardState()

            // Create power-ups from chains of 4+ gems AND special patterns
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

            this.addScore(this.computeScore(chains, cascades))

            await this.makeCellsFall()

            await this.refillBoard()

            cascades++

            // Update combo display
            this.updateComboDisplay(cascades + 1)
          }

          // Reset combo after cascades finish
          this.resetCombo()

          // Check level completion after all cascades settle
          this.checkLevelCompletion()

          // Don't check for "no more moves" if game is over
          if (this.moves <= 0) {
            this.moveInProgress = false
            this.updateDebugDisplay()
            return
          }

          this.moveInProgress = false
          this.updateDebugDisplay()

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
        getWinningMoves: () => this.getWinningMoves(),
        exportBoard: () => this.exportBoard(),
        captureMove: (fromRow: number, fromCol: number, toRow: number, toCol: number, expectedBehavior?: string) =>
          this.captureMove(fromRow, fromCol, toRow, toCol, expectedBehavior)
      }
    }
  }

  /**
   * Export current board state as JSON for sharing and analysis
   */
  exportBoard () {
    const boardData = []
    for (let row = 0; row < size; row++) {
      const rowData = []
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.powerup) {
          rowData.push(`[${cell.powerup}]`)
        } else if (cell.empty) {
          rowData.push('____')
        } else {
          rowData.push(cell.color?.substring(0, 4).toUpperCase() || '____')
        }
      }
      boardData.push(rowData)
    }

    const output = {
      board: boardData,
      score: this.score,
      moves: this.moves,
      timestamp: Date.now()
    }

    console.log('\n=== BOARD EXPORT ===')
    console.log(JSON.stringify(output, null, 2))
    console.log('\n=== VISUAL BOARD ===')
    boardData.forEach((row, i) => {
      console.log(`Row ${i}: ${row.join(' | ')}`)
    })
    console.log('=== END EXPORT ===\n')

    return output
  }

  /**
   * Capture before/after state when testing a move - useful for bug reporting
   * @param fromRow Source cell row
   * @param fromCol Source cell column
   * @param toRow Target cell row
   * @param toCol Target cell column
   * @param expectedBehavior Optional description of what should happen
   */
  async captureMove (fromRow: number, fromCol: number, toRow: number, toCol: number, expectedBehavior?: string) {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║               MOVE CAPTURE - BUG REPORTING TOOL               ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝\n')

    // Capture BEFORE state
    console.log('📸 BEFORE MOVE:')
    console.log(`   From: [${fromRow}, ${fromCol}] → To: [${toRow}, ${toCol}]`)
    const beforeState = this.exportBoard()

    const fromCell = this.board[fromRow]?.[fromCol]
    const toCell = this.board[toRow]?.[toCol]

    if (!fromCell || !toCell) {
      console.error('❌ Invalid cell coordinates!')
      return
    }

    console.log(`   From Cell: ${fromCell.powerup || fromCell.color}`)
    console.log(`   To Cell: ${toCell.powerup || toCell.color}`)

    if (expectedBehavior) {
      console.log(`\n📝 EXPECTED BEHAVIOR:\n   ${expectedBehavior}`)
    }

    // Perform the move
    console.log('\n⚡ EXECUTING MOVE...\n')

    // Simulate click on from cell, then to cell
    await this.selectCell(fromCell)
    await this.selectCell(toCell)

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Capture AFTER state
    console.log('\n📸 AFTER MOVE:')
    const afterState = this.exportBoard()

    // Generate bug report template
    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║                    BUG REPORT TEMPLATE                        ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝')
    console.log('\nCopy the following to report a bug:\n')
    console.log('```')
    console.log('## Bug Report')
    console.log(`**Move**: [${fromRow}, ${fromCol}] → [${toRow}, ${toCol}]`)
    if (expectedBehavior) {
      console.log(`**Expected**: ${expectedBehavior}`)
    } else {
      console.log('**Expected**: [Describe what should have happened]')
    }
    console.log('**Actual**: [Describe what actually happened]')
    console.log('\n**Before State**:')
    console.log(JSON.stringify(beforeState, null, 2))
    console.log('\n**After State**:')
    console.log(JSON.stringify(afterState, null, 2))
    console.log('```\n')

    return { before: beforeState, after: afterState }
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

    if (name === 'vertical-rocket-combo') {
      // Load a simple test board for vertical rocket combo testing
      const verticalRocketComboBoard = [
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ]

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = verticalRocketComboBoard[row][col]

          // Destroy existing sprite if it exists
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

      // Spawn two vertical rockets vertically adjacent to each other (one on top of the other)
      this.spawnPowerup('vertical-rocket', 3, 4)
      this.spawnPowerup('vertical-rocket', 4, 4)
      console.log(`[DEBUG] Loaded ${name} with 2 vertical rockets at [3,4] and [4,4]`)
      console.log('[DEBUG] Drag one vertical rocket onto the other to test the combo')
      console.log('[DEBUG] Expected: One clears column 4, the other clears row where dropped')
      return
    }

    if (name === 'horizontal-rocket-combo') {
      // Load a simple test board for horizontal rocket combo testing
      const horizontalRocketComboBoard = [
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green'],
        ['green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow'],
        ['yellow', 'blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red'],
        ['red', 'green', 'yellow', 'pink', 'yellow', 'blue', 'red', 'green']
      ]

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = horizontalRocketComboBoard[row][col]

          // Destroy existing sprite if it exists
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

      // Spawn two horizontal rockets horizontally adjacent to each other (side by side)
      this.spawnPowerup('horizontal-rocket', 4, 3)
      this.spawnPowerup('horizontal-rocket', 4, 4)
      console.log(`[DEBUG] Loaded ${name} with 2 horizontal rockets at [4,3] and [4,4]`)
      console.log('[DEBUG] Drag one horizontal rocket onto the other to test the combo')
      console.log('[DEBUG] Expected: One clears row 4, the other clears column where dropped')
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
      // L-shape └ (right and up): Swap red [4,0] with green [3,0] to complete
      // Creates: red at [3,0], red [3,1], red [3,2] (horizontal) + red [2,0], red [1,0] (vertical up)
      'lshape-right-up': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['red', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow'],
        ['red', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['green', 'red', 'red', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['red', 'yellow', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green']
      ],
      // L-shape ┘ (left and up): Swap red [4,7] with green [3,7] to complete
      // Creates: red at [3,7], red [3,6], red [3,5] (horizontal left) + red [2,7], red [1,7] (vertical up)
      'lshape-left-up': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'red'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'red'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'red', 'red', 'green'],
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
      ],
      // L-shape ┌ (right and down): Swap red [3,0] with green [4,0] to complete
      // Creates: red at [4,0], red [4,1], red [4,2] (horizontal) + red [5,0], red [6,0] (vertical down)
      'lshape-right-down': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['red', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow'],
        ['green', 'red', 'red', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['red', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['red', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green']
      ],
      // L-shape ┐ (left and down): Swap red [3,7] with green [4,7] to complete
      // Creates: red at [4,7], red [4,6], red [4,5] (horizontal left) + red [5,7], red [6,7] (vertical down)
      'lshape-left-down': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'red'],
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'red', 'red', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'red'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'red'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
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
      // Test 2x2 expansion: Swap blue [1,0] with red [1,1] to create 2x2
      // Should expand to include all 5 adjacent red gems (3 on top + 2x2 = 5 total)
      // Pattern: R R R
      //          R R
      'square-expand': [
        ['red', 'red', 'red', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'red', 'yellow', 'green', 'yellow', 'green', 'green', 'yellow'],
        ['green', 'yellow', 'pink', 'blue', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'blue', 'green', 'yellow', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'green', 'yellow', 'pink', 'blue'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
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
      ],
      // T-shape pointing down: Swap red [3,3] with yellow [2,3] to complete
      // Pattern: X X X  (3 across at row 2)
      //            X    (2 down from center)
      //            X
      'tshape-down': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'red', 'yellow', 'red', 'green', 'yellow', 'pink'],
        ['pink', 'blue', 'green', 'red', 'pink', 'blue', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
      ],
      // T-shape pointing up: Swap red [4,3] with yellow [5,3] to complete
      // Pattern:   X    (2 up from center)
      //            X
      //          X X X  (3 across at row 5)
      'tshape-up': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'red', 'pink', 'blue', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'green', 'red', 'yellow', 'red', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
      ],
      // T-shape pointing right: Swap red [3,3] with yellow [3,2] to complete
      // Pattern: X  (3 down at col 3)
      //          X X X  (2 right from center)
      //          X
      'tshape-right': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'red', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'red', 'red', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
      ],
      // T-shape pointing left: Swap red [3,3] with yellow [3,4] to complete
      // Pattern:     X  (3 down at col 3)
      //          X X X  (2 left from center)
      //              X
      'tshape-left': [
        ['yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'red', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'red', 'red', 'yellow', 'pink', 'blue', 'green', 'yellow'],
        ['yellow', 'pink', 'blue', 'red', 'yellow', 'pink', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink'],
        ['green', 'yellow', 'pink', 'blue', 'green', 'yellow', 'pink', 'blue'],
        ['pink', 'blue', 'green', 'yellow', 'pink', 'blue', 'green', 'yellow']
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
