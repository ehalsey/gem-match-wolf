/**
 * Service for managing score storage and leaderboard data
 */

export interface LeaderboardEntry {
  name: string
  score: number
  rank?: number
}

export class ScoreStorageService {
  private static readonly PERSONAL_BEST_KEY = 'gem-match-personal-best'
  private static readonly MOCK_LEADERBOARD_KEY = 'gem-match-leaderboard'

  /**
   * Get the player's personal best score
   */
  static getPersonalBest(): number {
    const stored = localStorage.getItem(this.PERSONAL_BEST_KEY)
    return stored ? parseInt(stored, 10) : 0
  }

  /**
   * Update personal best if current score is higher
   */
  static updatePersonalBest(score: number): boolean {
    const currentBest = this.getPersonalBest()
    if (score > currentBest) {
      localStorage.setItem(this.PERSONAL_BEST_KEY, score.toString())
      return true
    }
    return false
  }

  /**
   * Get the leaderboard entries (mock data with some randomization)
   */
  static getLeaderboard(): LeaderboardEntry[] {
    const stored = localStorage.getItem(this.MOCK_LEADERBOARD_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return parsed.map((entry: LeaderboardEntry, index: number) => ({
          ...entry,
          rank: index + 1
        }))
      } catch {
        // If parsing fails, regenerate
      }
    }
    
    // Generate initial mock leaderboard
    return this.generateMockLeaderboard()
  }

  /**
   * Generate mock leaderboard data with realistic scores
   */
  private static generateMockLeaderboard(): LeaderboardEntry[] {
    const names = [
      'GemMaster',
      'CascadeKing',
      'MatchQueen',
      'PuzzleProA',
      'ColorCombo',
      'RocketRider',
      'DiamondDave',
      'RubyRose',
      'ScoreStar',
      'ComboChamp'
    ]

    // Generate scores between 500 and 15000, sorted descending
    const leaderboard = names.map((name, index) => ({
      name,
      score: Math.floor(15000 - (index * 1200) - Math.random() * 500),
      rank: index + 1
    }))

    // Save to localStorage
    localStorage.setItem(this.MOCK_LEADERBOARD_KEY, JSON.stringify(leaderboard))
    
    return leaderboard
  }

  /**
   * Get player's current rank based on score
   */
  static getPlayerRank(currentScore: number): number {
    const leaderboard = this.getLeaderboard()
    let rank = 1
    for (const entry of leaderboard) {
      if (currentScore > entry.score) {
        return rank
      }
      rank++
    }
    return rank // Player is after all leaderboard entries
  }

  /**
   * Get nearby leaderboard entries (3 above and 3 below player's current position)
   */
  static getNearbyScores(currentScore: number): LeaderboardEntry[] {
    const leaderboard = this.getLeaderboard()
    const playerRank = this.getPlayerRank(currentScore)
    
    // Get 3 entries above and 3 below
    const startIndex = Math.max(0, playerRank - 4)
    const endIndex = Math.min(leaderboard.length, playerRank + 2)
    
    return leaderboard.slice(startIndex, endIndex)
  }

  /**
   * Get the next higher score target (for progress bar)
   */
  static getNextTarget(currentScore: number): LeaderboardEntry | null {
    const leaderboard = this.getLeaderboard()
    for (const entry of leaderboard) {
      if (entry.score > currentScore) {
        return entry
      }
    }
    return null // Player is #1
  }

  /**
   * Check if player has passed someone since last check
   */
  static checkMilestone(previousScore: number, currentScore: number): LeaderboardEntry | null {
    const leaderboard = this.getLeaderboard()
    
    for (const entry of leaderboard) {
      // If current score passed this entry but previous didn't
      if (currentScore > entry.score && previousScore <= entry.score) {
        return entry
      }
    }
    
    return null
  }
}
