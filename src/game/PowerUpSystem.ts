import * as Phaser from 'phaser'
import { type Cell, type PowerUpType, type Position } from '../types'
import { CELL_SIZE, NUMBER_OF_CELLS_PER_ROW as size } from '../constants'

/**
 * Power-up System for managing power-up detection, creation, and activation
 *
 * Power-up Priority System:
 * 4 - Color Bomb (light-ball): 5+ linear match - most powerful, clears all gems of target color
 * 3 - TNT: L-shapes and rectangles (3x2, 2x3) - area damage in 2-cell radius
 * 2 - Fly-away: 2x2 squares - flies to random gem and explodes
 * 1 - Rockets: 4-match linear (horizontal/vertical) - clears entire row or column
 */
export class PowerUpSystem {
  private scene: Phaser.Scene

  constructor (scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Detect special patterns for power-up creation
   * Returns patterns with priority for resolution
   */
  detectSpecialPatterns (board: Cell[][], swapContext?: { from: Position, to: Position }): Array<{ cell: Cell, type: PowerUpType, cells: Cell[], priority: number }> {
    const patterns: Array<{ cell: Cell, type: PowerUpType, cells: Cell[], priority: number }> = []

    // Detect 3x2 and 2x3 rectangles for TNT (Priority: 3)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const topLeft = board[row][col]
        if (topLeft.empty || topLeft.powerup) continue

        // 3x2 horizontal rectangle (3 columns, 2 rows)
        if (col <= size - 3 && row <= size - 2) {
          const cells = [
            board[row][col],
            board[row][col + 1],
            board[row][col + 2],
            board[row + 1][col],
            board[row + 1][col + 1],
            board[row + 1][col + 2]
          ]

          if (cells.every(c => !c.empty && !c.powerup && c.color === topLeft.color)) {
            // Place power-up in center of rectangle (middle of top row)
            patterns.push({ cell: board[row][col + 1], type: 'tnt', cells, priority: 3 })
          }
        }

        // 2x3 vertical rectangle (2 columns, 3 rows)
        if (col <= size - 2 && row <= size - 3) {
          const cells = [
            board[row][col],
            board[row][col + 1],
            board[row + 1][col],
            board[row + 1][col + 1],
            board[row + 2][col],
            board[row + 2][col + 1]
          ]

          if (cells.every(c => !c.empty && !c.powerup && c.color === topLeft.color)) {
            // Place power-up in center of rectangle (middle row, left column)
            patterns.push({ cell: board[row + 1][col], type: 'tnt', cells, priority: 3 })
          }
        }
      }
    }

    // Detect 2x2 squares for Fly Away (Priority: 2)
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        const topLeft = board[row][col]
        const topRight = board[row][col + 1]
        const bottomLeft = board[row + 1][col]
        const bottomRight = board[row + 1][col + 1]

        const squareCells = [topLeft, topRight, bottomLeft, bottomRight]

