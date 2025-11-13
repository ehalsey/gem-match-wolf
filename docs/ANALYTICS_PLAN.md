# Game Analytics & Level Balancing System

## Problem Statement

Currently, level difficulty is set manually without data-driven insights. We need analytics to:
- Track which levels are too hard or too easy
- Measure player success rates per level
- Optimize difficulty to hit target success rates (60-70% for main levels)
- Understand player behavior and drop-off points
- Make data-driven decisions for level balancing

## Current State

### What We Have ✅
- Azure Table Storage infrastructure
- Azure Functions API (`/api/submit-score`, `/api/get-leaderboard`)
- High score tracking (final scores only)
- Rate limiting and validation

### What We're Missing ❌
- Per-level attempt tracking
- Success/failure metrics
- Player progression data
- Analytics queries and dashboards
- Automated difficulty balancing

## Target Metrics

### Success Rate Goals
- **Tutorial levels (1-5)**: 80-85% success rate
- **Main levels (6-19)**: 60-70% success rate
- **Milestone levels (10, 20, 30, etc.)**: 40-50% success rate
- **Hard/Challenge levels**: 30-40% success rate

### Key Performance Indicators (KPIs)
1. **Success Rate**: % of players who complete a level
2. **Average Attempts**: How many tries before success
3. **Average Moves Used**: Efficiency of successful players
4. **Drop-off Rate**: % who quit/never return after failing
5. **Average Completion Time**: How long successful players take
6. **Progress Delta**: How close failed attempts got (0-100%)

## Proposed Solution

### Architecture Overview

```
┌──────────────┐         ┌──────────────────┐         ┌────────────────┐
│ Game Client  │────────▶│ Azure Functions  │────────▶│ Table Storage  │
│ (Phaser)     │         │ API              │         │                │
└──────────────┘         └──────────────────┘         └────────────────┘
   Track level            Validate & Store             • levelattempts
   attempts               Calculate metrics            • levelstats (cache)
```

### New Data Structures

#### 1. Level Attempt (Individual Tracking)

```typescript
interface LevelAttemptSubmission {
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
```

#### 2. Level Stats (Aggregated/Cached)

```typescript
interface LevelStats {
  levelNumber: number

  // Success Metrics
  totalAttempts: number
  successfulAttempts: number
  successRate: number // %

  // Averages (for successful attempts)
  avgMovesUsed: number
  avgTimeToComplete: number
  avgFinalScore: number

  // Difficulty Indicators
  avgAttemptsToSuccess: number
  dropOffRate: number // % who never returned after failing

  // Distribution
  movesHistogram: { moves: number, count: number }[]

  // Metadata
  lastUpdated: Date
  sampleSize: number
}
```

### Table Storage Schema

#### Table: `levelattempts`
- **Partition Key**: `level-{levelNumber}` (e.g., "level-1", "level-5")
- **Row Key**: `{timestamp}-{randomId}`
- **Entity**: LevelAttemptSubmission + metadata
- **TTL**: Optional - keep last 90 days for active analysis

#### Table: `levelstats` (Cached Aggregates)
- **Partition Key**: `stats`
- **Row Key**: `level-{levelNumber}`
- **Entity**: LevelStats
- **Updated**: Every hour or after N attempts

#### Table: `scores` (Existing - High Scores)
- Keep as-is for leaderboard

## Implementation Phases

### Phase 1: Data Collection (Week 1) 🎯

**Goal**: Start collecting level attempt data

#### Tasks
1. **Create Azure Function**: `POST /api/track-level`
   - Location: `api/track-level/index.ts`
   - Validates level attempt data
   - Stores in `levelattempts` table
   - Rate limited: 100 requests/hour per IP

2. **Update GameScene.ts**
   - Track attempt start time
   - Calculate progress % on level end
   - Call API when level completes (success or failure)
   - Handle both challenge types (color-match, power-up-create)

3. **Add Client API Method**
   - `HighScoreAPI.trackLevelAttempt(attempt)`
   - Error handling and retry logic
   - Queue attempts if offline (localStorage)

