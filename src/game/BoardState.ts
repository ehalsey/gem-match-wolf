import { type Cell } from '../types'

export interface BoardConfig {
  width: number
  height: number
  shape?: 'rectangle' | 'diamond' | 'octagon' | 'custom'
  missingCells?: Array<{ row: number; col: number }>
}

/**
 * BoardState encapsulates the game board and provides a clean API
 * for board operations. Supports variable dimensions and non-rectangular boards.
 */
export class BoardState {
  private cells: (Cell | null)[][]
  private config: BoardConfig

  constructor(config: BoardConfig) {
    this.config = config
    this.cells = this.initializeCells()
  }

  /**
   * Initialize the cell grid based on configuration
   */
  private initializeCells(): (Cell | null)[][] {
    const { width, height, missingCells } = this.config
    const board: (Cell | null)[][] = []

    // Create missing cells lookup for O(1) access
    const missingSet = new Set(
      missingCells?.map(mc => `${mc.row},${mc.col}`) || []
    )

    for (let row = 0; row < height; row++) {
      board[row] = []
      for (let col = 0; col < width; col++) {
        if (missingSet.has(`${row},${col}`)) {
          board[row][col] = null
        } else {
          // Create cell placeholder (will be populated with gems by GameScene)
          board[row][col] = {
            row,
            column: col,
            color: '',
            sprite: null as any, // Will be set by GameScene
            empty: true,
            powerup: null
          }
        }
      }
    }

    return board
  }

  /**
   * Get cell at position, returns null if position is invalid or cell doesn't exist
   */
  getCell(row: number, col: number): Cell | null {
    if (!this.isValidPosition(row, col)) {
      return null
    }
    return this.cells[row][col]
  }

  /**
   * Set cell at position
   */
  setCell(row: number, col: number, cell: Cell | null): void {
    if (!this.isValidPosition(row, col)) {
      console.error(`Invalid position: (${row}, ${col})`)
      return
    }
    this.cells[row][col] = cell
  }

  /**
   * Get all cells (including nulls for missing positions)
   */
  getRawBoard(): (Cell | null)[][] {
    return this.cells
  }

  /**
   * Get all valid (non-null) cells as a flat array
   */
  getAllCells(): Cell[] {
    const result: Cell[] = []
    for (let row = 0; row < this.config.height; row++) {
      for (let col = 0; col < this.config.width; col++) {
        const cell = this.cells[row][col]
        if (cell !== null) {
          result.push(cell)
        }
      }
    }
    return result
  }

  /**
   * Get all valid cells that are not empty
   */
  getValidCells(): Cell[] {
    return this.getAllCells().filter(cell => !cell.empty)
  }

  /**
   * Get board width
   */
  getWidth(): number {
    return this.config.width
  }

  /**
   * Get board height
   */
  getHeight(): number {
    return this.config.height
  }

  /**
   * Check if position is within board bounds
   */
  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.config.height &&
           col >= 0 && col < this.config.width
  }

  /**
   * Check if position exists (not a missing cell)
   */
  cellExists(row: number, col: number): boolean {
    if (!this.isValidPosition(row, col)) {
      return false
    }
    return this.cells[row][col] !== null
  }

  /**
   * Get all neighbors (up, down, left, right) of a cell
   */
  getNeighbors(row: number, col: number): Cell[] {
    const neighbors: Cell[] = []
    const directions = [
      { dr: -1, dc: 0 },  // up
      { dr: 1, dc: 0 },   // down
      { dr: 0, dc: -1 },  // left
      { dr: 0, dc: 1 }    // right
    ]

    for (const { dr, dc } of directions) {
      const newRow = row + dr
      const newCol = col + dc
      const neighbor = this.getCell(newRow, newCol)
      if (neighbor !== null) {
        neighbors.push(neighbor)
      }
    }

    return neighbors
  }

  /**
   * Get cardinal neighbors (up, down, left, right) - alias for getNeighbors
   */
  getCardinalNeighbors(row: number, col: number): Cell[] {
    return this.getNeighbors(row, col)
  }

  /**
   * Get all 8 neighbors (including diagonals)
   */
  getAllNeighbors(row: number, col: number): Cell[] {
    const neighbors: Cell[] = []
    const directions = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
      { dr: 0, dc: -1 },                      { dr: 0, dc: 1 },
      { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 }
    ]

    for (const { dr, dc } of directions) {
      const newRow = row + dr
      const newCol = col + dc
      const neighbor = this.getCell(newRow, newCol)
      if (neighbor !== null) {
        neighbors.push(neighbor)
      }
    }

    return neighbors
  }

  /**
   * Iterate over all cells
   */
  forEach(callback: (cell: Cell | null, row: number, col: number) => void): void {
    for (let row = 0; row < this.config.height; row++) {
      for (let col = 0; col < this.config.width; col++) {
        callback(this.cells[row][col], row, col)
      }
    }
  }

  /**
   * Check if two cells are adjacent (horizontally or vertically)
   */
  areAdjacent(cell1: Cell, cell2: Cell): boolean {
    const rowDiff = Math.abs(cell1.row - cell2.row)
    const colDiff = Math.abs(cell1.column - cell2.column)

    // Adjacent if: same row and 1 column apart, OR same column and 1 row apart
    return (rowDiff === 0 && colDiff === 1) || (rowDiff === 1 && colDiff === 0)
  }

  /**
   * Check if two cells can be swapped
   */
  isSwappable(cell1: Cell, cell2: Cell): boolean {
    // Basic swappability check - can be extended with obstacle logic later
    return this.areAdjacent(cell1, cell2) && !cell1.empty && !cell2.empty
  }

  /**
   * Check if a cell can participate in matching
   */
  canMatch(cell: Cell): boolean {
    // Basic matching check - can be extended with obstacle logic later
    return !cell.empty && cell.color !== ''
  }

  /**
   * Clone the board state (for undo functionality)
   */
  clone(): BoardState {
    const clonedState = new BoardState(this.config)

    // Deep clone cells
    for (let row = 0; row < this.config.height; row++) {
      for (let col = 0; col < this.config.width; col++) {
        const cell = this.cells[row][col]
        if (cell !== null) {
          clonedState.cells[row][col] = {
            row: cell.row,
            column: cell.column,
            color: cell.color,
            sprite: cell.sprite,
            empty: cell.empty,
            powerup: cell.powerup,
            markedForDestruction: cell.markedForDestruction
          }
        }
      }
    }

    return clonedState
  }

  /**
   * Get board configuration
   */
  getConfig(): BoardConfig {
    return { ...this.config }
  }

  /**
   * Serialize board state (for undo, save, etc.)
   */
  serialize(): Array<{row: number, column: number, color: string | null, powerup: string | null, empty: boolean}> {
    const result: Array<{row: number, column: number, color: string | null, powerup: string | null, empty: boolean}> = []

    for (let row = 0; row < this.config.height; row++) {
      for (let col = 0; col < this.config.width; col++) {
        const cell = this.cells[row][col]
        if (cell !== null) {
          result.push({
            row: cell.row,
            column: cell.column,
            color: cell.color || null,
            powerup: cell.powerup || null,
            empty: cell.empty
          })
        }
      }
    }

    return result
  }

  /**
   * Restore board state from serialized data
   */
  restore(data: Array<{row: number, column: number, color: string | null, powerup: string | null, empty: boolean}>): void {
    for (const cellData of data) {
      const cell = this.getCell(cellData.row, cellData.column)
      if (cell !== null) {
        cell.color = cellData.color || ''
        cell.powerup = cellData.powerup as any
        cell.empty = cellData.empty
      }
    }
  }
}
