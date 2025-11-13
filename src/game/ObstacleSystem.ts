import { type Cell } from '../types'
import { type BoardState } from './BoardState'

/**
 * Obstacle types that can be placed on the board
 */
export type ObstacleType =
  | 'ice'           // Blocks matching, breaks after 1 match nearby
  | 'double-ice'    // Blocks matching, breaks after 2 matches nearby
  | 'stone'         // Permanent blocker, only removed by power-ups
  | 'locked'        // Requires key match to unlock
  | 'chain'         // Requires chain combo to break
  | null

/**
 * State information for obstacles on cells
 */
export interface ObstacleState {
  type: ObstacleType
  durability: number  // How many hits until destroyed
  properties?: {
    lockedGemColor?: string  // For locked obstacles - which color unlocks it
    requiresChain?: number   // For chain obstacles - minimum chain length needed
  }
}

/**
 * Definition of obstacle behavior and properties
 */
export interface ObstacleDefinition {
  id: ObstacleType
  name: string
  sprite: string

  // Blocking behavior
  blockMatch: boolean      // Prevents the cell from participating in matches
  blockSwap: boolean       // Prevents swapping this cell
  blockFall: boolean       // Prevents gems falling through this position

  // Durability
  durability: number       // Default durability value

  // Callbacks for obstacle behavior
  onHit?: (cell: Cell, boardState: BoardState) => void
  onDestroy?: (cell: Cell, boardState: BoardState) => void
}

/**
 * Registry of all obstacle types and their behaviors
 */
export const OBSTACLE_DEFINITIONS: Record<string, ObstacleDefinition> = {
  ice: {
    id: 'ice',
    name: 'Ice',
    sprite: 'ice-overlay',
    blockMatch: true,
    blockSwap: false,
    blockFall: false,
    durability: 1,
    onHit: (cell: Cell) => {
      if (cell.obstacleState) {
        cell.obstacleState.durability -= 1
        if (cell.obstacleState.durability <= 0) {
          cell.obstacleState = null
        }
      }
    }
  },

  'double-ice': {
    id: 'double-ice',
    name: 'Double Ice',
    sprite: 'double-ice-overlay',
    blockMatch: true,
    blockSwap: false,
    blockFall: false,
    durability: 2,
    onHit: (cell: Cell) => {
      if (cell.obstacleState) {
        cell.obstacleState.durability -= 1
        if (cell.obstacleState.durability <= 0) {
          cell.obstacleState = null
        }
      }
    }
  },

  stone: {
    id: 'stone',
    name: 'Stone Block',
    sprite: 'stone-block',
    blockMatch: true,
    blockSwap: true,
    blockFall: true,
    durability: 999, // Effectively indestructible by normal means
    onHit: (cell: Cell) => {
      // Stone doesn't take damage from adjacent matches
      // Only power-ups can destroy it
    },
    onDestroy: (cell: Cell) => {
      // Custom logic when destroyed by power-up
      cell.obstacleState = null
      cell.empty = true
    }
  },

  locked: {
    id: 'locked',
    name: 'Locked Gem',
    sprite: 'lock-overlay',
    blockMatch: true,
    blockSwap: true,
    blockFall: false,
    durability: 1,
    onHit: (cell: Cell) => {
      // Locked gems are unlocked by matching the key color nearby
      if (cell.obstacleState) {
        cell.obstacleState = null
      }
    }
  },

  chain: {
    id: 'chain',
    name: 'Chained Gem',
    sprite: 'chain-overlay',
    blockMatch: true,
    blockSwap: true,
    blockFall: false,
    durability: 1,
    onHit: (cell: Cell) => {
      // Chains are broken by combo chains
      if (cell.obstacleState) {
        cell.obstacleState = null
      }
    }
  }
}

/**
 * Helper functions for working with obstacles
 */
export class ObstacleSystem {
  /**
   * Check if a cell has an obstacle
   */
  static hasObstacle(cell: Cell | null): boolean {
    return cell !== null && cell.obstacleState !== null && cell.obstacleState !== undefined
  }

  /**
   * Check if a cell's obstacle blocks matching
   */
  static blocksMatching(cell: Cell | null): boolean {
    if (!cell || !cell.obstacleState) return false
    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    return def ? def.blockMatch : false
  }

  /**
   * Check if a cell's obstacle blocks swapping
   */
  static blocksSwapping(cell: Cell | null): boolean {
    if (!cell || !cell.obstacleState) return false
    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    return def ? def.blockSwap : false
  }

  /**
   * Check if a cell's obstacle blocks falling gems
   */
  static blocksFalling(cell: Cell | null): boolean {
    if (!cell || !cell.obstacleState) return false
    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    return def ? def.blockFall : false
  }

  /**
   * Damage an obstacle (called when adjacent gems match)
   */
  static damageObstacle(cell: Cell, boardState: BoardState): boolean {
    if (!cell.obstacleState) return false

    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    if (def && def.onHit) {
      def.onHit(cell, boardState)
    }

    // Return true if obstacle was destroyed
    return cell.obstacleState === null
  }

  /**
   * Destroy an obstacle (called by power-ups)
   */
  static destroyObstacle(cell: Cell, boardState: BoardState): void {
    if (!cell.obstacleState) return

    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    if (def && def.onDestroy) {
      def.onDestroy(cell, boardState)
    } else {
      cell.obstacleState = null
    }
  }

  /**
   * Create an obstacle state for a cell
   */
  static createObstacle(type: ObstacleType, properties?: ObstacleState['properties']): ObstacleState | null {
    if (!type) return null

    const def = OBSTACLE_DEFINITIONS[type]
    if (!def) return null

    return {
      type,
      durability: def.durability,
      properties
    }
  }

  /**
   * Check if a cell can be matched (not blocked by obstacle)
   */
  static canMatch(cell: Cell | null): boolean {
    if (!cell || cell.empty) return false
    return !this.blocksMatching(cell)
  }

  /**
   * Check if two cells can be swapped (not blocked by obstacles)
   */
  static canSwap(cell1: Cell | null, cell2: Cell | null): boolean {
    if (!cell1 || !cell2) return false
    return !this.blocksSwapping(cell1) && !this.blocksSwapping(cell2)
  }

  /**
   * Damage all obstacles adjacent to a cell (when that cell's gems match)
   */
  static damageAdjacentObstacles(cell: Cell, boardState: BoardState): Cell[] {
    const damagedCells: Cell[] = []
    const neighbors = boardState.getNeighbors(cell.row, cell.column)

    for (const neighbor of neighbors) {
      if (this.hasObstacle(neighbor)) {
        const destroyed = this.damageObstacle(neighbor, boardState)
        if (destroyed) {
          damagedCells.push(neighbor)
        }
      }
    }

    return damagedCells
  }

  /**
   * Get the sprite name for an obstacle's current state
   */
  static getObstacleSprite(cell: Cell): string | null {
    if (!cell.obstacleState) return null

    const def = OBSTACLE_DEFINITIONS[cell.obstacleState.type!]
    if (!def) return null

    // For multi-durability obstacles, could return different sprites
    // For now, just return the base sprite
    return def.sprite
  }
}
