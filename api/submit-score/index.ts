import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { ScoreSubmission, ScoreEntity } from '../shared/types'
import { validateScoreSubmission, hashIP, sanitizePlayerName } from '../shared/validation'
import { checkRateLimit } from '../shared/rateLimit'
import { saveScore, getRecentSubmissionsForIP } from '../shared/storage'

export async function submitScore(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Score submission received')

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

    // Check rate limit
    const rateLimit = checkRateLimit(ipHash, { maxRequests: 10, windowMs: 60 * 60 * 1000 })
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
    const body = await request.json() as ScoreSubmission

    // Log submission details for debugging
    context.log('Submission details:', {
      playerName: body.playerName,
      score: body.score,
      moves: body.moves,
      duration: body.duration,
      sessionHashLength: body.sessionHash?.length,
      gameVersion: body.gameVersion
    })

    // Validate submission
    const validation = validateScoreSubmission(body)
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

    // Additional check: limit submissions per IP in last 24 hours
    const recentSubmissions = await getRecentSubmissionsForIP(ipHash, 24)
    if (recentSubmissions >= 50) { // Max 50 submissions per day
      return {
        status: 429,
        headers,
        jsonBody: {
          error: 'Daily submission limit reached. Try again tomorrow.'
        }
      }
    }

    // Create score entity
    const now = new Date()
    const partitionKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const rowKey = `${now.getTime()}-${Math.random().toString(36).substring(7)}`

    const scoreEntity: ScoreEntity = {
      partitionKey,
      rowKey,
      playerName: sanitizePlayerName(body.playerName),
      score: body.score,
      moves: body.moves,
      duration: body.duration,
      sessionHash: body.sessionHash,
      gameVersion: body.gameVersion || '1.0.0',
      ipHash,
      timestamp: now
    }

    // Save to storage
    await saveScore(scoreEntity)

    context.log(`Score saved: ${scoreEntity.playerName} - ${scoreEntity.score}`)

    return {
      status: 201,
      headers,
      jsonBody: {
        success: true,
        message: 'Score submitted successfully',
        score: scoreEntity.score,
        rank: null // Could calculate rank here if needed
      }
    }

  } catch (error: any) {
    context.error('Error submitting score:', error)

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

app.http('submit-score', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: submitScore
})
