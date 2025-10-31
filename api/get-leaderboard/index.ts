import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTopScores } from '../shared/storage'

export async function getLeaderboard(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Leaderboard request received')

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60' // Cache for 1 minute
  }

  // Handle OPTIONS for CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers
    }
  }

  try {
    // Get limit from query parameter (default 100, max 1000)
    const limitParam = request.query.get('limit')
    let limit = 100

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 1000) {
        limit = parsedLimit
      }
    }

    // Get top scores
    const leaderboard = await getTopScores(limit)

    context.log(`Returning ${leaderboard.length} scores`)

    return {
      status: 200,
      headers,
      jsonBody: {
        success: true,
        count: leaderboard.length,
        leaderboard
      }
    }

  } catch (error: any) {
    context.error('Error getting leaderboard:', error)

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

app.http('get-leaderboard', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getLeaderboard
})
