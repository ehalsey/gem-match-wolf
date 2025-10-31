# High Score System Documentation

## Overview

The Bejeweled game now includes a complete high score system with online leaderboards and anti-cheat protection.

## Architecture

```
┌──────────────┐         ┌──────────────────┐         ┌────────────────┐
│ Game Client  │────────▶│ Azure Functions  │────────▶│ Table Storage  │
│ (Phaser)     │         │ API              │         │                │
└──────────────┘         └──────────────────┘         └────────────────┘
   Session                 Validation                   Persistence
   Tracking                Rate Limiting                Leaderboard
   Hashing                 Anti-Cheat
```

## Components

### 1. Game Session Tracking (`bejeweled/src/GameSession.ts`)

Tracks game session data for validation:
- Score
- Moves made
- Duration
- Random seed
- Session hash (SHA256)

**Usage:**
```typescript
const session = new GameSession(seed)
session.incrementMoves()
session.updateScore(newScore)
const hash = session.generateSessionHash()
const submission = session.getSubmissionData("PlayerName")
```

### 2. API Client (`bejeweled/src/api/HighScoreAPI.ts`)

Client-side API wrapper:
```typescript
const api = new HighScoreAPI()

// Submit score
const response = await api.submitScore(submission)

// Get leaderboard
const leaderboard = await api.getLeaderboard(100)
```

### 3. Azure Functions API (`/api`)

Two serverless endpoints:

#### POST /api/submit-score
- Validates score submission
- Checks rate limits
- Stores in Azure Table Storage

#### GET /api/get-leaderboard
- Returns top scores
- Cached for 60 seconds
- Supports pagination

### 4. Validation System (`api/shared/validation.ts`)

Multi-layer validation:

1. **Input Validation**
   - Player name: 1-20 characters
   - Score range: 0-1,000,000
   - Moves range: 1-10,000
   - Duration: 10 seconds - 2 hours

2. **Ratio Checks**
   - Points per move: 10-5,000 (accounts for combos)
   - Points per second: max 1,000

3. **Session Validation**
   - Hash must be 32+ characters
   - Format validation

### 5. Rate Limiting (`api/shared/rateLimit.ts`)

Protection against abuse:
- **10 requests per hour** per IP
- **50 submissions per day** per IP
- In-memory store (consider Redis for production scale)

### 6. Storage (`api/shared/storage.ts`)

Azure Table Storage:
- Partition by month (YYYY-MM)
- Row key: timestamp + random
- Indexed by score for fast queries

## Game Flow

### When Game Ends

1. Game over UI displays with:
   - Final score
   - Move count
   - Duration
   - Name input field

2. User enters name and clicks "Submit Score"

3. Client validates input and sends to API:
```json
{
  "playerName": "Alice",
  "score": 2500,
  "moves": 30,
  "duration": 180,
  "sessionHash": "a1b2c3...",
  "gameVersion": "1.0.0"
}
```

4. Server validates and stores

5. Success screen shows rank (if calculated)

6. User can restart game

## Anti-Cheat Measures

### Session Hashing

```typescript
// Client generates hash
const data = `${score}:${moves}:${duration}:${seed}`
const hash = SHA256(data)
```

Server can verify:
- Hash matches claimed score
- Seed consistency
- Time feasibility

### Rate Limiting

- Prevents mass submissions
- IP-based tracking
- Exponential backoff on repeated attempts

### Validation Rules

Scores are rejected if:
- Points per move is unrealistic (>5000)
- Game duration is too short for score
- Score/time ratio impossible (>1000 pts/sec)
- Multiple rapid submissions from same IP

### Future Enhancements

Potential additions:
- [ ] Replay validation (store move sequence)
- [ ] Pattern detection for bot behavior
- [ ] Captcha for suspicious scores
- [ ] Report system for cheaters
- [ ] Admin dashboard for moderation

## Cost Analysis

### Azure Resources

**Table Storage:**
- Storage: ~$0.045/GB/month
- 10,000 scores ≈ 1MB = $0.00005/month
- Transactions: $0.00036 per 10K = ~$0.01/month

