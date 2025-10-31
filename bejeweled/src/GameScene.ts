import * as Phaser from 'phaser'

import {
  BOARD_SIZE,
  CELL_SIZE,
  MENU_WIDTH,
  NUMBER_OF_CELLS_PER_ROW as size
} from './constants'
import { ConfirmPopup } from './ConfirmPopup'
import { GameSession } from './GameSession'
import { HighScoreAPI } from './api/HighScoreAPI'
import { LocalScores } from './LocalScores'

const gems = [
  'blue',
  'green',
  'orange',
  'red',
  'white',
  'yellow'
]

type PowerUpType = 'horizontal-rocket' | 'vertical-rocket' | 'tnt' | 'color-bomb' | 'fly-away' | null

/**
 * Number of cells required to trigger an explosion
 */
const explosionThreshold = 3
const swapDuration = 540 // ms (3x slower)
const destroyDuration = 540 // ms (3x slower)

type Cell = {
  row: number
  column: number
  color: string
  sprite: Phaser.GameObjects.Sprite
  empty: boolean
  powerup: PowerUpType
}

export default class GameScene extends Phaser.Scene {
  board: Cell[][]
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
  gameSession: GameSession
  highScoreAPI: HighScoreAPI

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
      board: params.get('board'),
      testEndGame: params.get('testEndGame'),
      score: params.get('score') ? parseInt(params.get('score')!, 10) : null,
      moves: params.get('moves') ? parseInt(params.get('moves')!, 10) : null
    }
  }

  preload () {
    gems.forEach(gem => this.load.image(gem, `assets/${gem}.png`))

    // Load power-up sprites
    this.load.image('horizontal-rocket', 'assets/horizontal-rocket.png')
    this.load.image('vertical-rocket', 'assets/vertical-rocket.png')
    this.load.image('tnt', 'assets/tnt.png')
    this.load.image('color-bomb', 'assets/color-bomb.png')
    this.load.image('fly-away', 'assets/fly-away.png')

    // Load sound effects
    this.load.audio('swap', 'assets/sounds/SwapForward.mp3')
    this.load.audio('swap-back', 'assets/sounds/SwapBackWardSound.mp3')
    this.load.audio('match', 'assets/sounds/MatchSound.mp3')
    this.load.audio('explode', 'assets/sounds/MatchItemExplodeSound.mp3')
    this.load.audio('booster-created', 'assets/sounds/BoosterCreationSound.mp3')
    this.load.audio('rocket', 'assets/sounds/Rocket.mp3')
    this.load.audio('color-bomb-sound', 'assets/sounds/LightBallPoweringEffect.wav')
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

    // Initialize game session and API client
    this.gameSession = new GameSession(params.seed || undefined)
    this.highScoreAPI = new HighScoreAPI()

    // Log debug mode status
    if (this.debugMode) {
      console.log('[DEBUG] Debug mode enabled')
      console.log('[DEBUG] Available console commands:')
      console.log('  - gameDebug.setSeed(number)')
      console.log('  - gameDebug.spawnPowerup(type, row, col)')
      console.log('  - gameDebug.loadTestBoard(name)')
      console.log('  - gameDebug.logBoard()')
      console.log('  - gameDebug.getWinningMoves()')
      console.log('[DEBUG] Available test boards: match5, match4h, match4v, lshape, square, tnt-test, fly-away-test, rocket-flyaway-test, combo-test')
      console.log('[DEBUG] Test end-game scenarios:')
      console.log('  - ?testEndGame=win (high score, 1 move left)')
      console.log('  - ?testEndGame=lose (low score, 1 move left)')
      console.log('  - ?testEndGame=immediate (game over immediately)')
      console.log('  - ?score=X&moves=Y (custom score and moves)')
    }

    this.createBackground()

    // Create particle texture
    this.createParticleTexture()

    // Create debug graphics layer
    this.debugGraphics = this.add.graphics()
    this.debugGraphics.setDepth(10000)

    this.initBoard()

    // Set initial score and moves (can be overridden by query params)
    let initialScore = 0
    let initialMoves = 30

    // Handle test scenarios
    if (params.testEndGame === 'win') {
      // High score winning scenario
      initialScore = 10000
      initialMoves = 1
      console.log('[TEST] Win scenario: High score with 1 move left')
    } else if (params.testEndGame === 'lose') {
      // Low score losing scenario
      initialScore = 100
      initialMoves = 1
      console.log('[TEST] Lose scenario: Low score with 1 move left')
    } else if (params.testEndGame === 'immediate') {
      // Trigger game over immediately
      initialScore = params.score !== null ? params.score : 5000
      initialMoves = 0
      console.log('[TEST] Immediate game over scenario')
    }

    // Override with specific query params if provided
    if (params.score !== null) {
      initialScore = params.score
      console.log(`[TEST] Score set to: ${initialScore}`)
    }
    if (params.moves !== null) {
      initialMoves = params.moves
      console.log(`[TEST] Moves set to: ${initialMoves}`)
    }

    this.setScore(initialScore)
    this.setMoves(initialMoves)

    // Expose debug commands to console (always available)
    this.exposeDebugCommands()

    // Trigger game over immediately if starting with 0 moves (test scenario)
    if (initialMoves === 0) {
      console.log('[TEST] Starting with 0 moves, triggering game over immediately')
      // Use a small delay to ensure the scene is fully initialized
      this.time.delayedCall(100, () => {
        this.gameOver('Out of moves!')
      })
    }

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
    this.setScore(0)
    this.setMoves(30)
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

    // Fill board
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]

        const possibleColors = []
        for (let color of gems) {
          cell.color = color
          // Check for both 3+ matches AND 2x2 squares
          if (!this.shouldExplode(cell) && !this.wouldCreate2x2Square(cell)) {
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
    if (this.gameSession) {
      this.gameSession.updateScore(score)
    }
  }

  setMoves (moves: number) {
    this.moves = moves
    this.registry.set('moves', moves)
  }

  decrementMoves () {
    this.setMoves(this.moves - 1)
    if (this.gameSession) {
      this.gameSession.incrementMoves()
    }
    // Don't check for game over here - let it happen after all cascades finish
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

    if (this.selectedCell == null) {
      this.selectCell(pointedCell)
      return
    }

    const firstCell = this.selectedCell
    const secondCell = pointedCell
    this.deselectCell()

    // Allow clicking power-ups directly to activate them in place
    if (firstCell === secondCell) {
      if (firstCell.powerup) {
        console.log(`[POWER-UP] Clicked ${firstCell.powerup} at [${firstCell.row}, ${firstCell.column}] - activating in place`)
        this.moveInProgress = true

        // Activate the power-up without a swap
        this.triggerPowerUp(firstCell)

        await this.destroyCells()
        await this.makeCellsFall()
        await this.refillBoard()

        // Valid move - decrement moves counter
        this.decrementMoves()

        // Process cascades
        let cascades = 0
        while (this.boardShouldExplode()) {
          const chains = this.getExplodingChains()
          this.createPowerUpsFromChains(chains)
          this.showFloatingScores(chains, cascades)
          await this.destroyCells()
          this.setScore(this.score + this.computeScore(chains, cascades))
          await this.makeCellsFall()
          await this.refillBoard()
          cascades++
        }

        // Check for game over conditions AFTER all cascades have finished
        if (this.moves <= 0) {
          this.gameOver('Out of moves!')
        } else {
          const winningMoves = this.getWinningMoves()
          console.log(`${winningMoves.length} winning moves`)
          if (this.debugMode) {
            console.log('[DEBUG] Skipping "no more moves" check in debug mode')
          }
          if (winningMoves.length === 0 && !this.debugMode) {
            this.gameOver('No more moves!')
          }
        }

        this.moveInProgress = false
      }
      return
    }

    if (!this.cellsAreNeighbours(firstCell, secondCell)) {
      this.selectCell(secondCell)
      return
    }

    this.moveInProgress = true

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

    if (this.boardShouldExplode() || hasPowerUp) {
      // Valid move - decrement moves counter
      this.decrementMoves()

      let cascades = 0
      while (this.boardShouldExplode()) {
        const chains = this.getExplodingChains()

        console.log('=== BEFORE POWER-UP CREATION ===')
        this.logBoardState()

        // Create power-ups from chains of 4+ gems
        this.createPowerUpsFromChains(chains)

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
      // Check for game over conditions AFTER all cascades have finished
      if (this.moves <= 0) {
        this.gameOver('Out of moves!')
      } else {
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
        if (this.boardShouldExplode()) {
          winningMoves.push({ cell1: cell, cell2: right })
        }
        this.swapCells(cell, right)

        // Swap down
        this.swapCells(cell, down)
        if (this.boardShouldExplode()) {
          winningMoves.push({ cell1: cell, cell2: down })
        }
        this.swapCells(cell, down)
      }
    }

    return winningMoves
  }

  gameOver (message: string = 'Game Over') {
    this.isGameOver = true

    // Check if this is a personal best
    const personalBest = LocalScores.getPersonalBest()
    const isNewPersonalBest = !personalBest || this.score > personalBest.score

    const gameOverBackground = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    const gameOverTitle = this.add.text(0, -180, message)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(32)
      .setColor('#FF4444')
      .setFontStyle('bold')

    // Personal best indicator
    let personalBestText: Phaser.GameObjects.Text | null = null
    if (isNewPersonalBest) {
      personalBestText = this.add.text(0, -140, 'NEW PERSONAL BEST!')
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(20)
        .setColor('#FFD700')
        .setFontStyle('bold')
    } else if (personalBest) {
      personalBestText = this.add.text(0, -140, `Personal Best: ${personalBest.score}`)
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(16)
        .setColor('#CCCCCC')
    }

    const finalScoreText = this.add.text(0, -100, `Final Score: ${this.score}`)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(28)
      .setColor('#FFD700')
      .setFontStyle('bold')

    const sessionInfo = this.add.text(
      0, -65,
      `Moves: ${this.gameSession.getMoves()} | Time: ${this.gameSession.getDuration()}s`
    )
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#CCCCCC')

    // Name input prompt
    const namePrompt = this.add.text(0, -20, 'Enter your name for leaderboard:')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('white')

    // Create an HTML input element for name
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.maxLength = 20
    nameInput.placeholder = 'Your Name'
    // Pre-fill with last used name
    const lastName = LocalScores.getLastPlayerName()
    if (lastName) {
      nameInput.value = lastName
    }
    nameInput.style.position = 'absolute'
    nameInput.style.width = '200px'
    nameInput.style.padding = '8px'
    nameInput.style.fontSize = '16px'
    nameInput.style.textAlign = 'center'
    nameInput.style.left = `${MENU_WIDTH + this.zone.width / 2 - 100}px`
    nameInput.style.top = `${this.zone.height / 2 + 20}px`
    nameInput.style.zIndex = '1000'
    document.body.appendChild(nameInput)
    nameInput.focus()
    nameInput.select() // Select text so user can easily replace it

    // Submit button
    const submitButton = this.add.text(0, 100, 'Submit Score')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('#4CAF50')
      .setFontStyle('bold')
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => submitButton.setColor('#66FF66'))
      .on('pointerout', () => submitButton.setColor('#4CAF50'))
      .on('pointerup', () => this.submitHighScore(nameInput.value, nameInput))

    // Skip button
    const skipButton = this.add.text(0, 140, 'Skip')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#888888')
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => skipButton.setColor('#AAAAAA'))
      .on('pointerout', () => skipButton.setColor('#888888'))
      .on('pointerup', () => {
        nameInput.remove()
        this.showRestartHint()
      })

    const restartHint = this.add.text(0, 180, 'Click "New Game" to restart')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(14)
      .setColor('#666666')

    this.gameOverScreen = this.add.container(0, 0)
      .add(gameOverBackground)
      .add(gameOverTitle)
      .add(finalScoreText)
      .add(sessionInfo)
      .add(namePrompt)
      .add(submitButton)
      .add(skipButton)
      .add(restartHint)
      .setDepth(1)

    if (personalBestText) {
      this.gameOverScreen.add(personalBestText)
      Phaser.Display.Align.In.Center(personalBestText, gameOverBackground, 0, -140)
    }

    Phaser.Display.Align.In.Center(gameOverTitle, gameOverBackground, 0, -180)
    Phaser.Display.Align.In.Center(finalScoreText, gameOverBackground, 0, -100)
    Phaser.Display.Align.In.Center(sessionInfo, gameOverBackground, 0, -65)
    Phaser.Display.Align.In.Center(namePrompt, gameOverBackground, 0, -20)
    Phaser.Display.Align.In.Center(submitButton, gameOverBackground, 0, 100)
    Phaser.Display.Align.In.Center(skipButton, gameOverBackground, 0, 140)
    Phaser.Display.Align.In.Center(restartHint, gameOverBackground, 0, 180)

    // Allow submitting with Enter key
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.submitHighScore(nameInput.value, nameInput)
      }
    })
  }

  async submitHighScore(playerName: string, inputElement: HTMLInputElement) {
    if (!playerName || playerName.trim().length === 0) {
      alert('Please enter your name')
      return
    }

    // Update UI to show submitting state
    const submitButton = this.gameOverScreen.list.find(item =>
      item instanceof Phaser.GameObjects.Text && item.text === 'Submit Score'
    ) as Phaser.GameObjects.Text

    if (submitButton) {
      submitButton.setText('Submitting...')
      submitButton.disableInteractive()
    }

    try {
      const submission = this.gameSession.getSubmissionData(playerName.trim())

      // Save to local storage
      const wasPersonalBest = LocalScores.saveIfPersonalBest(
        submission.score,
        submission.moves,
        submission.duration,
        submission.playerName
      )

      // Log submission details for debugging
      console.log('[SCORE SUBMISSION] Sending to API:', {
        playerName: submission.playerName,
        score: submission.score,
        moves: submission.moves,
        duration: submission.duration,
        sessionHash: submission.sessionHash,
        sessionHashLength: submission.sessionHash.length,
        gameVersion: submission.gameVersion
      })

      const response = await this.highScoreAPI.submitScore(submission)

      // Log full response for debugging
      console.log('[SCORE SUBMISSION] API Response:', response)

      inputElement.remove()

      if (response.success) {
        console.log('[SCORE SUBMISSION] Success!')
        this.showSubmissionSuccess(response.rank, wasPersonalBest)
      } else {
        console.error('[SCORE SUBMISSION] Failed:', response.error)
        this.showSubmissionError(response.error || 'Failed to submit score')
      }
    } catch (error: any) {
      console.error('[SCORE SUBMISSION] Exception:', error)
      console.error('[SCORE SUBMISSION] Error stack:', error.stack)
      inputElement.remove()
      this.showSubmissionError('Network error. Please check your connection.')
    }
  }

  showSubmissionSuccess(rank: number | null | undefined, wasPersonalBest: boolean = false) {
    // Clear game over screen
    this.gameOverScreen.destroy()

    const background = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    const successTitle = this.add.text(0, -70, 'Score Submitted!')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(32)
      .setColor('#4CAF50')
      .setFontStyle('bold')

    let personalBestNote: Phaser.GameObjects.Text | null = null
    if (wasPersonalBest) {
      personalBestNote = this.add.text(0, -30, 'New Personal Best!')
        .setOrigin(0.5)
        .setFontFamily('Arial')
        .setFontSize(18)
        .setColor('#FFD700')
    }

    const rankText = rank
      ? this.add.text(0, 20, `Your Rank: #${rank}`)
          .setOrigin(0.5)
          .setFontFamily('Arial')
          .setFontSize(24)
          .setColor('#FFD700')
      : this.add.text(0, 20, 'Thank you for playing!')
          .setOrigin(0.5)
          .setFontFamily('Arial')
          .setFontSize(20)
          .setColor('#FFFFFF')

    this.gameOverScreen = this.add.container(0, 0)
      .add(background)
      .add(successTitle)
      .add(rankText)
      .setDepth(1)

    if (personalBestNote) {
      this.gameOverScreen.add(personalBestNote)
      Phaser.Display.Align.In.Center(personalBestNote, background, 0, -30)
    }

    Phaser.Display.Align.In.Center(successTitle, background, 0, -70)
    Phaser.Display.Align.In.Center(rankText, background, 0, 20)

    this.time.delayedCall(2000, () => this.showRestartHint())
  }

  showSubmissionError(error: string) {
    // Clear game over screen
    this.gameOverScreen.destroy()

    const background = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    const errorTitle = this.add.text(0, -50, 'Submission Failed')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(28)
      .setColor('#FF4444')
      .setFontStyle('bold')

    const errorMessage = this.add.text(0, 10, error)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(16)
      .setColor('#FFFFFF')
      .setWordWrapWidth(this.zone.width - 40)

    this.gameOverScreen = this.add.container(0, 0)
      .add(background)
      .add(errorTitle)
      .add(errorMessage)
      .setDepth(1)

    Phaser.Display.Align.In.Center(errorTitle, background, 0, -50)
    Phaser.Display.Align.In.Center(errorMessage, background, 0, 10)

    this.time.delayedCall(2000, () => this.showRestartHint())
  }

  showRestartHint() {
    if (this.gameOverScreen) {
      this.gameOverScreen.destroy()
    }

    const background = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    const restartHint = this.add.text(0, 0, 'Click "New Game" to restart')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(20)
      .setColor('white')

    this.gameOverScreen = this.add.container(0, 0)
      .add(background)
      .add(restartHint)
      .setDepth(1)

    Phaser.Display.Align.In.Center(restartHint, background)
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

  detectSpecialPatterns (): Array<{ cell: Cell, type: PowerUpType, cells: Cell[] }> {
    const patterns: Array<{ cell: Cell, type: PowerUpType, cells: Cell[] }> = []
    const usedCells = new Set<Cell>()

    // Detect 2x2 squares for Fly Away
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        const topLeft = this.board[row][col]
        const topRight = this.board[row][col + 1]
        const bottomLeft = this.board[row + 1][col]
        const bottomRight = this.board[row + 1][col + 1]

        const squareCells = [topLeft, topRight, bottomLeft, bottomRight]
        if (squareCells.some(cell => usedCells.has(cell))) continue

        // Check if all 4 cells match and aren't empty or power-ups
        if (
          !topLeft.empty && !topLeft.powerup &&
          topLeft.color === topRight.color &&
          topLeft.color === bottomLeft.color &&
          topLeft.color === bottomRight.color
        ) {
          // Found a 2x2 square! Create fly-away at top-left
          patterns.push({
            cell: topLeft,
            type: 'fly-away',
            cells: squareCells
          })
          squareCells.forEach(cell => usedCells.add(cell))
        }
      }
    }

    // Detect L-shapes for TNT (all 4 orientations)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const center = this.board[row][col]
        if (center.empty || center.powerup || usedCells.has(center)) continue

        // L-shape 1: └ (right and up)
        if (col <= size - 3 && row >= 2) {
          const right1 = this.board[row][col + 1]
          const right2 = this.board[row][col + 2]
          const up1 = this.board[row - 1][col]
          const up2 = this.board[row - 2][col]
          const lCells = [center, right1, right2, up1, up2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color) &&
              lCells.every(c => !usedCells.has(c))) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells })
            lCells.forEach(cell => usedCells.add(cell))
            continue
          }
        }

        // L-shape 2: ┘ (left and up)
        if (col >= 2 && row >= 2) {
          const left1 = this.board[row][col - 1]
          const left2 = this.board[row][col - 2]
          const up1 = this.board[row - 1][col]
          const up2 = this.board[row - 2][col]
          const lCells = [center, left1, left2, up1, up2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color) &&
              lCells.every(c => !usedCells.has(c))) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells })
            lCells.forEach(cell => usedCells.add(cell))
            continue
          }
        }

        // L-shape 3: ┌ (right and down)
        if (col <= size - 3 && row <= size - 3) {
          const right1 = this.board[row][col + 1]
          const right2 = this.board[row][col + 2]
          const down1 = this.board[row + 1][col]
          const down2 = this.board[row + 2][col]
          const lCells = [center, right1, right2, down1, down2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color) &&
              lCells.every(c => !usedCells.has(c))) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells })
            lCells.forEach(cell => usedCells.add(cell))
            continue
          }
        }

        // L-shape 4: ┐ (left and down)
        if (col >= 2 && row <= size - 3) {
          const left1 = this.board[row][col - 1]
          const left2 = this.board[row][col - 2]
          const down1 = this.board[row + 1][col]
          const down2 = this.board[row + 2][col]
          const lCells = [center, left1, left2, down1, down2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color) &&
              lCells.every(c => !usedCells.has(c))) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells })
            lCells.forEach(cell => usedCells.add(cell))
            continue
          }
        }
      }
    }

    return patterns
  }

  createPowerUpsFromChains (chains: Cell[][]) {
    let powerUpsCreated = false

    // First, check for special patterns (L-shapes and 2x2 squares)
    const specialPatterns = this.detectSpecialPatterns()

    for (const pattern of specialPatterns) {
      powerUpsCreated = true
      const powerUpCell = pattern.cell
      const powerUpType = pattern.type

      // Mark all cells in pattern for destruction except the power-up cell
      for (const cell of pattern.cells) {
        if (cell !== powerUpCell) {
          cell.empty = true
        }
      }

      // Create the power-up
      this.createPowerUp(powerUpCell, powerUpType)
    }

    // Then handle regular linear chains
    for (const chain of chains) {
      // Skip chains that are part of special patterns
      const isPartOfSpecialPattern = specialPatterns.some(pattern =>
        pattern.cells.some(cell => chain.includes(cell))
      )
      if (isPartOfSpecialPattern) continue

      if (chain.length >= 4) {
        powerUpsCreated = true

        // Determine if chain is horizontal or vertical
        const isHorizontal = chain[0].row === chain[1].row

        // Choose the middle cell for the power-up
        const middleIndex = Math.floor(chain.length / 2)
        const powerUpCell = chain[middleIndex]

        // Determine power-up type based on chain length and orientation
        let powerUpType: PowerUpType
        if (chain.length >= 5) {
          powerUpType = 'color-bomb'  // 5+ match → color bomb
        } else if (isHorizontal) {
          powerUpType = 'horizontal-rocket'  // 4 horizontal → horizontal rocket
        } else {
          powerUpType = 'vertical-rocket'  // 4 vertical → vertical rocket
        }

        // Mark ALL cells in chain (except the power-up) for destruction
        for (let i = 0; i < chain.length; i++) {
          if (i !== middleIndex) {
            chain[i].empty = true
          }
        }

        // Create the power-up
        this.createPowerUp(powerUpCell, powerUpType)
      }
    }

    // Play booster creation sound if any power-ups were created
    if (powerUpsCreated) {
      this.sound.play('booster-created', { volume: 0.5 })
    }
  }

  createPowerUp (powerUpCell: Cell, powerUpType: PowerUpType) {
    // Mark the power-up cell - this prevents it from being destroyed
    powerUpCell.powerup = powerUpType

    // Change color to prevent matching with regular gems
    powerUpCell.color = powerUpType

    // Replace the sprite with the power-up sprite
    const x = powerUpCell.column * CELL_SIZE + CELL_SIZE / 2
    const y = powerUpCell.row * CELL_SIZE + CELL_SIZE / 2

    // Destroy the old sprite
    powerUpCell.sprite.destroy()

    // Create new power-up sprite
    powerUpCell.sprite = this.add.sprite(x, y, powerUpType)
      .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
      .setInteractive({ draggable: true })

    // Create power-up creation burst effect
    this.createPowerUpBurst(x, y, powerUpType)
  }

  createPowerUpBurst (x: number, y: number, powerUpType: PowerUpType) {
    // Color based on power-up type
    let color = 0xffff00 // default yellow
    if (powerUpType === 'color-bomb') {
      color = 0xffffff // white/rainbow
    } else if (powerUpType === 'horizontal-rocket' || powerUpType === 'vertical-rocket') {
      color = 0xff9900 // orange
    }

    // Create burst effect
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 250 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 20,
      tint: color,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 }
    })

    // Auto-destroy after particles fade
    this.time.delayedCall(700, () => particles.destroy())
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

  triggerPowerUp (cell: Cell, swappedWith?: Cell) {
    if (!cell.powerup) return

    const powerUpType = cell.powerup

    // Check for power-up combinations
    if (swappedWith && swappedWith.powerup) {
      console.log(`[COMBO] Detected combination: ${powerUpType} + ${swappedWith.powerup}`)
      this.executeCombination(cell, swappedWith)
      return
    }

    // Play sound based on power-up type
    if (powerUpType === 'color-bomb') {
      this.sound.play('color-bomb-sound', { volume: 0.4 })
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
            this.triggerPowerUp(targetCell)
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
            this.triggerPowerUp(targetCell)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'color-bomb':
        // Destroy all gems of the same color
        // If swapped with a gem, use that gem's color; otherwise pick adjacent color
        let targetColor: string | null = null
        if (swappedWith && !swappedWith.empty && !swappedWith.powerup && swappedWith.color) {
          targetColor = swappedWith.color
          console.log(`Color bomb swapped with ${targetColor}, destroying all ${targetColor} gems`)
        } else {
          targetColor = this.getAdjacentGemColor(cell)
          console.log(`Color bomb clicked, picking adjacent color: ${targetColor}`)
        }

        if (targetColor) {
          for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
              const targetCell = this.board[row][col]
              if (targetCell.color === targetColor) {
                // Chain-activate any power-ups of matching color
                if (targetCell.powerup) {
                  console.log(`Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}]`)
                  this.triggerPowerUp(targetCell)
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
                this.triggerPowerUp(targetCell)
              } else {
                targetCell.empty = true
              }
            }
          }
        }
        break

      case 'fly-away':
        console.log(`[FLY-AWAY] Activated at [${cell.row}, ${cell.column}]`)
        // Find best target to fly to, explode at start, fly, explode at end
        const bestTarget = this.findBestFlyAwayTarget(cell)

        if (bestTarget) {
          console.log(`[FLY-AWAY] Found target: [${bestTarget.row}, ${bestTarget.column}] (${bestTarget.color})`)

          // First explosion at current position (cross pattern)
          console.log(`[FLY-AWAY] Starting first explosion at [${cell.row}, ${cell.column}]`)
          for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
            const targetRow = cell.row + dir.dr
            const targetCol = cell.column + dir.dc
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const targetCell = this.board[targetRow][targetCol]
              // Chain-activate any power-ups hit by the starting explosion
              if (targetCell.powerup) {
                console.log(`[FLY-AWAY] Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}] from start explosion`)
                this.triggerPowerUp(targetCell)
              } else {
                console.log(`[FLY-AWAY] Marking [${targetRow}, ${targetCol}] as empty from start explosion`)
                targetCell.empty = true
              }
            }
          }

          // Animate fly-away sprite flying to target
          // The target explosion will happen inside the animation's onComplete callback
          console.log(`[FLY-AWAY] Beginning flight animation to [${bestTarget.row}, ${bestTarget.column}]`)
          this.animateFlyAway(cell, bestTarget)
        } else {
          console.log(`[FLY-AWAY] WARNING: No target found! Fly-away will disappear without effect.`)
        }
        break
    }
  }

  findBestFlyAwayTarget (fromCell: Cell, excludeCells: Cell[] = []): Cell | null {
    console.log(`[FLY-AWAY] Searching for best target...`)
    // Find the cell with the most matches (best strategic value)
    let bestCell: Cell | null = null
    let bestScore = 0

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        if (cell.empty || cell.powerup || cell === fromCell || excludeCells.includes(cell)) continue

        // Count how many neighbors match this cell's color
        const neighbors = this.getNeighbors(cell)
        const matchCount = neighbors.filter(n => !n.empty && !n.powerup && n.color === cell.color).length

        if (matchCount > bestScore) {
          bestScore = matchCount
          bestCell = cell
          console.log(`[FLY-AWAY] New best target: [${row}, ${col}] (${cell.color}) with ${matchCount} matching neighbors`)
        }
      }
    }

    console.log(`[FLY-AWAY] Best target search complete. Score: ${bestScore}, Target: ${bestCell ? `[${bestCell.row}, ${bestCell.column}]` : 'null'}`)
    return bestCell
  }

  getRandomGemColor (): string {
    const colors = ['blue', 'green', 'orange', 'red', 'white', 'yellow']
    return Phaser.Math.RND.pick(colors)
  }

  animateFlyAway (fromCell: Cell, toCell: Cell) {
    console.log(`[FLY-AWAY] Animation starting: from [${fromCell.row}, ${fromCell.column}] to [${toCell.row}, ${toCell.column}]`)
    const startX = fromCell.column * CELL_SIZE + CELL_SIZE / 2
    const startY = fromCell.row * CELL_SIZE + CELL_SIZE / 2
    const endX = toCell.column * CELL_SIZE + CELL_SIZE / 2
    const endY = toCell.row * CELL_SIZE + CELL_SIZE / 2

    // Create a temporary sprite for the flying animation
    const flyingSprite = this.add.sprite(startX, startY, 'fly-away')
      .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
      .setDepth(2000)

    console.log(`[FLY-AWAY] Created flying sprite`)

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
        console.log(`[FLY-AWAY] Reached target, beginning orbit`)
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
            console.log(`[FLY-AWAY] Orbit complete, starting second explosion at [${toCell.row}, ${toCell.column}]`)
            // Create explosion effect at target
            this.createPowerUpEffect(endX, endY, 'fly-away', toCell)

            console.log(`[FLY-AWAY] Destroying target cell and surrounding cells`)
            // NOW destroy the target and surrounding cells (cross pattern)
            let destroyedCount = 0
            for (const dir of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
              const targetRow = toCell.row + dir.dr
              const targetCol = toCell.column + dir.dc
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                const targetCell = this.board[targetRow][targetCol]
                if (targetCell.powerup) {
                  console.log(`[FLY-AWAY] Chain-activating ${targetCell.powerup} at [${targetCell.row}, ${targetCell.column}] from target explosion`)
                  this.triggerPowerUp(targetCell)
                  destroyedCount++
                } else if (!targetCell.empty) {
                  // Mark empty and visually destroy the cell
                  console.log(`[FLY-AWAY] Destroying cell at [${targetRow}, ${targetCol}] (${targetCell.color})`)
                  targetCell.empty = true
                  this.destroyCell(targetCell)
                  destroyedCount++
                }
              }
            }
            // Mark target itself for destruction and visually destroy it
            if (!toCell.empty) {
              console.log(`[FLY-AWAY] Destroying target cell at [${toCell.row}, ${toCell.column}] (${toCell.color})`)
              toCell.empty = true
              this.destroyCell(toCell)
              destroyedCount++
            } else {
              console.log(`[FLY-AWAY] WARNING: Target cell at [${toCell.row}, ${toCell.column}] is already empty!`)
            }

            console.log(`[FLY-AWAY] Second explosion complete. Destroyed ${destroyedCount} cells.`)

            // Destroy the flying sprite
            flyingSprite.destroy()

            // Wait for destruction animations to complete, then trigger cascade
            this.time.delayedCall(destroyDuration, async () => {
              console.log(`[FLY-AWAY] Starting cascade logic after second explosion`)
              // Now trigger the fall/refill/cascade logic
              await this.makeCellsFall()
              await this.refillBoard()

              // Continue with cascades if there are more matches
              while (this.boardShouldExplode()) {
                const chains = this.getExplodingChains()
                this.createPowerUpsFromChains(chains)
                await this.destroyCells()
                this.setScore(this.score + this.computeScore(chains, 0))
                await this.makeCellsFall()
                await this.refillBoard()
              }
              console.log(`[FLY-AWAY] Cascade complete, fly-away sequence finished`)
            })
          }
        })
      }
    })
  }

  executeCombination (cell1: Cell, cell2: Cell) {
    const type1 = cell1.powerup
    const type2 = cell2.powerup

    // Use cell2's position as the combination origin
    const position = cell2

    // Mark both power-ups for destruction
    cell1.powerup = null
    cell1.empty = true
    cell2.powerup = null
    cell2.empty = true

    console.log(`[COMBO] Executing ${type1} + ${type2} at [${position.row}, ${position.column}]`)

    // Play special combo sound
    this.sound.play('color-bomb-sound', { volume: 0.6 })

    // Sort the combination to handle order-independent matching
    const combo = [type1, type2].sort().join('+')

    switch (combo) {
      // Rocket + Rocket Combinations
      case 'horizontal-rocket+vertical-rocket':
        console.log('[COMBO] Giant Cross - destroying entire row AND column')
        // Destroy entire row
        for (let col = 0; col < size; col++) {
          const targetCell = this.board[position.row][col]
          if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
            this.triggerPowerUp(targetCell)
          } else {
            targetCell.empty = true
          }
        }
        // Destroy entire column
        for (let row = 0; row < size; row++) {
          const targetCell = this.board[row][position.column]
          if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
            this.triggerPowerUp(targetCell)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'horizontal-rocket+horizontal-rocket':
        console.log('[COMBO] Triple Horizontal Blast - destroying 3 rows')
        // Destroy 3 rows (current, above, below)
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
          const targetRow = position.row + rowOffset
          if (targetRow >= 0 && targetRow < size) {
            for (let col = 0; col < size; col++) {
              const targetCell = this.board[targetRow][col]
              if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
                this.triggerPowerUp(targetCell)
              } else {
                targetCell.empty = true
              }
            }
          }
        }
        break

      case 'vertical-rocket+vertical-rocket':
        console.log('[COMBO] Triple Vertical Blast - destroying 3 columns')
        // Destroy 3 columns (current, left, right)
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          const targetCol = position.column + colOffset
          if (targetCol >= 0 && targetCol < size) {
            for (let row = 0; row < size; row++) {
              const targetCell = this.board[row][targetCol]
              if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
                this.triggerPowerUp(targetCell)
              } else {
                targetCell.empty = true
              }
            }
          }
        }
        break

      // TNT Combinations
      case 'tnt+tnt':
        console.log('[COMBO] Mega Explosion - 5x5 blast')
        // Destroy 5x5 area centered on position
        for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
          for (let colOffset = -2; colOffset <= 2; colOffset++) {
            const targetRow = position.row + rowOffset
            const targetCol = position.column + colOffset
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const targetCell = this.board[targetRow][targetCol]
              if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
                this.triggerPowerUp(targetCell)
              } else {
                targetCell.empty = true
              }
            }
          }
        }
        break

      case 'horizontal-rocket+tnt':
        console.log('[COMBO] Super Row Explosion - row + cross patterns')
        // Destroy entire row with TNT explosion at each cell
        for (let col = 0; col < size; col++) {
          const rowCell = this.board[position.row][col]
          if (rowCell.powerup && rowCell !== cell1 && rowCell !== cell2) {
            this.triggerPowerUp(rowCell)
          } else {
            rowCell.empty = true
          }

          // Add cross pattern at this position
          const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
          for (const dir of dirs) {
            for (let dist = 1; dist <= 2; dist++) {
              const targetRow = position.row + (dir.dr * dist)
              const targetCol = col + (dir.dc * dist)
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                const targetCell = this.board[targetRow][targetCol]
                if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
                  this.triggerPowerUp(targetCell)
                } else {
                  targetCell.empty = true
                }
              }
            }
          }
        }
        break

      case 'tnt+vertical-rocket':
        console.log('[COMBO] Super Column Explosion - column + cross patterns')
        // Destroy entire column with TNT explosion at each cell
        for (let row = 0; row < size; row++) {
          const colCell = this.board[row][position.column]
          if (colCell.powerup && colCell !== cell1 && colCell !== cell2) {
            this.triggerPowerUp(colCell)
          } else {
            colCell.empty = true
          }

          // Add cross pattern at this position
          const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
          for (const dir of dirs) {
            for (let dist = 1; dist <= 2; dist++) {
              const targetRow = row + (dir.dr * dist)
              const targetCol = position.column + (dir.dc * dist)
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                const targetCell = this.board[targetRow][targetCol]
                if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
                  this.triggerPowerUp(targetCell)
                } else {
                  targetCell.empty = true
                }
              }
            }
          }
        }
        break

      // Color Bomb Combinations
      case 'color-bomb+color-bomb':
        console.log('[COMBO] Complete Board Clear!')
        // Destroy everything
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const targetCell = this.board[row][col]
            if (targetCell !== cell1 && targetCell !== cell2) {
              targetCell.empty = true
            }
          }
        }
        break

      case 'color-bomb+horizontal-rocket':
        console.log('[COMBO] Color Rocket Storm (Horizontal) - transforming all gems of target color into horizontal rockets')
        // Pick a color from adjacent cells
        const hRocketColor = this.getAdjacentGemColor(position) || this.getRandomGemColor()
        console.log(`[COMBO] Target color: ${hRocketColor}`)
        // Transform all gems of that color into horizontal rockets and fire them
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const targetCell = this.board[row][col]
            if (targetCell.color === hRocketColor && !targetCell.empty && !targetCell.powerup) {
              // Destroy entire row for each gem of this color
              for (let c = 0; c < size; c++) {
                const rowCell = this.board[row][c]
                if (rowCell.powerup && rowCell !== cell1 && rowCell !== cell2) {
                  this.triggerPowerUp(rowCell)
                } else {
                  rowCell.empty = true
                }
              }
            }
          }
        }
        break

      case 'color-bomb+vertical-rocket':
        console.log('[COMBO] Color Rocket Storm (Vertical) - transforming all gems of target color into vertical rockets')
        // Pick a color from adjacent cells
        const vRocketColor = this.getAdjacentGemColor(position) || this.getRandomGemColor()
        console.log(`[COMBO] Target color: ${vRocketColor}`)
        // Transform all gems of that color into vertical rockets and fire them
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const targetCell = this.board[row][col]
            if (targetCell.color === vRocketColor && !targetCell.empty && !targetCell.powerup) {
              // Destroy entire column for each gem of this color
              for (let r = 0; r < size; r++) {
                const colCell = this.board[r][col]
                if (colCell.powerup && colCell !== cell1 && colCell !== cell2) {
                  this.triggerPowerUp(colCell)
                } else {
                  colCell.empty = true
                }
              }
            }
          }
        }
        break

      case 'color-bomb+tnt':
        console.log('[COMBO] Color Bomb Chain - transforming all gems of target color into TNTs')
        // Pick a color from adjacent cells
        const tntColor = this.getAdjacentGemColor(position) || this.getRandomGemColor()
        console.log(`[COMBO] Target color: ${tntColor}`)
        // Find all gems of that color and explode them with TNT effect
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const targetCell = this.board[row][col]
            if (targetCell.color === tntColor && !targetCell.empty && !targetCell.powerup) {
              // Create TNT explosion at each location
              targetCell.empty = true
              const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
              for (const dir of dirs) {
                for (let dist = 1; dist <= 2; dist++) {
                  const targetRow = row + (dir.dr * dist)
                  const targetCol = col + (dir.dc * dist)
                  if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                    const explosionCell = this.board[targetRow][targetCol]
                    if (explosionCell.powerup && explosionCell !== cell1 && explosionCell !== cell2) {
                      this.triggerPowerUp(explosionCell)
                    } else {
                      explosionCell.empty = true
                    }
                  }
                }
              }
            }
          }
        }
        break

      case 'color-bomb+fly-away':
        console.log('[COMBO] Color Missile Barrage - launching fly-aways at all gems of target color')
        // Pick a color from adjacent cells
        const flyawayColor = this.getAdjacentGemColor(position) || this.getRandomGemColor()
        console.log(`[COMBO] Target color: ${flyawayColor}`)
        // Destroy all gems of that color with cross pattern explosions
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const targetCell = this.board[row][col]
            if (targetCell.color === flyawayColor && !targetCell.empty && !targetCell.powerup) {
              // Create cross explosion at each location
              targetCell.empty = true
              const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
              for (const dir of dirs) {
                const targetRow = row + dir.dr
                const targetCol = col + dir.dc
                if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                  const explosionCell = this.board[targetRow][targetCol]
                  if (explosionCell.powerup && explosionCell !== cell1 && explosionCell !== cell2) {
                    this.triggerPowerUp(explosionCell)
                  } else {
                    explosionCell.empty = true
                  }
                }
              }
            }
          }
        }
        break

      // Fly-Away Combinations
      case 'fly-away+fly-away':
        console.log('[COMBO] Triple Missile Launch - launching 3 fly-aways to different targets')
        // Find 3 best targets and explode them with cross patterns
        const targets: Cell[] = []
        for (let i = 0; i < 3; i++) {
          const target = this.findBestFlyAwayTarget(position, targets)
          if (target) {
            targets.push(target)
            // Explode at target with cross pattern
            target.empty = true
            const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
            for (const dir of dirs) {
              const targetRow = target.row + dir.dr
              const targetCol = target.column + dir.dc
              if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                const explosionCell = this.board[targetRow][targetCol]
                if (explosionCell.powerup && explosionCell !== cell1 && explosionCell !== cell2) {
                  this.triggerPowerUp(explosionCell)
                } else {
                  explosionCell.empty = true
                }
              }
            }
          }
        }
        console.log(`[COMBO] Destroyed ${targets.length} targets`)
        break

      case 'fly-away+horizontal-rocket':
        console.log('[COMBO] Rocket-Guided Missile (Horizontal) - fly-away finds target and destroys entire row')
        const hTarget = this.findBestFlyAwayTarget(position)
        const hTargetRow = hTarget ? hTarget.row : position.row
        console.log(`[COMBO] Target: ${hTarget ? `[${hTarget.row}, ${hTarget.column}]` : 'none found, using combo position'} - destroying entire row ${hTargetRow}`)
        // Destroy entire row at target (or at combo position if no target found)
        for (let col = 0; col < size; col++) {
          const targetCell = this.board[hTargetRow][col]
          if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
            this.triggerPowerUp(targetCell)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'fly-away+vertical-rocket':
        console.log('[COMBO] Rocket-Guided Missile (Vertical) - fly-away finds target and destroys entire column')
        const vTarget = this.findBestFlyAwayTarget(position)
        const vTargetCol = vTarget ? vTarget.column : position.column
        console.log(`[COMBO] Target: ${vTarget ? `[${vTarget.row}, ${vTarget.column}]` : 'none found, using combo position'} - destroying entire column ${vTargetCol}`)
        // Destroy entire column at target (or at combo position if no target found)
        for (let row = 0; row < size; row++) {
          const targetCell = this.board[row][vTargetCol]
          if (targetCell.powerup && targetCell !== cell1 && targetCell !== cell2) {
            this.triggerPowerUp(targetCell)
          } else {
            targetCell.empty = true
          }
        }
        break

      case 'fly-away+tnt':
        console.log('[COMBO] Missile + Mega Blast - fly-away finds target and creates enlarged explosion')
        const tntTarget = this.findBestFlyAwayTarget(position)
        const tntTargetPos = tntTarget ? tntTarget : position
        console.log(`[COMBO] Target: ${tntTarget ? `[${tntTarget.row}, ${tntTarget.column}]` : 'none found, using combo position'} - creating 4-cell radius cross explosion`)
        // Destroy with enlarged cross pattern (4 cells in each direction)
        tntTargetPos.empty = true
        const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
        for (const dir of dirs) {
          for (let dist = 1; dist <= 4; dist++) {
            const targetRow = tntTargetPos.row + (dir.dr * dist)
            const targetCol = tntTargetPos.column + (dir.dc * dist)
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              const explosionCell = this.board[targetRow][targetCol]
              if (explosionCell.powerup && explosionCell !== cell1 && explosionCell !== cell2) {
                this.triggerPowerUp(explosionCell)
              } else {
                explosionCell.empty = true
              }
            }
          }
        }
        break

      default:
        console.log(`[COMBO] Combination ${combo} not yet implemented - executing both power-ups separately`)
        // Fallback: trigger both power-ups at their positions
        this.triggerPowerUp(cell1)
        this.triggerPowerUp(cell2)
        break
    }
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
    } else if (powerUpType === 'color-bomb') {
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
    for (let column = 0; column < size; column++) {
      let numberOfEmptyCells = 0
      while (numberOfEmptyCells < size && this.board[numberOfEmptyCells][column].empty) {
        numberOfEmptyCells++
      }

      for (let row = 0; row < numberOfEmptyCells; row++) {
        const cell = this.board[row][column]
        cell.color = Phaser.Math.RND.pick(gems)
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

  getExplodingChains (): Cell[][] {
    const rows = this.board
    const columns = Phaser.Utils.Array.Matrix.TransposeMatrix(this.board)

    return [...rows, ...columns].flatMap(line => this.getExplodingChainsOnLine(line))
  }

  getExplodingChainsOnLine (line: Cell[]): Cell[][] {
    const chains: Cell[][] = []

    let i = 0
    while (i < line.length) {
      let j = i + 1
      while (j < line.length && line[j].color === line[i].color) {
        j++
      }

      const chain = line.slice(i, j)
      if (chain.length >= explosionThreshold) {
        chains.push(chain)
        i = j
      } else {
        i++
      }
    }

    return chains
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
        onComplete: () => resolve()
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
      orange: 0xffaa4d,
      red: 0xff4d4d,
      white: 0xffffff,
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
      (this.shouldExplode(cell) || cell.empty) && !cell.powerup
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

  swapCells (firstCell: Cell, secondCell: Cell) {
    const firstCellCopy = { ...firstCell }
    firstCell.row = secondCell.row
    firstCell.column = secondCell.column
    secondCell.row = firstCellCopy.row
    secondCell.column = firstCellCopy.column

    this.board[firstCell.row][firstCell.column] = firstCell
    this.board[secondCell.row][secondCell.column] = secondCell
  }

  boardShouldExplode (): boolean {
    // Check for regular 3+ matches
    const hasRegularMatches = this.board.some(row => row.some(cell => this.shouldExplode(cell)))

    // Also check for special patterns (2x2 squares, L-shapes)
    const hasSpecialPatterns = this.detectSpecialPatterns().length > 0

    return hasRegularMatches || hasSpecialPatterns
  }

  shouldExplode (cell: Cell): boolean {
    // Power-ups don't explode as part of normal matches - they must be activated
    if (cell.powerup) {
      return false
    }
    return this.shouldExplodeHorizontally(cell) || this.shouldExplodeVertically(cell)
  }

  wouldCreate2x2Square (cell: Cell): boolean {
    // Check if placing this cell would create a 2x2 square
    // Only check cells that have been filled already (during board initialization)
    const { row, column, color } = cell

    // Check if cell is top-left of a 2x2 square
    if (row < size - 1 && column < size - 1) {
      const topRight = this.board[row][column + 1]
      const bottomLeft = this.board[row + 1][column]
      const bottomRight = this.board[row + 1][column + 1]
      if (!topRight.empty && !bottomLeft.empty && !bottomRight.empty &&
          topRight.color === color && bottomLeft.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is top-right of a 2x2 square
    if (row < size - 1 && column > 0) {
      const topLeft = this.board[row][column - 1]
      const bottomLeft = this.board[row + 1][column - 1]
      const bottomRight = this.board[row + 1][column]
      if (!topLeft.empty && !bottomLeft.empty && !bottomRight.empty &&
          topLeft.color === color && bottomLeft.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is bottom-left of a 2x2 square
    if (row > 0 && column < size - 1) {
      const topLeft = this.board[row - 1][column]
      const topRight = this.board[row - 1][column + 1]
      const bottomRight = this.board[row][column + 1]
      if (!topLeft.empty && !topRight.empty && !bottomRight.empty &&
          topLeft.color === color && topRight.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is bottom-right of a 2x2 square
    if (row > 0 && column > 0) {
      const topLeft = this.board[row - 1][column - 1]
      const topRight = this.board[row - 1][column]
      const bottomLeft = this.board[row][column - 1]
      if (!topLeft.empty && !topRight.empty && !bottomLeft.empty &&
          topLeft.color === color && topRight.color === color && bottomLeft.color === color) {
        return true
      }
    }

    return false
  }

  shouldExplodeHorizontally ({ row, column }: Cell): boolean {
    // TODO: optim: expand left/right and return right - left >= threshold
    for (let startPosition = column - explosionThreshold + 1; startPosition <= column; startPosition++) {
      const endPosition = startPosition + explosionThreshold - 1
      if (startPosition >= 0 && endPosition < size) {
        let explosion = true
        for (let index = startPosition; index < endPosition; index++) {
          if (this.board[row][index].color !== this.board[row][index + 1].color) {
            explosion = false
            break
          }
        }
        if (explosion) {
          return true
        }
      }
    }
    return false
  }

  shouldExplodeVertically ({ row, column }: Cell): boolean {
    for (let startPosition = row - explosionThreshold + 1; startPosition <= row; startPosition++) {
      const endPosition = startPosition + explosionThreshold - 1
      if (startPosition >= 0 && endPosition < size) {
        let explosion = true
        for (let index = startPosition; index < endPosition; index++) {
          if (this.board[index][column].color !== this.board[index + 1][column].color) {
            explosion = false
            break
          }
        }
        if (explosion) {
          return true
        }
      }
    }
    return false
  }

  getCellAt (pointer: Phaser.Input.Pointer): Cell {
    const row = Math.floor(pointer.worldY / CELL_SIZE)
    const column = Math.floor(pointer.worldX / CELL_SIZE)

    return this.board[row][column]
  }

  cellsAreNeighbours (cell1: Cell, cell2: Cell): boolean {
    return (cell1.row === cell2.row && (cell1.column === cell2.column + 1 || cell1.column === cell2.column - 1)) ||
      (cell1.column === cell2.column && (cell1.row === cell2.row + 1 || cell1.row === cell2.row - 1))
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

      // If it's the same cell, check for power-up activation
      if (targetCell === draggedCell) {
        if (draggedCell.powerup) {
          console.log(`[POWER-UP] Dragged ${draggedCell.powerup} to same position - activating in place`)
          this.draggedCell = null
          this.moveInProgress = true

          // Activate the power-up without a swap
          this.triggerPowerUp(draggedCell)

          await this.destroyCells()
          await this.makeCellsFall()
          await this.refillBoard()

          // Valid move - decrement moves counter
          this.decrementMoves()

          // Process cascades
          let cascades = 0
          while (this.boardShouldExplode()) {
            const chains = this.getExplodingChains()
            this.createPowerUpsFromChains(chains)
            this.showFloatingScores(chains, cascades)
            await this.destroyCells()
            this.setScore(this.score + this.computeScore(chains, cascades))
            await this.makeCellsFall()
            await this.refillBoard()
            cascades++
          }

          // Check for game over conditions AFTER all cascades have finished
          if (this.moves <= 0) {
            this.gameOver('Out of moves!')
          } else {
            const winningMoves = this.getWinningMoves()
            console.log(`${winningMoves.length} winning moves`)
            if (this.debugMode) {
              console.log('[DEBUG] Skipping "no more moves" check in debug mode')
            }
            if (winningMoves.length === 0 && !this.debugMode) {
              this.gameOver('No more moves!')
            }
          }

          this.moveInProgress = false
        } else {
          console.log('Same cell - snapping back')
          gameObject.x = this.dragStartX
          gameObject.y = this.dragStartY
          this.draggedCell = null
          this.updateDebugDisplay()
        }
        return
      }

      // If it's a neighbor, perform the swap
      const areNeighbors = this.cellsAreNeighbours(draggedCell, targetCell)
      console.log(`Are neighbors: ${areNeighbors}`)
      if (areNeighbors) {
        const firstCell = draggedCell
        const secondCell = targetCell

        console.log('Performing swap...')
        this.moveInProgress = true
        this.draggedCell = null

        this.swapCells(firstCell, secondCell)
        this.sound.play('swap', { volume: 0.3 })

        console.log('Moving sprites...')
        await this.moveSpritesWhereTheyBelong()
        console.log('Sprites moved')

        // Check if either swapped cell is a power-up and activate it
        const hasPowerUp = firstCell.powerup || secondCell.powerup
        if (hasPowerUp) {
          console.log('=== POWER-UP SWAPPED (via drag)! ===')
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

        const shouldExplode = this.boardShouldExplode()
        console.log(`Board should explode: ${shouldExplode}, has power-up: ${hasPowerUp}`)

        if (shouldExplode || hasPowerUp) {
          // Valid move - decrement moves counter
          console.log('Valid move! Processing...')
          this.decrementMoves()

          let cascades = 0
          while (this.boardShouldExplode()) {
            const chains = this.getExplodingChains()

            console.log('=== BEFORE POWER-UP CREATION (drag) ===')
            this.logBoardState()

            // Create power-ups from chains of 4+ gems
            this.createPowerUpsFromChains(chains)

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
          // Check for game over conditions AFTER all cascades have finished
          if (this.moves <= 0) {
            this.gameOver('Out of moves!')
          } else {
            const winningMoves = this.getWinningMoves()
            console.log(`${winningMoves.length} winning moves`)
            if (this.debugMode) {
              console.log('[DEBUG] Skipping "no more moves" check in debug mode')
            }
            // Skip game over check in debug mode to allow continued testing
            if (winningMoves.length === 0 && !this.debugMode) {
              this.gameOver('No more moves!')
            }
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
    cell.color = type  // Update color to match power-up type
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
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
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

    if (name === 'fly-away-test' || name === 'flyaway-test') {
      // Load a test board for Fly-Away with some matching neighbors for good targeting
      const flyAwayTestBoard = [
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['white', 'orange', 'blue', 'blue', 'green', 'yellow', 'white', 'orange'],  // Fly-away at [4,3], adjacent blue at [4,2]
        ['orange', 'blue', 'blue', 'green', 'yellow', 'white', 'orange', 'blue'],   // Two blues here for fly-away to target
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ]

      // Load the board
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = flyAwayTestBoard[row][col]

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

      // Spawn Fly-Away in the center
      this.spawnPowerup('fly-away', 4, 4)
      console.log(`[DEBUG] Loaded ${name} with Fly-Away at center [4, 4]`)
      console.log('[DEBUG] Swap the Fly-Away to activate it (should explode at start, fly to best target, explode again)')
      return
    }

    if (name === 'rocket-flyaway-test' || name === 'rocket-fly-away-test') {
      // Load a test board for Rocket + Fly-Away combinations
      const rocketFlyawayBoard = [
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ]

      // Load the board
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = rocketFlyawayBoard[row][col]

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

      // Spawn Rocket + Fly-Away pairs for testing
      this.spawnPowerup('horizontal-rocket', 3, 3)
      this.spawnPowerup('fly-away', 3, 4)

      this.spawnPowerup('vertical-rocket', 5, 3)
      this.spawnPowerup('fly-away', 5, 4)

      console.log(`[DEBUG] Loaded ${name} with Rocket + Fly-Away combinations`)
      console.log('[DEBUG] - H-Rocket + Fly-Away at [3,3] and [3,4] = Finds best target, destroys entire row')
      console.log('[DEBUG] - V-Rocket + Fly-Away at [5,3] and [5,4] = Finds best target, destroys entire column')
      return
    }

    if (name === 'combo-test' || name === 'combination-test') {
      // Load a test board with multiple power-ups for testing combinations
      const comboTestBoard = [
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ]

      // Load the board
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cell = this.board[row][col]
          const newColor = comboTestBoard[row][col]

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

      // Spawn various power-ups for testing combinations
      this.spawnPowerup('horizontal-rocket', 2, 2)
      this.spawnPowerup('vertical-rocket', 2, 3)
      this.spawnPowerup('tnt', 2, 5)
      this.spawnPowerup('horizontal-rocket', 2, 6)

      this.spawnPowerup('tnt', 4, 2)
      this.spawnPowerup('tnt', 4, 3)
      this.spawnPowerup('color-bomb', 4, 5)
      this.spawnPowerup('vertical-rocket', 4, 6)

      this.spawnPowerup('fly-away', 6, 2)
      this.spawnPowerup('fly-away', 6, 3)
      this.spawnPowerup('color-bomb', 6, 5)
      this.spawnPowerup('color-bomb', 6, 6)

      console.log(`[DEBUG] Loaded ${name} with multiple power-ups for combination testing`)
      console.log('[DEBUG] Try swapping adjacent power-ups to test combinations!')
      console.log('[DEBUG] Row 2: H-Rocket+V-Rocket, TNT+H-Rocket')
      console.log('[DEBUG] Row 4: TNT+TNT, Color Bomb+V-Rocket')
      console.log('[DEBUG] Row 6: Fly-Away+Fly-Away, Color Bomb+Color Bomb (BOARD CLEAR!)')
      return
    }

    // Predefined test boards
    const testBoards: { [key: string]: string[][] } = {
      match5: [
        ['blue', 'blue', 'blue', 'blue', 'blue', 'red', 'green', 'yellow'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ],
      lshape: [
        ['red', 'red', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'green', 'red', 'white', 'orange', 'blue', 'red', 'green'],
        ['yellow', 'white', 'red', 'blue', 'red', 'green', 'yellow', 'white'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ],
      square: [
        ['red', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'green'],
        ['red', 'red', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ],
      match4h: [
        ['blue', 'blue', 'blue', 'blue', 'red', 'green', 'yellow', 'white'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['green', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['white', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green']
      ],
      match4v: [
        ['red', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['red', 'white', 'orange', 'blue', 'red', 'green', 'yellow', 'white'],
        ['red', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow'],
        ['red', 'orange', 'blue', 'red', 'green', 'yellow', 'white', 'orange'],
        ['white', 'blue', 'red', 'green', 'yellow', 'white', 'orange', 'blue'],
        ['orange', 'red', 'green', 'yellow', 'white', 'orange', 'blue', 'red'],
        ['blue', 'green', 'yellow', 'white', 'orange', 'blue', 'red', 'green'],
        ['yellow', 'yellow', 'white', 'orange', 'blue', 'red', 'green', 'yellow']
      ]
    }

    if (!testBoards[name]) {
      console.error(`[DEBUG] Test board '${name}' not found. Available: ${Object.keys(testBoards).join(', ')}`)
      return
    }

    const boardConfig = testBoards[name]
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
          cell.sprite = this.add.sprite(x, y, cell.color)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)
            .setInteractive({ draggable: true })
        }
      }
    }

    console.log(`[DEBUG] Loaded test board: ${name}`)
  }

  logBoard () {
    console.log('[DEBUG] Current Board State:')
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
