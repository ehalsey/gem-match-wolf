/**
 * Level System with rotating difficulty and challenges
 *
 * Difficulty Pattern: Easy → Easy → Medium → Easy → Hard → Easy (repeat)
 * - Easy: 40 moves, simple challenges
 * - Medium: 30 moves, moderate challenges
 * - Hard: 20 moves, tough challenges
 */

export type Difficulty = 'easy' | 'medium' | 'hard'

export type ChallengeType =
  | 'color-match'      // Match X gems of a specific color
  | 'score-target'     // Reach target score
  | 'power-up-create'  // Create X power-ups of a type

export interface Challenge {
  type: ChallengeType
  description: string
  targetValue: number
  currentValue: number
  color?: string  // For color-match challenges
  powerUpType?: string  // For power-up-create challenges
}

export interface LevelConfig {
  level: number
  difficulty: Difficulty
  moves: number
  challenge: Challenge
}

export class LevelSystem {
  private static readonly STORAGE_KEY = 'gem-match-current-level'
  private static readonly LIVES_KEY = 'gem-match-lives'
  private static readonly MAX_LIVES = 5

  // Difficulty rotation pattern: Easy, Easy, Medium, Easy, Hard, Easy (repeat)
  private static readonly DIFFICULTY_PATTERN: Difficulty[] = [
    'easy', 'easy', 'medium', 'easy', 'hard', 'easy'
  ]

  private static readonly DIFFICULTY_MOVES = {
    easy: 40,
    medium: 30,
    hard: 20
  }

  private static readonly GEM_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'white']

  private static readonly POWER_UP_TYPES = [
    { id: 'horizontal-rocket', name: 'Horizontal Rocket' },
    { id: 'vertical-rocket', name: 'Vertical Rocket' },
    { id: 'tnt', name: 'TNT' },
    { id: 'light-ball', name: 'Color Bomb' }
  ]

  /**
   * Get current level number (1-indexed)
   */
  static getCurrentLevel(): number {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    return stored ? parseInt(stored, 10) : 1
  }

  /**
   * Save current level
   */
  static setCurrentLevel(level: number): void {
    localStorage.setItem(this.STORAGE_KEY, level.toString())
  }

  /**
   * Advance to next level
   */
  static advanceLevel(): number {
    const currentLevel = this.getCurrentLevel()
    const nextLevel = currentLevel + 1
    this.setCurrentLevel(nextLevel)
    return nextLevel
  }

  /**
   * Get difficulty for a given level
   */
  static getDifficultyForLevel(level: number): Difficulty {
    // Use modulo to cycle through the pattern
    const patternIndex = (level - 1) % this.DIFFICULTY_PATTERN.length
    return this.DIFFICULTY_PATTERN[patternIndex]
  }

  /**
   * Get number of moves for a difficulty level
   */
  static getMovesForDifficulty(difficulty: Difficulty): number {
    return this.DIFFICULTY_MOVES[difficulty]
  }

  /**
   * Generate a challenge based on difficulty
   */
  static generateChallenge(difficulty: Difficulty): Challenge {
    // Choose challenge type based on difficulty
    const challengeTypes: ChallengeType[] = ['color-match', 'score-target', 'power-up-create']
    const randomType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)]

    switch (randomType) {
      case 'color-match':
        return this.generateColorMatchChallenge(difficulty)
      case 'score-target':
        return this.generateScoreTargetChallenge(difficulty)
      case 'power-up-create':
        return this.generatePowerUpCreateChallenge(difficulty)
      default:
        return this.generateScoreTargetChallenge(difficulty)
    }
  }

  /**
   * Generate a color-match challenge
   */
  private static generateColorMatchChallenge(difficulty: Difficulty): Challenge {
    const color = this.GEM_COLORS[Math.floor(Math.random() * this.GEM_COLORS.length)]
    let targetValue: number

    switch (difficulty) {
      case 'easy':
        targetValue = 15
        break
      case 'medium':
        targetValue = 25
        break
      case 'hard':
        targetValue = 35
        break
    }

    return {
      type: 'color-match',
      description: `Match ${targetValue} ${color} gems`,
      targetValue,
      currentValue: 0,
      color
    }
  }

  /**
   * Generate a score-target challenge
   */
  private static generateScoreTargetChallenge(difficulty: Difficulty): Challenge {
    let targetValue: number

    switch (difficulty) {
      case 'easy':
        targetValue = 3000
        break
      case 'medium':
        targetValue = 6000
        break
      case 'hard':
        targetValue = 10000
        break
    }

    return {
      type: 'score-target',
      description: `Reach ${targetValue} points`,
      targetValue,
      currentValue: 0
    }
  }

  /**
   * Generate a power-up creation challenge
   */
  private static generatePowerUpCreateChallenge(difficulty: Difficulty): Challenge {
    const powerUp = this.POWER_UP_TYPES[Math.floor(Math.random() * this.POWER_UP_TYPES.length)]
    let targetValue: number

    switch (difficulty) {
      case 'easy':
        targetValue = 2
        break
      case 'medium':
        targetValue = 3
        break
      case 'hard':
        targetValue = 5
        break
    }

    return {
      type: 'power-up-create',
      description: `Create ${targetValue} ${powerUp.name}${targetValue > 1 ? 's' : ''}`,
      targetValue,
      currentValue: 0,
      powerUpType: powerUp.id
    }
  }

  /**
   * Get complete configuration for a level
   */
  static getLevelConfig(level: number): LevelConfig {
    const difficulty = this.getDifficultyForLevel(level)
    const moves = this.getMovesForDifficulty(difficulty)
    const challenge = this.generateChallenge(difficulty)

    return {
      level,
      difficulty,
      moves,
      challenge
    }
  }

  /**
   * Get configuration for current level
   */
  static getCurrentLevelConfig(): LevelConfig {
    return this.getLevelConfig(this.getCurrentLevel())
  }

  /**
   * Check if challenge is complete
   */
  static isChallengeComplete(challenge: Challenge): boolean {
    return challenge.currentValue >= challenge.targetValue
  }

  /**
   * Update challenge progress
   */
  static updateChallengeProgress(challenge: Challenge, increment: number): Challenge {
    return {
      ...challenge,
      currentValue: Math.min(challenge.currentValue + increment, challenge.targetValue)
    }
  }

  /**
   * Reset to level 1 (for testing or new game+)
   */
  static reset(): void {
    this.setCurrentLevel(1)
    this.resetLives()
  }

  /**
   * Get current lives
   */
  static getLives(): number {
    const stored = localStorage.getItem(this.LIVES_KEY)
    return stored ? parseInt(stored, 10) : this.MAX_LIVES
  }

  /**
   * Set lives
   */
  static setLives(lives: number): void {
    localStorage.setItem(this.LIVES_KEY, lives.toString())
  }

  /**
   * Decrement lives by 1
   */
  static decrementLives(): number {
    const currentLives = this.getLives()
    const newLives = Math.max(0, currentLives - 1)
    this.setLives(newLives)
    return newLives
  }

  /**
   * Reset lives to max
   */
  static resetLives(): void {
    this.setLives(this.MAX_LIVES)
  }

  /**
   * Check if player has lives remaining
   */
  static hasLivesRemaining(): boolean {
    return this.getLives() > 0
  }
}
