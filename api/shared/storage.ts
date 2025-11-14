import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables'
import { ScoreEntity, LeaderboardEntry, LevelAttemptEntity } from './types'

const TABLE_NAME = 'highscores'
const LEVEL_ATTEMPTS_TABLE = 'levelattempts'

let tableClient: TableClient | null = null

export function getTableClient(): TableClient {
  if (tableClient) {
    return tableClient
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  }

  tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME)
  return tableClient
}

export async function ensureTableExists(): Promise<void> {
  try {
    const client = getTableClient()
    await client.createTable()
  } catch (error: any) {
    // Table already exists - ignore error
    if (error.statusCode !== 409) {
      throw error
    }
  }
}

export async function saveScore(score: ScoreEntity): Promise<void> {
  const client = getTableClient()
  await ensureTableExists()

  await client.createEntity({
    partitionKey: score.partitionKey,
    rowKey: score.rowKey,
    playerName: score.playerName,
    score: score.score,
    moves: score.moves,
    duration: score.duration,
    sessionHash: score.sessionHash,
    gameVersion: score.gameVersion,
    ipHash: score.ipHash,
    timestamp: score.timestamp
  })
}

export async function getTopScores(limit: number = 100): Promise<LeaderboardEntry[]> {
  const client = getTableClient()
  await ensureTableExists()

  const scores: ScoreEntity[] = []

  // Query all scores (in production, you might want to partition by time period)
  const entities = client.listEntities<ScoreEntity>()

  for await (const entity of entities) {
    scores.push({
      partitionKey: entity.partitionKey,
      rowKey: entity.rowKey,
      playerName: entity.playerName,
      score: entity.score,
      moves: entity.moves,
      duration: entity.duration,
      sessionHash: entity.sessionHash,
      gameVersion: entity.gameVersion,
      ipHash: entity.ipHash,
      timestamp: new Date(entity.timestamp)
    })
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  // Take top N and add ranks
  return scores.slice(0, limit).map((score, index) => ({
    playerName: score.playerName,
    score: score.score,
    moves: score.moves,
    duration: score.duration,
    timestamp: score.timestamp,
    rank: index + 1
  }))
}

export async function getRecentSubmissionsForIP(ipHash: string, hours: number = 24): Promise<number> {
  const client = getTableClient()
  await ensureTableExists()

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  let count = 0

  const entities = client.listEntities<ScoreEntity>({
    queryOptions: {
      filter: `ipHash eq '${ipHash}' and timestamp ge datetime'${cutoffTime.toISOString()}'`
    }
  })

  for await (const entity of entities) {
    count++
  }

  return count
}

// Level Analytics Storage Functions
let levelAttemptsClient: TableClient | null = null

export function getLevelAttemptsTableClient(): TableClient {
  if (levelAttemptsClient) {
    return levelAttemptsClient
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  }

  levelAttemptsClient = TableClient.fromConnectionString(connectionString, LEVEL_ATTEMPTS_TABLE)
  return levelAttemptsClient
}

export async function ensureLevelAttemptsTableExists(): Promise<void> {
  try {
    const client = getLevelAttemptsTableClient()
    await client.createTable()
  } catch (error: any) {
    // Table already exists - ignore error
    if (error.statusCode !== 409) {
      throw error
    }
  }
}

export async function saveLevelAttempt(attempt: LevelAttemptEntity): Promise<void> {
  const client = getLevelAttemptsTableClient()
  await ensureLevelAttemptsTableExists()

  await client.createEntity({
    partitionKey: attempt.partitionKey,
    rowKey: attempt.rowKey,
    levelNumber: attempt.levelNumber,
    challengeType: attempt.challengeType,
    challengeTarget: attempt.challengeTarget || '',
    targetValue: attempt.targetValue,
    success: attempt.success,
    movesTaken: attempt.movesTaken,
    movesRemaining: attempt.movesRemaining,
    duration: attempt.duration,
    finalProgress: attempt.finalProgress,
    powerUpsUsed: attempt.powerUpsUsed,
    comboMaxChain: attempt.comboMaxChain,
    finalScore: attempt.finalScore,
    gameVersion: attempt.gameVersion,
    sessionId: attempt.sessionId || '',
    ipHash: attempt.ipHash,
    timestamp: attempt.timestamp
  })
}

export async function getRecentLevelAttemptsForIP(ipHash: string, hours: number = 1): Promise<number> {
  const client = getLevelAttemptsTableClient()
  await ensureLevelAttemptsTableExists()

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  let count = 0

  const entities = client.listEntities<LevelAttemptEntity>({
    queryOptions: {
      filter: `ipHash eq '${ipHash}' and timestamp ge datetime'${cutoffTime.toISOString()}'`
    }
  })

  for await (const entity of entities) {
    count++
  }

  return count
}