4. **Testing**
   - Unit tests for validation
   - E2E test for tracking flow
   - Verify data in Azure Storage Explorer

**Deliverables**:
- ✅ `/api/track-level` endpoint
- ✅ Client-side tracking code
- ✅ Data flowing to Azure
- ✅ Tests passing

**Time Estimate**: 2-3 days

---

### Phase 2: Analytics Queries (Week 2) 📊

**Goal**: Create APIs to query and analyze collected data

#### Tasks
1. **Create Analytics Functions**
   - `GET /api/analytics/level/{levelNumber}` - Stats for one level
   - `GET /api/analytics/summary` - Stats for all levels
   - `GET /api/analytics/difficulty` - Levels needing adjustment

2. **Implement Aggregation Logic**
   - Calculate success rates
   - Compute averages (moves, time, score)
   - Identify outliers (too hard/easy)
   - Cache results in `levelstats` table

3. **Add Debug Commands**
   - `gameDebug.getLevelStats(levelNumber)` - Show stats in console
   - `gameDebug.getAllStats()` - Summary of all levels
   - `gameDebug.suggestBalancing()` - Which levels need adjustment

4. **Testing**
   - Seed test data (100+ attempts per level)
   - Verify calculations are accurate
   - Test caching and performance

**Deliverables**:
- ✅ Analytics API endpoints
- ✅ Cached aggregate stats
- ✅ Debug console commands
- ✅ Documentation for APIs

**Time Estimate**: 3-4 days

---

### Phase 3: Balancing Dashboard (Week 3) 🎨

**Goal**: Visualize data and suggest adjustments

#### Tasks
1. **Create Admin Dashboard Scene**
   - New Phaser scene: `AnalyticsScene.ts`
   - Or separate HTML page (easier for charts)
   - Accessible via `?analytics=true` URL param

2. **Visualizations**
   - Level-by-level success rates (bar chart)
   - Highlight levels outside target range
   - Show average attempts per level
   - Display player drop-off points

3. **Balancing Suggestions**
   - Auto-calculate recommended difficulty adjustments
   - Suggest move count increases/decreases
   - Recommend challenge target changes
   - Flag levels with <100 attempts (need more data)

4. **Export/Reporting**
   - CSV export of all stats
   - Weekly summary report
   - Shareable dashboard URL

**Deliverables**:
- ✅ Analytics dashboard UI
- ✅ Visualizations and charts
- ✅ Automated balancing suggestions
- ✅ Export functionality

**Time Estimate**: 4-5 days

---

### Phase 4: Automated Balancing (Week 4) 🤖

**Goal**: Use analytics to auto-adjust difficulty

#### Tasks
1. **Balancing Algorithm**
   - If success rate < 50%: Increase moves by 2-3
   - If success rate > 80%: Decrease moves by 1-2
   - If success rate 60-70%: Perfect, no change
   - Consider sample size (min 100 attempts before adjusting)

2. **A/B Testing Framework**
   - Split players into groups
   - Test different difficulty settings
   - Measure which performs better
   - Roll out winning variant

3. **Safety Mechanisms**
   - Never adjust levels with <100 attempts
   - Cap max adjustment per week (±5 moves)
   - Manual approval for large changes
   - Rollback capability

4. **Monitoring**
   - Alert if success rate drops below 30%
   - Daily email with level performance
   - Slack/Discord integration for alerts

**Deliverables**:
- ✅ Auto-balancing algorithm
- ✅ A/B testing framework
- ✅ Safety checks and approvals
- ✅ Monitoring and alerts

**Time Estimate**: 5-7 days

---

## Technical Implementation Details

### API Endpoint Specifications

#### POST /api/track-level

**Request Body**:
```typescript
{
  levelNumber: 1,
  challengeType: "color-match",
  challengeTarget: "blue",
  targetValue: 50,
  success: true,
  movesTaken: 25,
  movesRemaining: 5,
  duration: 180,
  finalProgress: 100,
  powerUpsUsed: 3,
  comboMaxChain: 5,
  finalScore: 1200,
  gameVersion: "1.0.0"
}
```

**Response**:
```typescript
{
  success: true,
  message: "Level attempt tracked"
}
```

