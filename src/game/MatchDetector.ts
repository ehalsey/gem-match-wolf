import * as Phaser from 'phaser'
import { type Cell } from '../types'

const explosionThreshold = 3
const size = 8

/**
 * Utility class for detecting matches and patterns on the board
 */
export class MatchDetector {
  /**
   * Get all chains (3+ in a row) that should explode
   */
  static getExplodingChains (board: Cell[][]): Cell[][] {
    const rows = board
    const columns = Phaser.Utils.Array.Matrix.TransposeMatrix(board)

    return [...rows, ...columns].flatMap(line => this.getExplodingChainsOnLine(line))
  }

  /**
   * Get chains on a single line (row or column)
   */
  static getExplodingChainsOnLine (line: Cell[]): Cell[][] {
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

  /**
   * Check if the board has any cells that should explode
   */
  static boardShouldExplode (board: Cell[][]): boolean {
    // Check for regular 3+ matches
    const hasRegularMatches = board.some(row => row.some(cell => this.shouldExplode(cell, board)))

    // Note: Special patterns check would go here if needed
    // const hasSpecialPatterns = this.detectSpecialPatterns(board).length > 0

    return hasRegularMatches
  }

  /**
   * Check if a cell should explode (is part of 3+ match)
   */
  static shouldExplode (cell: Cell, board: Cell[][]): boolean {
    // Power-ups don't explode as part of normal matches - they must be activated
    if (cell.powerup) {
      return false
    }
    return this.shouldExplodeHorizontally(cell, board) || this.shouldExplodeVertically(cell, board)
  }

  /**
   * Check if a cell is part of a horizontal match of 3+
   */
  static shouldExplodeHorizontally (cell: Cell, board: Cell[][]): boolean {
    const { row, column } = cell

    for (let startPosition = column - explosionThreshold + 1; startPosition <= column; startPosition++) {
      const endPosition = startPosition + explosionThreshold - 1
      if (startPosition >= 0 && endPosition < size) {
        let explosion = true
        for (let index = startPosition; index < endPosition; index++) {
          if (board[row][index].color !== board[row][index + 1].color) {
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

  /**
   * Check if a cell is part of a vertical match of 3+
   */
  static shouldExplodeVertically (cell: Cell, board: Cell[][]): boolean {
    const { row, column } = cell

    for (let startPosition = row - explosionThreshold + 1; startPosition <= row; startPosition++) {
      const endPosition = startPosition + explosionThreshold - 1
      if (startPosition >= 0 && endPosition < size) {
        let explosion = true
        for (let index = startPosition; index < endPosition; index++) {
          if (board[index][column].color !== board[index + 1][column].color) {
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

  /**
   * Check if placing a cell would create a 2x2 square
   */
  static wouldCreate2x2Square (cell: Cell, board: Cell[][]): boolean {
    const { row, column, color } = cell

    // Check if cell is top-left of a 2x2 square
    if (row < size - 1 && column < size - 1) {
      const topRight = board[row][column + 1]
      const bottomLeft = board[row + 1][column]
      const bottomRight = board[row + 1][column + 1]
      if (!topRight.empty && !bottomLeft.empty && !bottomRight.empty &&
          topRight.color === color && bottomLeft.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is top-right of a 2x2 square
    if (row < size - 1 && column > 0) {
      const topLeft = board[row][column - 1]
      const bottomLeft = board[row + 1][column - 1]
      const bottomRight = board[row + 1][column]
      if (!topLeft.empty && !bottomLeft.empty && !bottomRight.empty &&
          topLeft.color === color && bottomLeft.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is bottom-left of a 2x2 square
    if (row > 0 && column < size - 1) {
      const topLeft = board[row - 1][column]
      const topRight = board[row - 1][column + 1]
      const bottomRight = board[row][column + 1]
      if (!topLeft.empty && !topRight.empty && !bottomRight.empty &&
          topLeft.color === color && topRight.color === color && bottomRight.color === color) {
        return true
      }
    }

    // Check if cell is bottom-right of a 2x2 square
    if (row > 0 && column > 0) {
      const topLeft = board[row - 1][column - 1]
      const topRight = board[row - 1][column]
      const bottomLeft = board[row][column - 1]
      if (!topLeft.empty && !topRight.empty && !bottomLeft.empty &&
          topLeft.color === color && topRight.color === color && bottomLeft.color === color) {
        return true
      }
    }

    return false
  }

  /**
   * Check if two cells are neighbors (adjacent horizontally or vertically)
   */
  static cellsAreNeighbours (cell1: Cell, cell2: Cell): boolean {
    const rowDistance = Math.abs(cell1.row - cell2.row)
    const columnDistance = Math.abs(cell1.column - cell2.column)
    return (
      (rowDistance === 1 && columnDistance === 0) ||
      (rowDistance === 0 && columnDistance === 1)
    )
  }
}
