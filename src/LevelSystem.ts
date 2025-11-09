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
  gemTypes: string[]  // Allowed gem colors for this level
}

export class LevelSystem {
  private static readonly STORAGE_KEY = 'gem-match-current-level'
  private static readonly LIVES_KEY = 'gem-match-lives'
  private static readonly SCORE_KEY = 'gem-match-cumulative-score'
  private static readonly HAMMERS_KEY = 'gem-match-hammers'
  private static readonly MAX_LIVES = 5

  // Difficulty rotation pattern: Easy, Easy, Medium, Easy, Hard, Easy (repeat)
  private static readonly DIFFICULTY_PATTERN: Difficulty[] = [
    'easy', 'easy', 'medium', 'easy', 'hard', 'easy'
  ]

  private static readonly DIFFICULTY_MOVES = {
    easy: 20,
    medium: 25,
    hard: 30
  }

  private static readonly GEM_COLORS = ['red', 'blue', 'green', 'yellow', 'pink']

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
   * Get gem types allowed for a difficulty level
   * Easy: 4 colors (easier to match)
   * Medium: 5 colors (standard)
   * Hard: 5 colors (standard, but fewer moves)
   */
  static getGemTypesForDifficulty(difficulty: Difficulty): string[] {
    switch (difficulty) {
      case 'easy':
        // Use first 4 colors for easier matching
        return this.GEM_COLORS.slice(0, 4)
      case 'medium':
      case 'hard':
        // Use all 5 colors
        return [...this.GEM_COLORS]
      default:
        return [...this.GEM_COLORS]
    }
  }

  /**
   * Generate a challenge based on difficulty
   * Score is always tracked but is NOT a win condition - only challenges matter
   */
  static generateChallenge(difficulty: Difficulty, gemTypes: string[]): Challenge {
    // Choose between color-match and power-up-create (no score targets)
    const challengeTypes: ChallengeType[] = ['color-match', 'power-up-create']
    const randomType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)]

    switch (randomType) {
      case 'color-match':
        return this.generateColorMatchChallenge(difficulty, gemTypes)
      case 'power-up-create':
        return this.generatePowerUpCreateChallenge(difficulty)
      default:
        return this.generateColorMatchChallenge(difficulty, gemTypes)
    }
  }

  /**
   * Generate a color-match challenge
   * Balanced with move count: Easy=35 gems/20 moves, Medium=50 gems/25 moves, Hard=65 gems/30 moves
   */
  private static generateColorMatchChallenge(difficulty: Difficulty, gemTypes: string[]): Challenge {
    // Pick a color from the available gem types on the board
    const color = gemTypes[Math.floor(Math.random() * gemTypes.length)]
    let targetValue: number

    switch (difficulty) {
      case 'easy':
        targetValue = 35  // 20 moves (1.75 gems/move)
        break
      case 'medium':
        targetValue = 50  // 25 moves (2.0 gems/move)
        break
      case 'hard':
        targetValue = 65  // 30 moves (2.17 gems/move)
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
   * Generate a score-target challenge (REMOVED - score is not a win condition)
   * Score is always tracked for leaderboards but doesn't determine level completion
   */
  // Removed: Score targets are no longer used as challenges

  /**
   * Generate a power-up creation challenge
   * Balanced with move count: Easy=1 powerup/20 moves, Medium=2 powerups/25 moves, Hard=3 powerups/30 moves
   * Note: Creating powerups is very difficult, especially Color Bombs (5 in a row)
   */
  private static generatePowerUpCreateChallenge(difficulty: Difficulty): Challenge {
    const powerUp = this.POWER_UP_TYPES[Math.floor(Math.random() * this.POWER_UP_TYPES.length)]
    let targetValue: number

    switch (difficulty) {
      case 'easy':
        targetValue = 1  // 20 moves
        break
      case 'medium':
        targetValue = 2  // 25 moves
        break
      case 'hard':
        targetValue = 3  // 30 moves
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
    const gemTypes = this.getGemTypesForDifficulty(difficulty)
    const challenge = this.generateChallenge(difficulty, gemTypes)

    return {
      level,
      difficulty,
      moves,
      challenge,
      gemTypes
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
    this.resetScore()
    this.resetHammers()
  }

  /**
   * Get cumulative score across all levels
   */
  static getScore(): number {
    const stored = localStorage.getItem(this.SCORE_KEY)
    return stored ? parseInt(stored, 10) : 0
  }

  /**
   * Set cumulative score
   */
  static setScore(score: number): void {
    localStorage.setItem(this.SCORE_KEY, score.toString())
  }

  /**
   * Add to cumulative score
   */
  static addScore(points: number): number {
    const currentScore = this.getScore()
    const newScore = currentScore + points
    this.setScore(newScore)
    return newScore
  }

  /**
   * Reset score to 0 (only on new game)
   */
  static resetScore(): void {
    this.setScore(0)
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

  /**
   * Get current hammers
   */
  static getHammers(): number {
    const stored = localStorage.getItem(this.HAMMERS_KEY)
    return stored ? parseInt(stored, 10) : 0
  }

  /**
   * Set hammers
   */
  static setHammers(hammers: number): void {
    localStorage.setItem(this.HAMMERS_KEY, hammers.toString())
  }

  /**
   * Add hammers (earned from level completion)
   */
  static addHammers(count: number): number {
    const currentHammers = this.getHammers()
    const newHammers = currentHammers + count
    this.setHammers(newHammers)
    return newHammers
  }

  /**
   * Use a hammer (returns false if none available)
   */
  static useHammer(): boolean {
    const currentHammers = this.getHammers()
    if (currentHammers > 0) {
      this.setHammers(currentHammers - 1)
      return true
    }
    return false
  }

  /**
   * Reset hammers to 0
   */
  static resetHammers(): void {
    this.setHammers(0)
  }
}