**Validation Rules**:
- Level number: 1-100
- Duration: 1 second - 1 hour
- Moves: 1-200
- Progress: 0-100
- Success: boolean

**Rate Limiting**: 100 requests/hour per IP

---

#### GET /api/analytics/level/{levelNumber}

**Response**:
```typescript
{
  levelNumber: 1,
  stats: {
    totalAttempts: 1543,
    successfulAttempts: 1102,
    successRate: 71.4,
    avgMovesUsed: 23.5,
    avgTimeToComplete: 165,
    avgAttemptsToSuccess: 1.8,
    needsAdjustment: false,
    recommendation: "Level difficulty is well-balanced"
  },
  histogram: {
    moves: [
      { range: "20-22", count: 234 },
      { range: "23-25", count: 456 },
      { range: "26-28", count: 189 }
    ]
  }
}
```

---

#### GET /api/analytics/summary

**Response**:
```typescript
{
  totalLevels: 20,
  levelsWithData: 15,
  overallStats: {
    avgSuccessRate: 65.3,
    totalAttempts: 45678,
    totalSuccessful: 29842
  },
  levelsNeedingAdjustment: [
    {
      levelNumber: 7,
      successRate: 42.1,
      recommendation: "Increase moves from 25 to 28"
    },
    {
      levelNumber: 12,
      successRate: 88.5,
      recommendation: "Decrease moves from 35 to 32"
    }
  ]
}
```

---

### Client-Side Integration

#### In GameScene.ts

```typescript
// Track when level starts
private levelAttemptStart: Date

startLevel() {
  this.levelAttemptStart = new Date()
  // ... existing code
}

// Track when level ends
async onLevelComplete(success: boolean) {
  const duration = (Date.now() - this.levelAttemptStart.getTime()) / 1000

  const attempt: LevelAttemptSubmission = {
    levelNumber: LevelSystem.getCurrentLevel(),
    challengeType: this.currentChallenge.type,
    challengeTarget: this.currentChallenge.color || this.currentChallenge.powerUpType,
    targetValue: this.currentChallenge.targetValue,
    success: success,
    movesTaken: this.maxMoves - this.movesRemaining,
    movesRemaining: this.movesRemaining,
    duration: duration,
    finalProgress: this.calculateProgress(),
    powerUpsUsed: this.powerUpsCreatedCount,
    comboMaxChain: this.maxComboChain,
    finalScore: this.score,
    gameVersion: '1.0.0'
  }

  // Track asynchronously (don't block game flow)
  HighScoreAPI.trackLevelAttempt(attempt).catch(err => {
    console.warn('Failed to track level attempt:', err)
  })

  // ... existing code
}

private calculateProgress(): number {
  if (!this.currentChallenge) return 0
  return Math.min(100, (this.currentChallenge.currentValue / this.currentChallenge.targetValue) * 100)
}
```

---

## Cost Analysis

### Current Costs (High Scores Only)
- Storage: ~$1/month
- Functions: FREE (within 1M executions)
- **Total**: ~$1-5/month

### With Analytics (Estimated)

**Assumptions**:
- 1,000 active players
- Average 50 level attempts per player per month
- Total: 50,000 attempts/month

**Storage Costs**:
- 50,000 attempts × 1KB each = 50MB/month
- Storage: ~$0.002/month
- Transactions: 50,000 writes × $0.0036/10K = ~$0.02/month

**Function Costs**:
- 50,000 track-level calls
- 1,000 analytics queries
- Total: 51,000 executions/month
- Still within 1M free tier = **FREE**

**Bandwidth**:
- Inbound: FREE
- Outbound: ~1MB = FREE (within 5GB free tier)

### Total Estimated Cost: ~$1-5/month ✅

### At Scale (1M players)
- 50M attempts/month = 50GB storage
- Storage: ~$2/month
- Transactions: ~$18/month
- Functions: ~$50/month (exceeds free tier)
- **Total**: ~$70/month

---

## Success Metrics

### How We'll Measure Success

