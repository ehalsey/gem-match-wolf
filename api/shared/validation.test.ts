import { validateLevelAttempt, validateScoreSubmission } from './validation'
import { LevelAttemptSubmission, ScoreSubmission } from './types'

describe('validateLevelAttempt', () => {
  // Helper to create valid level attempt
  const createValidAttempt = (): LevelAttemptSubmission => ({
    levelNumber: 1,
    challengeType: 'color-match',
    challengeTarget: 'blue',
    targetValue: 50,
    success: true,
    movesTaken: 20,
    movesRemaining: 10,
    duration: 120,
    finalProgress: 100,
    powerUpsUsed: 3,
    comboMaxChain: 5,
    finalScore: 1500,
    gameVersion: '1.0.0'
  })

  describe('Valid Attempts', () => {
    it('should validate a successful color-match attempt', () => {
      const attempt = createValidAttempt()
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should validate a failed power-up-create attempt', () => {
      const attempt: LevelAttemptSubmission = {
        ...createValidAttempt(),
        challengeType: 'power-up-create',
        challengeTarget: 'horizontal-rocket',
        success: false,
        movesRemaining: 0,
        finalProgress: 60
      }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })

    it('should validate attempt with 0 duration in development', () => {
      process.env.NODE_ENV = 'development'
      const attempt = { ...createValidAttempt(), duration: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
      delete process.env.NODE_ENV
    })
  })

  describe('Level Number Validation', () => {
    it('should reject level number below minimum', () => {
      const attempt = { ...createValidAttempt(), levelNumber: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Level number must be between')
    })

    it('should reject level number above maximum', () => {
      const attempt = { ...createValidAttempt(), levelNumber: 101 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Level number must be between')
    })

    it('should accept level 1', () => {
      const attempt = { ...createValidAttempt(), levelNumber: 1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })

    it('should accept level 100', () => {
      const attempt = { ...createValidAttempt(), levelNumber: 100 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })

  describe('Challenge Type Validation', () => {
    it('should accept color-match challenge', () => {
      const attempt = { ...createValidAttempt(), challengeType: 'color-match' as const }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })

    it('should accept power-up-create challenge', () => {
      const attempt = { ...createValidAttempt(), challengeType: 'power-up-create' as const }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid challenge type', () => {
      const attempt = { ...createValidAttempt(), challengeType: 'invalid' as any }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Invalid challenge type')
    })
  })

  describe('Target Value Validation', () => {
    it('should reject target value below 1', () => {
      const attempt = { ...createValidAttempt(), targetValue: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Target value must be between')
    })

    it('should reject target value above maximum', () => {
      const attempt = { ...createValidAttempt(), targetValue: 10001 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Target value must be between')
    })
  })

  describe('Success Flag Validation', () => {
    it('should reject non-boolean success value', () => {
      const attempt = { ...createValidAttempt(), success: 'true' as any }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Success must be a boolean')
    })
  })

  describe('Moves Validation', () => {
    it('should reject negative moves taken', () => {
      const attempt = { ...createValidAttempt(), movesTaken: -1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Moves taken must be between')
    })

    it('should reject negative moves remaining', () => {
      const attempt = { ...createValidAttempt(), movesRemaining: -1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Moves remaining must be between')
    })

    it('should accept 0 moves taken', () => {
      const attempt = { ...createValidAttempt(), movesTaken: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })

  describe('Duration Validation', () => {
    it('should reject duration below minimum in production', () => {
      process.env.NODE_ENV = 'production'
      const attempt = { ...createValidAttempt(), duration: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Invalid game duration')
      delete process.env.NODE_ENV
    })

    it('should reject duration above maximum', () => {
      const attempt = { ...createValidAttempt(), duration: 7201 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Invalid game duration')
    })
  })

  describe('Progress Validation', () => {
    it('should reject progress below 0', () => {
      const attempt = { ...createValidAttempt(), finalProgress: -1, success: false, movesRemaining: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Final progress must be between 0 and 100')
    })

    it('should reject progress above 100', () => {
      const attempt = { ...createValidAttempt(), finalProgress: 101 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Final progress must be between 0 and 100')
    })

    it('should accept 0 progress', () => {
      const attempt = { ...createValidAttempt(), finalProgress: 0, success: false, movesRemaining: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })

    it('should accept 100 progress', () => {
      const attempt = { ...createValidAttempt(), finalProgress: 100 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })

  describe('Power-ups and Combo Validation', () => {
    it('should reject negative power-ups used', () => {
      const attempt = { ...createValidAttempt(), powerUpsUsed: -1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Power-ups used must be between')
    })

    it('should reject negative combo chain', () => {
      const attempt = { ...createValidAttempt(), comboMaxChain: -1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Combo max chain must be between')
    })

    it('should accept 0 power-ups and combos', () => {
      const attempt = { ...createValidAttempt(), powerUpsUsed: 0, comboMaxChain: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })

  describe('Final Score Validation', () => {
    it('should reject negative final score', () => {
      const attempt = { ...createValidAttempt(), finalScore: -1 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Final score must be between')
    })

    it('should reject score above maximum', () => {
      const attempt = { ...createValidAttempt(), finalScore: 1000001 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Final score must be between')
    })

    it('should accept 0 score', () => {
      const attempt = { ...createValidAttempt(), finalScore: 0, success: false, movesRemaining: 0, finalProgress: 0 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })

  describe('Game Version Validation', () => {
    it('should reject missing game version', () => {
      const attempt = { ...createValidAttempt(), gameVersion: '' }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Invalid game version')
    })

    it('should reject non-string game version', () => {
      const attempt = { ...createValidAttempt(), gameVersion: 1.0 as any }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Invalid game version')
    })
  })

  describe('Business Logic Validation', () => {
    it('should reject successful attempt with progress < 100', () => {
      const attempt = { ...createValidAttempt(), success: true, finalProgress: 99 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Successful attempts must have 100% progress')
    })

    it('should reject failed attempt with remaining moves', () => {
      const attempt = { ...createValidAttempt(), success: false, movesRemaining: 5, finalProgress: 80 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Failed attempts with remaining moves are suspicious')
    })

    it('should accept failed attempt with 0 moves remaining', () => {
      const attempt = { ...createValidAttempt(), success: false, movesRemaining: 0, finalProgress: 60 }
      const result = validateLevelAttempt(attempt)
      expect(result.valid).toBe(true)
    })
  })
})

describe('validateScoreSubmission', () => {
  const createValidScore = (): ScoreSubmission => ({
    playerName: 'TestPlayer',
    score: 10000,
    moves: 50,
    duration: 180,
    sessionHash: 'a'.repeat(32),
    gameVersion: '1.0.0'
  })

  it('should validate a valid score submission', () => {
    const score = createValidScore()
    const result = validateScoreSubmission(score)
    expect(result.valid).toBe(true)
  })

  it('should reject player name that is too short', () => {
    const score = { ...createValidScore(), playerName: '' }
    const result = validateScoreSubmission(score)
    expect(result.valid).toBe(false)
  })

  it('should reject player name that is too long', () => {
    const score = { ...createValidScore(), playerName: 'a'.repeat(21) }
    const result = validateScoreSubmission(score)
    expect(result.valid).toBe(false)
  })

  it('should reject session hash that is too short', () => {
    const score = { ...createValidScore(), sessionHash: 'short' }
    const result = validateScoreSubmission(score)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid session hash')
  })
})
