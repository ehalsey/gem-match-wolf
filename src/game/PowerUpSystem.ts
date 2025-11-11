import * as Phaser from 'phaser'
import { type Cell, type PowerUpType, type Position } from '../types'
import { CELL_SIZE, NUMBER_OF_CELLS_PER_ROW as size } from '../constants'

/**
 * Power-up System for managing power-up detection, creation, and activation
 *
 * Power-up Priority System:
 * 4 - Color Bomb (light-ball): 5+ linear match - most powerful, clears all gems of target color
 * 3 - TNT: T-shapes, L-shapes, and rectangles (3x2, 2x3) - area damage in 2-cell radius
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
    console.log('[PATTERN DETECTION] Starting special pattern detection', swapContext ? `with swap context: [${swapContext.from.row},${swapContext.from.column}] → [${swapContext.to.row},${swapContext.to.column}]` : 'without swap context')
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

        // Debug logging for 2x2 detection
        const allNotEmpty = !topLeft.empty && !topRight.empty && !bottomLeft.empty && !bottomRight.empty
        const noPowerups = !topLeft.powerup && !topRight.powerup && !bottomLeft.powerup && !bottomRight.powerup
        const colorsMatch = topLeft.color === topRight.color && topLeft.color === bottomLeft.color && topLeft.color === bottomRight.color

        if (allNotEmpty && noPowerups) {
          console.log(`[2x2 CHECK] Checking square at [${row},${col}]:`, {
            topLeft: `${topLeft.color} [${topLeft.row},${topLeft.column}]`,
            topRight: `${topRight.color} [${topRight.row},${topRight.column}]`,
            bottomLeft: `${bottomLeft.color} [${bottomLeft.row},${bottomLeft.column}]`,
            bottomRight: `${bottomRight.color} [${bottomRight.row},${bottomRight.column}]`,
            colorsMatch
          })
        }

        // Check if all 4 cells match and aren't empty or power-ups
        if (allNotEmpty && noPowerups && colorsMatch) {
          console.log(`[2x2 FOUND] ✓ 2x2 square detected at [${row},${col}] with color ${topLeft.color}!`)

          // Expand the 2x2 to include all adjacent same-colored gems
          const expandedCells = this.expandSquarePattern(board, squareCells, topLeft.color)
          console.log(`[2x2 EXPANDED] Expanded from 4 cells to ${expandedCells.length} cells`)

          // Found a 2x2 square! Position fly-away based on swap direction
          let flyAwayCell = topLeft // default to top-left

          // If we have swap context, use directional logic
          if (swapContext) {
            // Check if any of the swap positions falls within the square bounds
            const squareRowRange = [row, row + 1]
            const squareColRange = [col, col + 1]

            const toInSquare = squareRowRange.includes(swapContext.to.row) && squareColRange.includes(swapContext.to.column)
            const fromInSquare = squareRowRange.includes(swapContext.from.row) && squareColRange.includes(swapContext.from.column)

            console.log(`[FLY-AWAY] Swap detected: from [${swapContext.from.row}, ${swapContext.from.column}] to [${swapContext.to.row}, ${swapContext.to.column}]`)
            console.log(`[FLY-AWAY] 2x2 square at [${row}, ${col}], to in square: ${toInSquare}, from in square: ${fromInSquare}`)

            if (toInSquare || fromInSquare) {
              // Determine swap direction
              const swapFromLeft = swapContext.from.column < swapContext.to.column // moving right
              const swapFromRight = swapContext.from.column > swapContext.to.column // moving left
              const isVerticalSwap = swapContext.from.column === swapContext.to.column

              if (swapFromRight) {
                // RIGHT-to-LEFT: place on the left side (top-left)
                flyAwayCell = topLeft
                console.log(`[FLY-AWAY] RIGHT-to-LEFT swap → placing at top-left [${topLeft.row}, ${topLeft.column}]`)
              } else if (swapFromLeft) {
                // LEFT-to-RIGHT: place on bottom-left
                flyAwayCell = bottomLeft
                console.log(`[FLY-AWAY] LEFT-to-RIGHT swap → placing at bottom-left [${bottomLeft.row}, ${bottomLeft.column}]`)
              } else if (isVerticalSwap) {
                // VERTICAL: prefer swap 'to' position
                if (toInSquare) {
                  if (swapContext.to.row === row && swapContext.to.column === col) {
                    flyAwayCell = topLeft
                  } else if (swapContext.to.row === row && swapContext.to.column === col + 1) {
                    flyAwayCell = topRight
                  } else if (swapContext.to.row === row + 1 && swapContext.to.column === col) {
                    flyAwayCell = bottomLeft
                  } else if (swapContext.to.row === row + 1 && swapContext.to.column === col + 1) {
                    flyAwayCell = bottomRight
                  }
                  console.log(`[FLY-AWAY] VERTICAL swap → placing at 'to' position [${flyAwayCell.row}, ${flyAwayCell.column}]`)
                } else if (fromInSquare) {
                  if (swapContext.from.row === row && swapContext.from.column === col) {
                    flyAwayCell = topLeft
                  } else if (swapContext.from.row === row && swapContext.from.column === col + 1) {
                    flyAwayCell = topRight
                  } else if (swapContext.from.row === row + 1 && swapContext.from.column === col) {
                    flyAwayCell = bottomLeft
                  } else if (swapContext.from.row === row + 1 && swapContext.from.column === col + 1) {
                    flyAwayCell = bottomRight
                  }
                  console.log(`[FLY-AWAY] VERTICAL swap → placing at 'from' position [${flyAwayCell.row}, ${flyAwayCell.column}]`)
                }
              }
            } else {
              console.log(`[FLY-AWAY] Swap not in square - using default top-left [${topLeft.row}, ${topLeft.column}]`)
            }
          }

          patterns.push({
            cell: flyAwayCell,
            type: 'fly-away',
            cells: expandedCells,  // Use expanded cells instead of just the 2x2
            priority: 2
          })
        }
      }
    }

    // Detect T-shapes for TNT (all 4 orientations) (Priority: 3)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const center = board[row][col]
        if (center.empty || center.powerup) continue

        // T-shape 1: T pointing down (3 across + 2 down from center)
        // Pattern: X X X
        //            X
        //            X
        if (col >= 1 && col <= size - 2 && row <= size - 3) {
          const left = board[row][col - 1]
          const right = board[row][col + 1]
          const down1 = board[row + 1][col]
          const down2 = board[row + 2][col]
          const tCells = [center, left, right, down1, down2]

          if (tCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: tCells, priority: 3 })
          }
        }

        // T-shape 2: T pointing up (3 across + 2 up from center)
        // Pattern:   X
        //            X
        //          X X X
        if (col >= 1 && col <= size - 2 && row >= 2) {
          const left = board[row][col - 1]
          const right = board[row][col + 1]
          const up1 = board[row - 1][col]
          const up2 = board[row - 2][col]
          const tCells = [center, left, right, up1, up2]

          if (tCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: tCells, priority: 3 })
          }
        }

        // T-shape 3: T pointing right (3 down + 2 right from center)
        // Pattern: X X X
        //          X
        //          X
        if (row >= 1 && row <= size - 2 && col <= size - 3) {
          const up = board[row - 1][col]
          const down = board[row + 1][col]
          const right1 = board[row][col + 1]
          const right2 = board[row][col + 2]
          const tCells = [center, up, down, right1, right2]

          if (tCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: tCells, priority: 3 })
          }
        }

        // T-shape 4: T pointing left (3 down + 2 left from center)
        // Pattern: X X X
        //              X
        //              X
        if (row >= 1 && row <= size - 2 && col >= 2) {
          const up = board[row - 1][col]
          const down = board[row + 1][col]
          const left1 = board[row][col - 1]
          const left2 = board[row][col - 2]
          const tCells = [center, up, down, left1, left2]

          if (tCells.every(c => !c.empty && !c.powerup && c.color === center.color)) {
            patterns.push({ cell: center, type: 'tnt', cells: tCells, priority: 3 })
          }
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

    console.log(`[PATTERN DETECTION] Found ${patterns.length} special patterns:`, patterns.map(p => `${p.type} at [${p.cell.row},${p.cell.column}]`))
    return patterns
  }

  /**
   * Check if the board has any special patterns (2x2, L-shapes, rectangles)
   * Used for swap validation - a move is valid if it creates special patterns
   */
  hasSpecialPatterns (board: Cell[][], swapContext?: { from: Position, to: Position }): boolean {
    return this.detectSpecialPatterns(board, swapContext).length > 0
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

        // Choose power-up cell position
        let powerUpCell: Cell

        // If we have swap context, place power-up at one of the swap positions (if in chain)
        if (swapContext) {
          const fromCell = chain.find(c => c.row === swapContext.from.row && c.column === swapContext.from.column)
          const toCell = chain.find(c => c.row === swapContext.to.row && c.column === swapContext.to.column)

          // Prefer the 'to' position (where the gem was moved to), or fall back to 'from'
          if (toCell) {
            powerUpCell = toCell
            console.log(`[ROCKET POSITION] Placing ${isHorizontal ? 'horizontal' : 'vertical'} rocket at swap 'to' position: [${powerUpCell.row}, ${powerUpCell.column}]`)
          } else if (fromCell) {
            powerUpCell = fromCell
            console.log(`[ROCKET POSITION] Placing ${isHorizontal ? 'horizontal' : 'vertical'} rocket at swap 'from' position: [${powerUpCell.row}, ${powerUpCell.column}]`)
          } else {
            // Swap positions not in chain - this shouldn't happen for user swaps but could for cascades
            powerUpCell = chain[Math.floor(chain.length / 2)]
            console.warn(`[ROCKET POSITION] WARNING: Swap context provided but neither swap position is in chain! Using middle cell: [${powerUpCell.row}, ${powerUpCell.column}]`)
            console.warn(`  Swap was from [${swapContext.from.row}, ${swapContext.from.column}] to [${swapContext.to.row}, ${swapContext.to.column}]`)
            console.warn(`  Chain cells:`, chain.map(c => `[${c.row}, ${c.column}]`))
          }
        } else {
          // No swap context, use middle cell
          powerUpCell = chain[Math.floor(chain.length / 2)]
          console.log(`[ROCKET POSITION] No swap context - placing ${isHorizontal ? 'horizontal' : 'vertical'} rocket at middle of chain: [${powerUpCell.row}, ${powerUpCell.column}]`)
        }

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

    // Destroy old sprite if it exists
    if (powerUpCell.sprite) {
      powerUpCell.sprite.destroy()
    }

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
   * Create visual effect when power-up is created
   * Currently disabled - no particle effect
   */
  createPowerUpBurst (x: number, y: number, powerUpType: PowerUpType) {
    // No visual effect - power-up sprite appearance is enough
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

  /**
   * Expand a 2x2 square pattern to include all adjacent same-colored gems
   * Uses flood-fill algorithm to find connected gems
   */
  expandSquarePattern(board: Cell[][], squareCells: Cell[], color: string): Cell[] {
    const visited = new Set<Cell>()
    const expanded: Cell[] = []
    const queue: Cell[] = [...squareCells]

    // Add initial square cells to visited
    squareCells.forEach(cell => visited.add(cell))

    while (queue.length > 0) {
      const current = queue.shift()!
      expanded.push(current)

      // Check all 4 adjacent cells
      const neighbors = [
        current.row > 0 ? board[current.row - 1][current.column] : null,  // Up
        current.row < size - 1 ? board[current.row + 1][current.column] : null,  // Down
        current.column > 0 ? board[current.row][current.column - 1] : null,  // Left
        current.column < size - 1 ? board[current.row][current.column + 1] : null  // Right
      ].filter(n => n !== null) as Cell[]

      for (const neighbor of neighbors) {
        // Include if same color, not empty, not a powerup, and not visited
        if (
          !visited.has(neighbor) &&
          !neighbor.empty &&
          !neighbor.powerup &&
          neighbor.color === color
        ) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    return expanded
  }
}