#### 1. Data Collection (Phase 1)
- ✅ >90% of level attempts tracked
- ✅ <1% error rate on submissions
- ✅ Data arrives within 5 seconds

#### 2. Analytics Quality (Phase 2)
- ✅ Accurate success rate calculations
- ✅ Query response time <500ms
- ✅ Cache hit rate >80%

#### 3. Balancing Effectiveness (Phase 3-4)
- ✅ Identify 5+ levels needing adjustment
- ✅ Increase player retention by 10%
- ✅ Reduce level 1-5 drop-off rate by 20%
- ✅ Achieve target success rates (60-70%) for 80% of levels

#### 4. User Satisfaction
- ✅ Player feedback: "levels feel balanced"
- ✅ Reduced complaints about difficulty
- ✅ Increased daily active users

---

## Privacy & Compliance

### Data Collected
- ✅ Level attempt metrics (anonymous)
- ✅ Hashed IP addresses
- ✅ No personally identifiable information

### Not Collected
- ❌ Email addresses
- ❌ Real names
- ❌ Location data
- ❌ Device identifiers

### Retention
- Level attempts: 90 days (rolling window)
- Aggregated stats: Indefinite
- Can be purged on request

### GDPR Compliance
- No PII collected
- IP hashes cannot be reversed
- Users not tracked across sessions
- Data used only for game balancing

---

## Testing Strategy

### Unit Tests
- Validation logic
- Aggregation calculations
- Rate limiting
- Data sanitization

### Integration Tests
- End-to-end level tracking
- Analytics query accuracy
- Cache invalidation
- Error handling

### Load Tests
- 1,000 simultaneous attempts
- Burst traffic handling
- Database performance
- API response times

### Manual Testing
- Play through 20 levels
- Verify tracking accuracy
- Check dashboard displays
- Test balancing suggestions

---

## Risks & Mitigation

### Risk 1: High Costs at Scale
**Mitigation**:
- Monitor daily costs in Azure portal
- Set up billing alerts at $10, $50, $100
- Implement data retention policy (90 days)
- Use caching aggressively

### Risk 2: Incorrect Balancing
**Mitigation**:
- Require min 100 attempts before adjusting
- Manual approval for changes >±3 moves
- A/B test before rolling out
- Rollback capability

### Risk 3: Player Manipulation
**Mitigation**:
- Rate limiting (100 attempts/hour)
- Detect impossible scores (validation)
- Flag suspicious patterns
- Ignore outlier data

### Risk 4: Privacy Concerns
**Mitigation**:
- Hash all IPs
- No PII collection
- Clear privacy policy
- GDPR compliant

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1**: Data Collection | 2-3 days | API endpoint, client tracking, tests |
| **Phase 2**: Analytics Queries | 3-4 days | Query APIs, caching, debug commands |
| **Phase 3**: Dashboard | 4-5 days | Visualizations, suggestions, exports |
| **Phase 4**: Auto-Balancing | 5-7 days | Algorithm, A/B testing, monitoring |
| **Total** | **14-19 days** | Complete analytics system |

---

## Next Steps

### Immediate Actions
1. ✅ Review and approve this plan
2. ✅ Create new branch: `feature/analytics-system`
3. ✅ Set up Azure Table Storage table: `levelattempts`
4. ✅ Start Phase 1: Data Collection

### First PR Will Include
- New API endpoint: `POST /api/track-level`
- Client-side tracking in GameScene
- Types and validation
- Unit tests
- Documentation

### Questions to Resolve
1. Should we track attempts anonymously or allow optional user IDs?
2. How often should we recalculate aggregated stats? (hourly/daily)
3. Should we implement A/B testing in Phase 4 or defer?
4. Do we want email alerts or just dashboard monitoring?

---

## References

- [High Score System](../HIGH-SCORE-SYSTEM.md)
- [Azure Table Storage Pricing](https://azure.microsoft.com/pricing/details/storage/tables/)
- [Azure Functions Pricing](https://azure.microsoft.com/pricing/details/functions/)
- [Game Analytics Best Practices](https://www.gamedeveloper.com/business/game-analytics-best-practices)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Status**: 📋 Planning - Ready for Implementation
