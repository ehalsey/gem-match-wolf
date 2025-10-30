import * as Phaser from 'phaser'

import {
  BOARD_SIZE,
  CELL_SIZE,
  MENU_WIDTH,
  NUMBER_OF_CELLS_PER_ROW as size
} from './constants'
import { ConfirmPopup } from './ConfirmPopup'

const gems = [
  'blue',
  'green',
  'orange',
  'red',
  'white',
  'yellow'
]

type PowerUpType = 'horizontal-rocket' | 'vertical-rocket' | 'tnt' | 'light-ball' | null

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
  moveInProgress: boolean
  score: number
  moves: number
  zone: Phaser.GameObjects.Zone
  isGameOver: boolean
  gameOverScreen: Phaser.GameObjects.Container

  constructor () {
    super({
      key: 'GameScene',
      active: true
    })
  }

  preload () {
    gems.forEach(gem => this.load.image(gem, `assets/${gem}.png`))

    // Load power-up sprites
    this.load.image('horizontal-rocket', 'assets/horizontal-rocket.png')
    this.load.image('vertical-rocket', 'assets/vertical-rocket.png')
    this.load.image('tnt', 'assets/tnt.png')
    this.load.image('light-ball', 'assets/light-ball.png')
  }

  create () {
    this.cameras.main.setPosition(MENU_WIDTH, 0)
    this.zone = this.add.zone(0, 0, BOARD_SIZE, BOARD_SIZE).setOrigin(0)

    this.createBackground()

    this.initBoard()

    this.setScore(0)
    this.setMoves(30)

    // TODO: clicking on "new game" triggers this...
    this.input.on('pointerdown', this.onPointerDown, this)

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

  initBoard () {
    // Create empty board
    this.board = createEmptyBoard(size)

    // Fill board
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const cell = this.board[row][column]

        const possibleColors = []
        for (let color of gems) {
          cell.color = color
          if (!this.shouldExplode(cell)) {
            possibleColors.push(color)
          }
        }
        cell.color = Phaser.Math.RND.pick(possibleColors)
        cell.empty = false

        const x = column * CELL_SIZE + CELL_SIZE / 2
        const y = row * CELL_SIZE + CELL_SIZE / 2
        cell.sprite = this.add.sprite(x, y, cell.color)
          .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9)  // Scale to fit cell with small margin
          .setInteractive()
      }
    }
  }

  setScore (score: number) {
    this.score = score
    this.registry.set('score', score)
  }

  setMoves (moves: number) {
    this.moves = moves
    this.registry.set('moves', moves)
  }

  decrementMoves () {
    this.setMoves(this.moves - 1)
    if (this.moves <= 0) {
      this.gameOver('Out of moves!')
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

    // If clicking a power-up directly, activate it immediately
    if (pointedCell.powerup && this.selectedCell == null) {
      console.log('=== POWER-UP CLICKED DIRECTLY! ===')
      console.log(`Activating ${pointedCell.powerup} at [${pointedCell.row}, ${pointedCell.column}]`)
      this.moveInProgress = true
      this.triggerPowerUp(pointedCell)
      await this.destroyCells()
      this.decrementMoves()
      await this.makeCellsFall()
      await this.refillBoard()

      // Continue with cascade logic
      while (this.boardShouldExplode()) {
        const chains = this.getExplodingChains()
        this.createPowerUpsFromChains(chains)
        await this.destroyCells()
        this.setScore(this.score + this.computeScore(chains, 0))
        await this.makeCellsFall()
        await this.refillBoard()
      }

      const winningMoves = this.getWinningMoves()
      if (winningMoves.length === 0) {
        this.gameOver('No more moves!')
      }

      this.moveInProgress = false
      return
    }

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

    if (!this.cellsAreNeighbours(firstCell, secondCell)) {
      this.selectCell(secondCell)
      return
    }

    this.moveInProgress = true

    this.swapCells(firstCell, secondCell)

    await this.moveSpritesWhereTheyBelong()

    // Check if either swapped cell is a power-up and activate it
    const hasPowerUp = firstCell.powerup || secondCell.powerup
    if (hasPowerUp) {
      console.log('=== POWER-UP SWAPPED! ===')
      if (firstCell.powerup) {
        console.log(`Activating ${firstCell.powerup} at [${firstCell.row}, ${firstCell.column}]`)
        this.triggerPowerUp(firstCell)
      }
      if (secondCell.powerup) {
        console.log(`Activating ${secondCell.powerup} at [${secondCell.row}, ${secondCell.column}]`)
        this.triggerPowerUp(secondCell)
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
      const winningMoves = this.getWinningMoves()
      console.log(`${winningMoves.length} winning moves`)
      if (winningMoves.length === 0) {
        this.gameOver('No more moves!')
      }
    } else {
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

    const gameOverBackground = this.add.rectangle(0, 0, this.zone.width, this.zone.height)
      .setOrigin(0)
      .setFillStyle(0x000000, 0.8)

    const gameOverTitle = this.add.text(0, -50, message)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(32)
      .setColor('#FF4444')
      .setFontStyle('bold')

    const finalScoreText = this.add.text(0, 10, `Final Score: ${this.score}`)
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(24)
      .setColor('#FFD700')
      .setFontStyle('bold')

    const restartHint = this.add.text(0, 60, 'Click "New Game" to restart')
      .setOrigin(0.5)
      .setFontFamily('Arial')
      .setFontSize(18)
      .setColor('white')

    this.gameOverScreen = this.add.container(0, 0)
      .add(gameOverBackground)
      .add(gameOverTitle)
      .add(finalScoreText)
      .add(restartHint)
      .setDepth(1)

    Phaser.Display.Align.In.Center(gameOverTitle, gameOverBackground, 0, -50)
    Phaser.Display.Align.In.Center(finalScoreText, gameOverBackground, 0, 10)
    Phaser.Display.Align.In.Center(restartHint, gameOverBackground, 0, 60)
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
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => scoreText.destroy()
      })
    }
  }

  createPowerUpsFromChains (chains: Cell[][]) {
    for (const chain of chains) {
      if (chain.length >= 4) {
        // Determine if chain is horizontal or vertical
        const isHorizontal = chain[0].row === chain[1].row

        // Choose the middle cell for the power-up
        const middleIndex = Math.floor(chain.length / 2)
        const powerUpCell = chain[middleIndex]

        // Determine power-up type based on chain length and orientation
        let powerUpType: PowerUpType
        if (chain.length >= 5) {
          powerUpType = 'light-ball'  // 5+ match → color bomb
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
          .setInteractive()
      }
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

  triggerPowerUp (cell: Cell) {
    if (!cell.powerup) return

    const powerUpType = cell.powerup

    // Clear the power-up property and mark for destruction
    cell.powerup = null
    cell.empty = true

    // Mark additional cells based on power-up type
    switch (powerUpType) {
      case 'horizontal-rocket':
        // Destroy entire row
        for (let col = 0; col < size; col++) {
          this.board[cell.row][col].empty = true
        }
        break

      case 'vertical-rocket':
        // Destroy entire column
        for (let row = 0; row < size; row++) {
          this.board[row][cell.column].empty = true
        }
        break

      case 'light-ball':
        // Destroy all gems of the same color as adjacent gems
        const targetColor = this.getAdjacentGemColor(cell)
        if (targetColor) {
          for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
              if (this.board[row][col].color === targetColor) {
                this.board[row][col].empty = true
              }
            }
          }
        }
        break
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
          .setInteractive()
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

    await Promise.all(
      cellsToDestroy.map(cell => this.destroyCell(cell))
    )
  }

  destroyCell (cell: Cell) {
    return new Promise<void>(resolve => {
      cell.empty = true

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
    return this.board.some(row => row.some(cell => this.shouldExplode(cell)))
  }

  shouldExplode (cell: Cell): boolean {
    // Power-ups don't explode as part of normal matches - they must be activated
    if (cell.powerup) {
      return false
    }
    return this.shouldExplodeHorizontally(cell) || this.shouldExplodeVertically(cell)
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
