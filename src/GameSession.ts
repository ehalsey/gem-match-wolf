import * as crypto from 'crypto-js'

/**
 * Tracks game session data for high score validation
 */
export class GameSession {
  private startTime: number
  private moves: number
  private score: number
  private seed: string
  private gameVersion: string

  constructor(seed?: string) {
    this.startTime = Date.now()
    this.moves = 0
    this.score = 0
    this.seed = seed || this.generateSeed()
    this.gameVersion = '1.0.0'
  }

  private generateSeed(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15)
  }

  incrementMoves(): void {
    this.moves++
  }

  updateScore(newScore: number): void {
    this.score = newScore
  }

  getDuration(): number {
    return Math.floor((Date.now() - this.startTime) / 1000) // seconds
  }

  getMoves(): number {
    return this.moves
  }

  getScore(): number {
    return this.score
  }

  getSeed(): string {
    return this.seed
  }

  getVersion(): string {
    return this.gameVersion
  }

  /**
   * Generate a hash of the session for validation
   * This is sent to the server to verify the score is legitimate
   */
  generateSessionHash(): string {
    const data = `${this.score}:${this.moves}:${this.getDuration()}:${this.seed}`
    return crypto.SHA256(data).toString()
  }

  /**
   * Get submission data ready to send to API
   */
  getSubmissionData(playerName: string) {
    return {
      playerName,
      score: this.score,
      moves: this.moves,
      duration: this.getDuration(),
      sessionHash: this.generateSessionHash(),
      gameVersion: this.gameVersion
    }
  }

  /**
   * Reset session for new game
   */
  reset(seed?: string): void {
    this.startTime = Date.now()
    this.moves = 0
    this.score = 0
    this.seed = seed || this.generateSeed()
  }
}
