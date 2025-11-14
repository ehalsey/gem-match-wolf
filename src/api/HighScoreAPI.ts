/**
 * API client for high score submission and leaderboard retrieval
 */

export interface ScoreSubmission {
  playerName: string
  score: number
  moves: number
  duration: number
  sessionHash: string
  gameVersion: string
}

export interface LeaderboardEntry {
  playerName: string
  score: number
  moves: number
  duration: number
  timestamp: string
  rank: number
}

export interface SubmitScoreResponse {
  success: boolean
  message?: string
  error?: string
  score?: number
  rank?: number | null
}

export interface GetLeaderboardResponse {
  success: boolean
  count: number
  leaderboard: LeaderboardEntry[]
  error?: string
}

export interface LevelAttemptSubmission {
  // Level Info
  levelNumber: number
  challengeType: 'color-match' | 'power-up-create'
  challengeTarget?: string
  targetValue: number

  // Attempt Info
  success: boolean
  movesTaken: number
  movesRemaining: number
  duration: number
  finalProgress: number

  // Additional Context
  powerUpsUsed: number
  comboMaxChain: number
  finalScore: number

  // Metadata
  gameVersion: string
  sessionId?: string
}

export interface TrackLevelResponse {
  success: boolean
  message?: string
  error?: string
}

export class HighScoreAPI {
  private baseUrl: string

  constructor() {
    // In production, this will be /api (Azure Static Web Apps auto-routing)
    // In local development with Azure Functions, use localhost:7071
    this.baseUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:7071/api'
      : '/api'
  }

  /**
   * Submit a high score
   */
  async submitScore(submission: ScoreSubmission): Promise<SubmitScoreResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/submit-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submission)
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit score'
        }
      }

      return data

    } catch (error: any) {
      console.error('Error submitting score:', error)
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      }
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 100): Promise<GetLeaderboardResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/get-leaderboard?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          count: 0,
          leaderboard: [],
          error: data.error || 'Failed to fetch leaderboard'
        }
      }

      return data

    } catch (error: any) {
      console.error('Error fetching leaderboard:', error)
      return {
        success: false,
        count: 0,
        leaderboard: [],
        error: 'Network error. Please check your connection.'
      }
    }
  }

  /**
   * Get player's rank by score
   */
  async getPlayerRank(score: number): Promise<number | null> {
    try {
      const response = await this.getLeaderboard(1000)
      if (!response.success) {
        return null
      }

      // Find rank by comparing score
      for (let i = 0; i < response.leaderboard.length; i++) {
        if (score > response.leaderboard[i].score) {
          return i + 1
        }
      }

      // Score is lower than all leaderboard entries
      return response.leaderboard.length + 1

    } catch (error) {
      console.error('Error getting player rank:', error)
      return null
    }
  }

  /**
   * Track a level attempt for analytics
   */
  async trackLevelAttempt(attempt: LevelAttemptSubmission): Promise<TrackLevelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/track-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attempt)
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to track level attempt'
        }
      }

      return data

    } catch (error: any) {
      console.error('Error tracking level attempt:', error)
      return {
        success: false,
        error: 'Network error. Analytics tracking unavailable.'
      }
    }
  }

  /**
   * Queue level attempt for offline tracking
   * Stores attempts in localStorage if network is unavailable
   */
  queueLevelAttempt(attempt: LevelAttemptSubmission): void {
    try {
      const queue = this.getLevelAttemptQueue()
      queue.push(attempt)
      localStorage.setItem('levelAttemptQueue', JSON.stringify(queue))
      console.log(`Level attempt queued (${queue.length} in queue)`)
    } catch (error) {
      console.warn('Failed to queue level attempt:', error)
    }
  }

  /**
   * Get queued level attempts from localStorage
   */
  private getLevelAttemptQueue(): LevelAttemptSubmission[] {
    try {
      const queueJson = localStorage.getItem('levelAttemptQueue')
      return queueJson ? JSON.parse(queueJson) : []
    } catch (error) {
      console.warn('Failed to read level attempt queue:', error)
      return []
    }
  }

  /**
   * Process queued level attempts
   * Call this when network is available again
   */
  async processLevelAttemptQueue(): Promise<void> {
    const queue = this.getLevelAttemptQueue()
    if (queue.length === 0) {
      return
    }

    console.log(`Processing ${queue.length} queued level attempts...`)
    const successfulIndices: number[] = []

    for (let i = 0; i < queue.length; i++) {
      const result = await this.trackLevelAttempt(queue[i])
      if (result.success) {
        successfulIndices.push(i)
      }
    }

    // Remove successfully submitted attempts from queue
    if (successfulIndices.length > 0) {
      const remainingQueue = queue.filter((_, index) => !successfulIndices.includes(index))
      localStorage.setItem('levelAttemptQueue', JSON.stringify(remainingQueue))
      console.log(`Processed ${successfulIndices.length} queued attempts, ${remainingQueue.length} remaining`)
    }
  }
}