**Azure Functions:**
- First 1M executions: FREE
- 10K daily submissions = 300K/month = FREE
- Leaderboard queries: 100K/month = FREE

**Bandwidth:**
- Outbound: First 5GB FREE
- Typical: ~50KB per leaderboard = 5GB for 100K requests = FREE

**Total Estimated Cost: $1-5/month** (mostly safety margin)

### Scaling Considerations

At 1M users:
- ~$20/month for storage
- ~$50/month for compute
- Still well under $100/month

## Testing

### Local Development

1. Start Azurite (Storage Emulator):
```bash
azurite --silent --location c:\\azurite
```

2. Start API:
```bash
cd api
npm install
npm start
```

3. Start Game:
```bash
cd bejeweled
npm start
```

4. Test by completing a game

### Testing Anti-Cheat

Try submitting invalid scores:

```bash
# Too high score for moves
curl -X POST http://localhost:7071/api/submit-score \
  -H "Content-Type: application/json" \
  -d '{
    "playerName": "Cheater",
    "score": 1000000,
    "moves": 1,
    "duration": 1,
    "sessionHash": "fake123",
    "gameVersion": "1.0.0"
  }'

# Should return 400 with "Score/move ratio is suspicious"
```

### Testing Rate Limiting

Submit 11 scores rapidly:
```bash
for i in {1..11}; do
  curl -X POST http://localhost:7071/api/submit-score \
    -H "Content-Type: application/json" \
    -d "{\"playerName\":\"Test$i\",\"score\":100,\"moves\":10,\"duration\":60,\"sessionHash\":\"test$i\",\"gameVersion\":\"1.0.0\"}"
done

# 11th request should return 429 (Too Many Requests)
```

## Deployment

### With Azure Static Web Apps (Recommended)

Already configured! Azure Static Web Apps automatically:
1. Deploys `/api` folder as Azure Functions
2. Routes `/api/*` to functions
3. Handles CORS
4. Provides SSL

Just push to GitHub and it deploys.

### Manual Setup

See `api/README.md` for detailed instructions.

## Monitoring & Maintenance

### Check Logs

Azure Portal → Function App → Monitor → Logs

### Common Metrics

- Submission success rate
- Average score
- Rate limit hits
- Validation failures

### Alerts

Set up in Azure Portal:
- High error rate (>10%)
- Unusual traffic patterns
- Storage quota warnings

## User Privacy

### Data Collected

- Player name (user-provided)
- Score, moves, duration
- Hashed IP address
- Timestamp

### Not Collected

- Email addresses
- Personal information
- Location data
- Device fingerprints

### GDPR Compliance

- No PII stored (IP is hashed)
- Users not tracked across sessions
- No cookies or tracking pixels
- Data retention: Indefinite (leaderboard scores)

## Future Features

### Leaderboard UI

Create a dedicated leaderboard scene:
- Top 100 scores
- Player's rank
- Filter by timeframe (daily/weekly/all-time)
- Refresh button

### Local High Scores

Add localStorage for personal bests:
```typescript
localStorage.setItem('highScore', score.toString())
localStorage.setItem('playerName', name)
```

### Achievements

Track and display:
- First power-up created
- Highest combo
- Fastest win
- Most points in single move

### Social Features

- Share score on social media
- Challenge friends
- Team leaderboards

## Troubleshooting

### "Failed to submit score"

1. Check browser console for errors
2. Verify API is running (F12 → Network tab)
3. Check CORS configuration
4. Verify Azure Storage connection

### Scores not appearing in leaderboard

1. Check Azure Table Storage (Storage Explorer)
2. Verify partition key format
3. Check sorting logic
4. Clear browser cache

### Rate limit errors

- Wait 1 hour between bursts
- Check IP hasn't been flagged
- Verify rate limit configuration

## Support

For issues:
1. Check browser console (F12)
2. Check Azure Function logs
3. Review `api/README.md`
4. Open GitHub issue with logs

## License

MIT - See LICENSE file
