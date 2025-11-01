/**
 * Local storage manager for personal best scores
 */

export interface PersonalBest {
  score: number
  moves: number
  duration: number
  playerName: string
  timestamp: Date
}

export class LocalScores {
  private static readonly STORAGE_KEY = 'bejeweled_personal_best'
  private static readonly PLAYER_NAME_KEY = 'bejeweled_player_name'
  private static readonly SCORES_HISTORY_KEY = 'bejeweled_scores_history'
  private static readonly MAX_HISTORY = 10

  /**
   * Get the personal best score
   */
  static getPersonalBest(): PersonalBest | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (!data) return null

      const pb = JSON.parse(data)
      pb.timestamp = new Date(pb.timestamp)
      return pb
    } catch (error) {
      console.error('Error reading personal best:', error)
      return null
    }
  }

  /**
   * Save a new personal best if score is higher
   */
  static saveIfPersonalBest(score: number, moves: number, duration: number, playerName: string): boolean {
    const current = this.getPersonalBest()

    if (!current || score > current.score) {
      const newBest: PersonalBest = {
        score,
        moves,
        duration,
        playerName,
        timestamp: new Date()
      }

      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newBest))
        this.savePlayerName(playerName)
        this.addToHistory(score, moves, duration, playerName)
        return true
      } catch (error) {
        console.error('Error saving personal best:', error)
        return false
      }
    }

    // Still save to history even if not personal best
    this.addToHistory(score, moves, duration, playerName)
    return false
  }

  /**
   * Get the last used player name
   */
  static getLastPlayerName(): string | null {
    try {
      return localStorage.getItem(this.PLAYER_NAME_KEY)
    } catch (error) {
      console.error('Error reading player name:', error)
      return null
    }
  }

  /**
   * Save player name for next time
   */
  static savePlayerName(name: string): void {
    try {
      localStorage.setItem(this.PLAYER_NAME_KEY, name)
    } catch (error) {
      console.error('Error saving player name:', error)
    }
  }

  /**
   * Get score history (last 10 games)
   */
  static getScoreHistory(): PersonalBest[] {
    try {
      const data = localStorage.getItem(this.SCORES_HISTORY_KEY)
      if (!data) return []

      const history = JSON.parse(data)
      return history.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }))
    } catch (error) {
      console.error('Error reading score history:', error)
      return []
    }
  }

  /**
   * Add a score to history (keeps last 10)
   */
  static addToHistory(score: number, moves: number, duration: number, playerName: string): void {
    try {
      const history = this.getScoreHistory()
      history.unshift({
        score,
        moves,
        duration,
        playerName,
        timestamp: new Date()
      })

      // Keep only last MAX_HISTORY scores
      const trimmed = history.slice(0, this.MAX_HISTORY)

      localStorage.setItem(this.SCORES_HISTORY_KEY, JSON.stringify(trimmed))
    } catch (error) {
      console.error('Error saving to history:', error)
    }
  }

  /**
   * Clear all local data
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      localStorage.removeItem(this.PLAYER_NAME_KEY)
      localStorage.removeItem(this.SCORES_HISTORY_KEY)
    } catch (error) {
      console.error('Error clearing local data:', error)
    }
  }

  /**
   * Get statistics
   */
  static getStats(): {
    totalGames: number
    averageScore: number
    bestScore: number
    totalMoves: number
    totalTime: number
  } {
    const history = this.getScoreHistory()
    const pb = this.getPersonalBest()

    if (history.length === 0) {
      return {
        totalGames: 0,
        averageScore: 0,
        bestScore: pb?.score || 0,
        totalMoves: 0,
        totalTime: 0
      }
    }

    const totalScore = history.reduce((sum, entry) => sum + entry.score, 0)
    const totalMoves = history.reduce((sum, entry) => sum + entry.moves, 0)
    const totalTime = history.reduce((sum, entry) => sum + entry.duration, 0)

    return {
      totalGames: history.length,
      averageScore: Math.floor(totalScore / history.length),
      bestScore: pb?.score || 0,
      totalMoves,
      totalTime
    }
  }
}
