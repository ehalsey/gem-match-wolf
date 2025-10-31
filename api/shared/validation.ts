import { ScoreSubmission, ValidationResult } from './types'
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
