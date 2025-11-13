/**
 * Integration tests for Azure Functions with local Azurite storage
 *
 * Prerequisites:
 * 1. Start Azurite: npm run storage (in separate terminal)
 * 2. Start Azure Functions: npm run start (in separate terminal)
 * 3. Run tests: npm run test:integration
 */

import { LevelAttemptSubmission } from './types'

const API_BASE_URL = 'http://localhost:7071/api'

describe('Track Level Integration Tests', () => {
  // Helper to make API calls
  async function trackLevel(attempt: LevelAttemptSubmission) {
    const response = await fetch(`${API_BASE_URL}/track-level`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attempt),
    })

    return {
      status: response.status,
      data: await response.json(),
    }
  }

  const validAttempt: LevelAttemptSubmission = {
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
    gameVersion: '1.0.0',
  }

  // Skip these tests by default - require local services running
  describe.skip('Local Backend Integration', () => {
    beforeAll(() => {
      console.log('⚠️  Make sure Azurite and Azure Functions are running:')
      console.log('   Terminal 1: cd api && npm run storage')
      console.log('   Terminal 2: cd api && npm start')
    })

    it('should accept valid level attempt', async () => {
      const result = await trackLevel(validAttempt)

      expect(result.status).toBe(201)
      expect(result.data.success).toBe(true)
      expect(result.data.message).toBe('Level attempt tracked')
    }, 10000)

    it('should reject invalid level attempt', async () => {
      const invalidAttempt = {
        ...validAttempt,
        levelNumber: 999, // Invalid
      }

      const result = await trackLevel(invalidAttempt)

      expect(result.status).toBe(400)
      expect(result.data.error).toContain('Level number')
    }, 10000)

    it('should reject attempt with missing fields', async () => {
      const incomplete = {
        levelNumber: 1,
        success: true,
        // Missing required fields
      } as any

      const result = await trackLevel(incomplete)

      expect(result.status).toBe(400)
    }, 10000)

    it('should handle failed level attempt', async () => {
      const failedAttempt: LevelAttemptSubmission = {
        ...validAttempt,
        success: false,
        movesRemaining: 0,
        finalProgress: 60,
      }

      const result = await trackLevel(failedAttempt)

      expect(result.status).toBe(201)
      expect(result.data.success).toBe(true)
    }, 10000)

    it('should enforce rate limiting', async () => {
      // Make 101 requests rapidly (rate limit is 100/hour)
      const requests = Array.from({ length: 101 }, () =>
        trackLevel(validAttempt)
      )

      const results = await Promise.all(requests)

      // Some requests should be rate limited
      const rateLimited = results.filter((r) => r.status === 429)
      expect(rateLimited.length).toBeGreaterThan(0)
    }, 30000)

    it('should validate business logic: success requires 100% progress', async () => {
      const invalidLogic: LevelAttemptSubmission = {
        ...validAttempt,
        success: true,
        finalProgress: 50, // Should be 100 for success
      }

      const result = await trackLevel(invalidLogic)

      expect(result.status).toBe(400)
      expect(result.data.error).toContain('100% progress')
    }, 10000)

    it('should validate business logic: failed with remaining moves', async () => {
      const invalidLogic: LevelAttemptSubmission = {
        ...validAttempt,
        success: false,
        movesRemaining: 5, // Should be 0 if failed
        finalProgress: 50,
      }

      const result = await trackLevel(invalidLogic)

      expect(result.status).toBe(400)
      expect(result.data.error).toContain('remaining moves')
    }, 10000)
  })

  describe('Backend Not Running (Expected Failures)', () => {
    it('should fail gracefully when backend is not available', async () => {
      try {
        await trackLevel(validAttempt)
        fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('fetch')
      }
    })
  })
})
