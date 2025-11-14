import { ScoreSubmission, ValidationResult, LevelAttemptSubmission } from './types'
import * as crypto from 'crypto'

// Game constants for validation
const MAX_SCORE = 1000000
const MIN_SCORE = 0
const MAX_MOVES = 10000
const MIN_MOVES = 1
const MIN_DURATION = 10 // seconds - minimum realistic game time
const MAX_DURATION = 7200 // 2 hours
const MIN_POINTS_PER_MOVE = 10
const MAX_POINTS_PER_MOVE = 5000 // with combos and power-ups
const PLAYER_NAME_MAX_LENGTH = 20
const PLAYER_NAME_MIN_LENGTH = 1

export function validateScoreSubmission(submission: ScoreSubmission): ValidationResult {
  // Validate player name
  if (!submission.playerName || typeof submission.playerName !== 'string') {
    return { valid: false, reason: 'Invalid player name' }
  }

  const trimmedName = submission.playerName.trim()
  if (trimmedName.length < PLAYER_NAME_MIN_LENGTH || trimmedName.length > PLAYER_NAME_MAX_LENGTH) {
    return { valid: false, reason: `Player name must be ${PLAYER_NAME_MIN_LENGTH}-${PLAYER_NAME_MAX_LENGTH} characters` }
  }

  // Check for profanity/spam patterns (basic check)
  if (/^\s*$|^(.)\1{5,}/.test(trimmedName)) {
    return { valid: false, reason: 'Invalid player name format' }
  }

  // Validate score range
  if (typeof submission.score !== 'number' || submission.score < MIN_SCORE || submission.score > MAX_SCORE) {
    return { valid: false, reason: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}` }
  }

  // Validate moves (relax minimum for local testing)
  const minMoves = process.env.NODE_ENV === 'development' ? 0 : MIN_MOVES
  if (typeof submission.moves !== 'number' || submission.moves < minMoves || submission.moves > MAX_MOVES) {
    return { valid: false, reason: `Moves must be between ${minMoves} and ${MAX_MOVES}` }
  }

  // Validate duration (relax minimum for local testing)
  const minDuration = process.env.NODE_ENV === 'development' ? 0 : MIN_DURATION
  if (typeof submission.duration !== 'number' || submission.duration < minDuration || submission.duration > MAX_DURATION) {
    return { valid: false, reason: 'Invalid game duration' }
  }

  // Validate score/move ratio (basic anti-cheat)
  // Skip this check if moves is 0 (test scenarios in development)
  if (submission.moves > 0) {
    const pointsPerMove = submission.score / submission.moves
    if (pointsPerMove < MIN_POINTS_PER_MOVE || pointsPerMove > MAX_POINTS_PER_MOVE) {
      return { valid: false, reason: 'Score/move ratio is suspicious' }
    }
  }

  // Validate score/time ratio (must take some time to score points)
  // Skip this check for very short durations in development
  if (submission.duration > 0) {
    const pointsPerSecond = submission.score / submission.duration
    if (pointsPerSecond > 1000) { // Max 1000 points per second
      return { valid: false, reason: 'Score/time ratio is suspicious' }
    }
  }

  // Validate session hash
  if (!submission.sessionHash || typeof submission.sessionHash !== 'string' || submission.sessionHash.length < 32) {
    return { valid: false, reason: 'Invalid session hash' }
  }

  return { valid: true }
}

export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

export function sanitizePlayerName(name: string): string {
  return name.trim().substring(0, PLAYER_NAME_MAX_LENGTH)
}

export function generateSessionHash(score: number, moves: number, duration: number, seed: string): string {
  const data = `${score}:${moves}:${duration}:${seed}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Level Analytics Validation
const MAX_LEVEL = 100
const MIN_LEVEL = 1
const MAX_TARGET_VALUE = 10000
const MAX_POWER_UPS = 1000
const MAX_COMBO_CHAIN = 100

export function validateLevelAttempt(attempt: LevelAttemptSubmission): ValidationResult {
  // Validate level number
  if (typeof attempt.levelNumber !== 'number' || attempt.levelNumber < MIN_LEVEL || attempt.levelNumber > MAX_LEVEL) {
    return { valid: false, reason: `Level number must be between ${MIN_LEVEL} and ${MAX_LEVEL}` }
  }

  // Validate challenge type
  if (attempt.challengeType !== 'color-match' && attempt.challengeType !== 'power-up-create') {
    return { valid: false, reason: 'Invalid challenge type' }
  }

  // Validate target value
  if (typeof attempt.targetValue !== 'number' || attempt.targetValue < 1 || attempt.targetValue > MAX_TARGET_VALUE) {
    return { valid: false, reason: `Target value must be between 1 and ${MAX_TARGET_VALUE}` }
  }

  // Validate success flag
  if (typeof attempt.success !== 'boolean') {
    return { valid: false, reason: 'Success must be a boolean' }
  }

  // Validate moves
  if (typeof attempt.movesTaken !== 'number' || attempt.movesTaken < 0 || attempt.movesTaken > MAX_MOVES) {
    return { valid: false, reason: `Moves taken must be between 0 and ${MAX_MOVES}` }
  }

  if (typeof attempt.movesRemaining !== 'number' || attempt.movesRemaining < 0 || attempt.movesRemaining > MAX_MOVES) {
    return { valid: false, reason: `Moves remaining must be between 0 and ${MAX_MOVES}` }
  }

  // Validate duration (relax minimum for testing)
  const minDuration = process.env.NODE_ENV === 'development' ? 0 : 1
  if (typeof attempt.duration !== 'number' || attempt.duration < minDuration || attempt.duration > MAX_DURATION) {
    return { valid: false, reason: 'Invalid game duration' }
  }

  // Validate progress
  if (typeof attempt.finalProgress !== 'number' || attempt.finalProgress < 0 || attempt.finalProgress > 100) {
    return { valid: false, reason: 'Final progress must be between 0 and 100' }
  }

  // Validate power-ups used
  if (typeof attempt.powerUpsUsed !== 'number' || attempt.powerUpsUsed < 0 || attempt.powerUpsUsed > MAX_POWER_UPS) {
    return { valid: false, reason: `Power-ups used must be between 0 and ${MAX_POWER_UPS}` }
  }

  // Validate combo chain
  if (typeof attempt.comboMaxChain !== 'number' || attempt.comboMaxChain < 0 || attempt.comboMaxChain > MAX_COMBO_CHAIN) {
    return { valid: false, reason: `Combo max chain must be between 0 and ${MAX_COMBO_CHAIN}` }
  }

  // Validate final score
  if (typeof attempt.finalScore !== 'number' || attempt.finalScore < 0 || attempt.finalScore > MAX_SCORE) {
    return { valid: false, reason: `Final score must be between 0 and ${MAX_SCORE}` }
  }

  // Validate game version
  if (!attempt.gameVersion || typeof attempt.gameVersion !== 'string') {
    return { valid: false, reason: 'Invalid game version' }
  }

  // Business logic validation: if success is true, progress should be 100
  if (attempt.success && attempt.finalProgress < 100) {
    return { valid: false, reason: 'Successful attempts must have 100% progress' }
  }

  // Business logic: if failed, moves remaining should be 0
  if (!attempt.success && attempt.movesRemaining > 0) {
    return { valid: false, reason: 'Failed attempts with remaining moves are suspicious' }
  }

  return { valid: true }
}