        // Check if all 4 cells match and aren't empty or power-ups
        if (
          !topLeft.empty && !topLeft.powerup &&
          topLeft.color === topRight.color &&
          topLeft.color === bottomLeft.color &&
          topLeft.color === bottomRight.color
        ) {
          // Found a 2x2 square! Position fly-away based on swap direction
          let flyAwayCell = topLeft // default to top-left

          // If we have swap context, determine direction and position accordingly
          if (swapContext) {
            // Check if any of the swap positions falls within the square bounds
            const squareRowRange = [row, row + 1]
            const squareColRange = [col, col + 1]
            const isSwapInSquare =
              (squareRowRange.includes(swapContext.from.row) && squareColRange.includes(swapContext.from.column)) ||
              (squareRowRange.includes(swapContext.to.row) && squareColRange.includes(swapContext.to.column))

            if (isSwapInSquare) {
              // Determine horizontal direction of swap
              const swapFromLeft = swapContext.from.column < swapContext.to.column
              const swapFromRight = swapContext.from.column > swapContext.to.column

              console.log(`[FLY-AWAY] Swap detected: from [${swapContext.from.row}, ${swapContext.from.column}] to [${swapContext.to.row}, ${swapContext.to.column}]`)
              console.log(`[FLY-AWAY] Direction: ${swapFromRight ? 'RIGHT-TO-LEFT' : swapFromLeft ? 'LEFT-TO-RIGHT' : 'VERTICAL'}`)

              if (swapFromRight) {
                // Match made from right → position at lower right (bottomRight)
                flyAwayCell = bottomRight
                console.log(`[FLY-AWAY] Positioning at bottom-right [${bottomRight.row}, ${bottomRight.column}]`)
              } else if (swapFromLeft) {
                // Match made from left → position at lower left (bottomLeft)
                flyAwayCell = bottomLeft
                console.log(`[FLY-AWAY] Positioning at bottom-left [${bottomLeft.row}, ${bottomLeft.column}]`)
              } else {
                console.log(`[FLY-AWAY] Positioning at default top-left [${topLeft.row}, ${topLeft.column}]`)
              }
              // Note: vertical swaps default to topLeft (original behavior)
            }
          }

          patterns.push({
            cell: flyAwayCell,
            type: 'fly-away',
            cells: squareCells,
            priority: 2
          })
        }
      }
    }

    // Detect L-shapes for TNT (all 4 orientations) (Priority: 3)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const center = board[row][col]
        if (center.empty || center.powerup) continue

        // L-shape 1: └ (right and up)
        if (col <= size - 3 && row >= 2) {
          const right1 = board[row][col + 1]
          const right2 = board[row][col + 2]
          const up1 = board[row - 1][col]
          const up2 = board[row - 2][col]
          const lCells = [center, right1, right2, up1, up2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells, priority: 3 })
          }
        }

        // L-shape 2: ┘ (left and up)
        if (col >= 2 && row >= 2) {
          const left1 = board[row][col - 1]
          const left2 = board[row][col - 2]
          const up1 = board[row - 1][col]
          const up2 = board[row - 2][col]
          const lCells = [center, left1, left2, up1, up2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells, priority: 3 })
          }
        }

        // L-shape 3: ┌ (right and down)
        if (col <= size - 3 && row <= size - 3) {
          const right1 = board[row][col + 1]
          const right2 = board[row][col + 2]
          const down1 = board[row + 1][col]
          const down2 = board[row + 2][col]
          const lCells = [center, right1, right2, down1, down2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells, priority: 3 })
          }
        }

        // L-shape 4: ┐ (left and down)
        if (col >= 2 && row <= size - 3) {
          const left1 = board[row][col - 1]
          const left2 = board[row][col - 2]
          const down1 = board[row + 1][col]
          const down2 = board[row + 2][col]
          const lCells = [center, left1, left2, down1, down2]

          if (lCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: lCells, priority: 3 })
          }
        }
      }
    }

    return patterns
  }

  /**
   * Resolve power-up priority conflicts
   * When multiple patterns overlap, choose the highest priority pattern
   */
  resolvePowerUpPriorities (allPatterns: Array<{ cell: Cell, type: PowerUpType, cells: Cell[], priority: number }>): Array<{ cell: Cell, type: PowerUpType, cells: Cell[] }> {
    if (allPatterns.length === 0) return []

    // Sort patterns by priority (highest first)
    const sortedPatterns = [...allPatterns].sort((a, b) => b.priority - a.priority)

    const finalPatterns: Array<{ cell: Cell, type: PowerUpType, cells: Cell[] }> = []
    const usedCells = new Set<Cell>()

    for (const pattern of sortedPatterns) {
      // Check if any cells in this pattern have already been used by a higher priority pattern
      const hasOverlap = pattern.cells.some(cell => usedCells.has(cell))

      if (!hasOverlap) {
        // No overlap, keep this pattern
        finalPatterns.push({
          cell: pattern.cell,
          type: pattern.type,
          cells: pattern.cells
        })

        // Mark all cells in this pattern as used
        pattern.cells.forEach(cell => usedCells.add(cell))
      }
    }

    return finalPatterns
  }

  /**
   * Create power-ups from matched chains
   * Returns true if any power-ups were created
   */
  createPowerUpsFromChains (
    board: Cell[][],
    chains: Cell[][],
    onPowerUpCreated: (type: PowerUpType) => void,
    swapContext?: { from: Position, to: Position } | null
  ): boolean {
    let powerUpsCreated = false

    // Collect ALL potential patterns with priorities
    const allPatterns: Array<{ cell: Cell, type: PowerUpType, cells: Cell[], priority: number }> = []

    // 1. Detect special patterns (rectangles, L-shapes, squares)
    const specialPatterns = this.detectSpecialPatterns(board, swapContext || undefined)
    allPatterns.push(...specialPatterns)

    // 2. Detect linear chain patterns (4+ matches)
    for (const chain of chains) {
      if (chain.length >= 4) {
        // Determine if chain is horizontal or vertical
        const isHorizontal = chain[0].row === chain[1].row

        // Choose the middle cell for the power-up
        const middleIndex = Math.floor(chain.length / 2)
        const powerUpCell = chain[middleIndex]

        // Determine power-up type and priority based on chain length
        let powerUpType: PowerUpType
        let priority: number
        if (chain.length >= 5) {
          powerUpType = 'light-ball'  // 5+ match → color bomb (highest priority)
          priority = 4
        } else if (isHorizontal) {
          powerUpType = 'horizontal-rocket'  // 4 horizontal → horizontal rocket
          priority = 1
        } else {
          powerUpType = 'vertical-rocket'  // 4 vertical → vertical rocket
          priority = 1
        }

        allPatterns.push({
          cell: powerUpCell,
          type: powerUpType,
          cells: chain,
          priority
        })
      }
    }

    // Resolve conflicts - if patterns overlap, highest priority wins
    const finalPatterns = this.resolvePowerUpPriorities(allPatterns)

    // Create power-ups and destroy matched gems
    for (const pattern of finalPatterns) {
      powerUpsCreated = true
      const powerUpCell = pattern.cell
      const powerUpType = pattern.type

      // Destroy all cells in the pattern except the power-up cell
      for (const cell of pattern.cells) {
        if (cell !== powerUpCell) {
          cell.empty = true
          cell.sprite?.destroy()
          cell.color = null
        }
      }

      this.createPowerUp(board, powerUpCell, powerUpType, onPowerUpCreated)
    }

    return powerUpsCreated
  }

  /**
   * Create a power-up on a cell
   */
  createPowerUp (
    board: Cell[][],
    powerUpCell: Cell,
    powerUpType: PowerUpType,
    onPowerUpCreated: (type: PowerUpType) => void
  ) {
    // Set power-up type
    powerUpCell.powerup = powerUpType

    // Power-ups use their type as their color for rendering
    powerUpCell.color = powerUpType

    // Create sprite at cell position
    const x = powerUpCell.column * CELL_SIZE + CELL_SIZE / 2
    const y = powerUpCell.row * CELL_SIZE + CELL_SIZE / 2

    // Destroy old sprite
    powerUpCell.sprite.destroy()

    // Create new power-up sprite
    powerUpCell.sprite = this.scene.add.sprite(x, y, powerUpType)
      .setDisplaySize(CELL_SIZE, CELL_SIZE)
      .setInteractive({ draggable: true })

    // Visual effect
    this.createPowerUpBurst(x, y, powerUpType)

    // Update challenge tracking
    onPowerUpCreated(powerUpType)
  }

  /**
   * Create visual burst effect when power-up is created
   */
  createPowerUpBurst (x: number, y: number, powerUpType: PowerUpType) {
    let color: number
    // Choose particle color based on power-up type
    if (powerUpType === 'light-ball') {
      color = 0xFFFFFF  // White for color bomb
    } else if (powerUpType === 'horizontal-rocket' || powerUpType === 'vertical-rocket') {
      color = 0xFF6600  // Orange for rockets
    } else {
      color = 0xFFFF00  // Yellow for other power-ups
    }

    this.scene.add.particles(x, y, 'blue', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.3, end: 0 },
      blendMode: 'ADD',
      lifespan: 400,
      tint: color,
      quantity: 15
    })
  }

  /**
   * Activate power-ups adjacent to exploding chains
   */
  activatePowerUps (
    board: Cell[][],
    chains: Cell[][],
    onTrigger: (cell: Cell, swappedWith?: Cell, targetedCells?: Set<Cell>) => void
  ) {
    const targetedCells = new Set<Cell>()

    for (const chain of chains) {
      for (const cell of chain) {
        // Check all 4 neighbors for power-ups
        const neighbors = [
          cell.row > 0 ? board[cell.row - 1][cell.column] : null,
          cell.row < size - 1 ? board[cell.row + 1][cell.column] : null,
          cell.column > 0 ? board[cell.row][cell.column - 1] : null,
          cell.column < size - 1 ? board[cell.row][cell.column + 1] : null
        ].filter(n => n !== null)

        for (const neighbor of neighbors) {
          if (neighbor.powerup && !neighbor.empty) {
            onTrigger(neighbor, undefined, targetedCells)
          }
        }
      }
    }
  }

  /**
   * Find a target cell for fly-away power-up
   * Prefers cells with many same-color neighbors (higher explosion potential)
   */
  findFlyAwayTarget (board: Cell[][], fromCell: Cell, targetedCells: Set<Cell> = new Set()): Cell | null {
    const candidates: Array<{ cell: Cell, matchCount: number }> = []

    // Exclude cells that are already targeted by other fly-aways
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = board[row][col]

        // Skip empty cells, power-ups, the source cell, and already targeted cells
        if (cell.empty || cell.powerup || cell === fromCell) continue
        if (targetedCells.has(cell)) continue

        // Count same-color neighbors
        const neighbors = [
          row > 0 ? board[row - 1][col] : null,
          row < size - 1 ? board[row + 1][col] : null,
          col > 0 ? board[row][col - 1] : null,
          col < size - 1 ? board[row][col + 1] : null
        ].filter(n => n !== null)

        const matchCount = neighbors.filter(n => !n.empty && !n.powerup && n.color === cell.color).length

        candidates.push({ cell, matchCount })
      }
    }

    if (candidates.length === 0) return null

    // Sort by match count (descending) for better targeting
    candidates.sort((a, b) => b.matchCount - a.matchCount)

    // Pick from top candidates with some randomness
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length))
    return topCandidates[Math.floor(Math.random() * topCandidates.length)].cell
  }
}
