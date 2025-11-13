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

// Level Analytics Types
export interface LevelAttemptSubmission {
  // Level Info
  levelNumber: number
  challengeType: 'color-match' | 'power-up-create'
  challengeTarget?: string // e.g., "blue" or "horizontal-rocket"
  targetValue: number // Required amount to complete

  // Attempt Info
  success: boolean // Did they complete the level?
  movesTaken: number // Moves used
  movesRemaining: number // Moves left (0 if failed)
  duration: number // seconds
  finalProgress: number // How close they got (0-100%)

  // Additional Context
  powerUpsUsed: number // How many power-ups created
  comboMaxChain: number // Highest combo achieved
  finalScore: number // Score at end of level

  // Metadata
  gameVersion: string
  sessionId?: string // Optional: track multi-level sessions
}

export interface LevelAttemptEntity extends LevelAttemptSubmission {
  partitionKey: string // level-{levelNumber}
  rowKey: string // {timestamp}-{randomId}
  ipHash: string
  timestamp: Date
}
