/**
 * Gem Configuration System
 *
 * Maps gem IDs to sprite assets, allowing multiple gems to share the same sprite.
 * This enables future expansion where we can have different gem types with the same color.
 */

export interface GemDefinition {
  id: string          // Unique gem identifier (e.g., 'blue', 'gem1')
  sprite: string      // Sprite asset name (e.g., 'blue', 'pink')
  displayName: string // Human-readable name for UI/debugging
}

/**
 * Available gem definitions
 * For backward compatibility, using color names as IDs initially
 */
export const GEM_DEFINITIONS: GemDefinition[] = [
  { id: 'blue', sprite: 'blue', displayName: 'Blue' },
  { id: 'green', sprite: 'green', displayName: 'Green' },
  { id: 'red', sprite: 'red', displayName: 'Red' },
  { id: 'pink', sprite: 'pink', displayName: 'Pink' },
  { id: 'yellow', sprite: 'yellow', displayName: 'Yellow' }
]

/**
 * Map of gem ID to sprite name for quick lookup
 */
const GEM_SPRITE_MAP: Map<string, string> = new Map(
  GEM_DEFINITIONS.map(gem => [gem.id, gem.sprite])
)

/**
 * Get sprite name for a gem ID
 */
export function getGemSprite(gemId: string): string {
  const sprite = GEM_SPRITE_MAP.get(gemId)
  if (!sprite) {
    console.warn(`[GemConfig] Unknown gem ID: ${gemId}, falling back to gem ID as sprite`)
    return gemId
  }
  return sprite
}

/**
 * Get all gem IDs
 */
export function getAllGemIds(): string[] {
  return GEM_DEFINITIONS.map(gem => gem.id)
}

/**
 * Get gem definition by ID
 */
export function getGemDefinition(gemId: string): GemDefinition | undefined {
  return GEM_DEFINITIONS.find(gem => gem.id === gemId)
}
