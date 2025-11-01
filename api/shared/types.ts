export interface ScoreSubmission {
  playerName: string
  score: number
  moves: number
  duration: number // seconds
  sessionHash: string
  gameVersion: string
}

export interface LeaderboardEntry {
  playerName: string
  score: number
  moves: number
  duration: number
  timestamp: Date
  rank: number
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

// Table Storage entity
export interface ScoreEntity {
  partitionKey: string // Date in format YYYY-MM
  rowKey: string // Timestamp + random for uniqueness
  playerName: string
  score: number
  moves: number
  duration: number
  sessionHash: string
  gameVersion: string
  ipHash: string
  timestamp: Date
}
