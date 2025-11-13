import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { LevelAttemptSubmission, LevelAttemptEntity } from '../shared/types'
import { validateLevelAttempt, hashIP } from '../shared/validation'
import { checkRateLimit } from '../shared/rateLimit'
import { saveLevelAttempt, getRecentLevelAttemptsForIP } from '../shared/storage'

export async function trackLevel(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Level attempt tracking received')

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  // Handle OPTIONS for CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers
    }
  }

  try {
    // Get client IP
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const ipHash = hashIP(clientIP)

    // Check rate limit (100 requests per hour)
    const rateLimit = checkRateLimit(ipHash, { maxRequests: 100, windowMs: 60 * 60 * 1000 })
    if (!rateLimit.allowed) {
      return {
        status: 429,
        headers,
        jsonBody: {
          error: 'Too many requests. Please try again later.',
          resetTime: new Date(rateLimit.resetTime).toISOString()
        }
      }
    }

    // Parse request body
    const body = await request.json() as LevelAttemptSubmission

    // Log attempt details for debugging
    context.log('Level attempt details:', {
      levelNumber: body.levelNumber,
      challengeType: body.challengeType,
      success: body.success,
      duration: body.duration,
      gameVersion: body.gameVersion
    })

    // Validate submission
    const validation = validateLevelAttempt(body)
    if (!validation.valid) {
      context.error('Validation failed:', validation.reason)
      return {
        status: 400,
        headers,
        jsonBody: {
          error: validation.reason
        }
      }
    }

    // Additional check: limit attempts per IP in last hour
    const recentAttempts = await getRecentLevelAttemptsForIP(ipHash, 1)
    if (recentAttempts >= 100) {
      return {
        status: 429,
        headers,
        jsonBody: {
          error: 'Hourly submission limit reached. Try again later.'
        }
      }
    }

    // Create level attempt entity
    const now = new Date()
    const partitionKey = `level-${body.levelNumber}`
    const rowKey = `${now.getTime()}-${Math.random().toString(36).substring(7)}`

    const attemptEntity: LevelAttemptEntity = {
      ...body,
      partitionKey,
      rowKey,
      ipHash,
      timestamp: now
    }

    // Save to storage
    await saveLevelAttempt(attemptEntity)

    context.log(`Level attempt saved: Level ${attemptEntity.levelNumber} - ${attemptEntity.success ? 'Success' : 'Failed'}`)

    return {
      status: 201,
      headers,
      jsonBody: {
        success: true,
        message: 'Level attempt tracked'
      }
    }

  } catch (error: any) {
    context.error('Error tracking level attempt:', error)

    return {
      status: 500,
      headers,
      jsonBody: {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }
  }
}

app.http('track-level', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: trackLevel
})
