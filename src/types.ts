import * as Phaser from 'phaser'

export type PowerUpType = 'horizontal-rocket' | 'vertical-rocket' | 'tnt' | 'light-ball' | 'fly-away' | null

export interface Cell {
  row: number
  column: number
  color: string
  sprite: Phaser.GameObjects.Sprite
  empty: boolean
  powerup: PowerUpType
  markedForDestruction?: boolean

  // Obstacle system (Phase 2)
  obstacleState?: {
    type: string
    durability: number
    properties?: {
      lockedGemColor?: string
      requiresChain?: number
    }
  } | null
}

export interface Position {
  row: number
  column: number
}
