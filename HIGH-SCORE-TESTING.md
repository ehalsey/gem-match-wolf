# High Score System Testing Guide

## Current Status

The high score system has been fully implemented with the following components:

- Local storage for personal best tracking
- Game session tracking with anti-cheat measures
- Azure Functions API for score submission and leaderboard retrieval
- Full LeaderboardScene UI
- Game over flow with name input and submission

## Local Testing (Without Azure Backend)

Since the Azure backend isn't deployed yet, here's what you can test locally:

### 1. Personal Best Tracking (LocalStorage)

**Steps to test:**
1. Navigate to http://localhost:8000
2. Play a game until you run out of moves
3. Enter your name when prompted
4. Check browser console for localStorage updates:
   ```javascript
   localStorage.getItem('bejeweled_personal_best')
   localStorage.getItem('bejeweled_scores_history')
   ```
5. Play another game with a higher score
6. Verify personal best is updated only when score is higher
7. Verify score history contains last 10 games

**Expected behavior:**
- Personal best saved when first game completes
- Personal best only updates when new score is higher
- Last used player name is pre-filled on subsequent games
- Score history maintains last 10 games
- "New Personal Best!" message appears when appropriate

### 2. Game Over UI Flow

**Steps to test:**
1. Complete a game (run out of moves)
2. Verify game over screen shows:
   - Final score
   - Number of moves used
   - Game duration
   - Personal best indicator if applicable
   - Name input field (pre-filled if previously entered)
   - Submit button
   - Skip button
3. Test name input:
   - Enter a name
   - Press Enter key to submit
   - Verify clicking Submit also works
4. Test Skip button:
   - Click Skip
   - Verify game over screen clears
   - Verify "New Game" hint appears

**Expected behavior:**
- Game over screen appears when moves reach 0
- All game statistics are displayed correctly
- Name input has focus by default
- Enter key and Submit button both work
- Skip option is clearly visible

### 3. API Error Handling

**Steps to test:**
1. Complete a game and submit score
2. Check browser console for API error message
3. Verify error screen shows graceful failure message:
   - "Submission failed. Please try again later."
   - "Your score is saved locally!"
   - Restart hint appears after 2 seconds

**Expected behavior:**
- API call fails gracefully (expected without backend)
- User-friendly error message displays
- Local score is still saved
- Game can continue normally

### 4. Leaderboard Scene

**Steps to test:**
1. From the menu, click "Leaderboard" button
2. Verify leaderboard scene overlays the game
3. Check personal best section:
   - Shows your best score
   - Shows moves, duration, and player name
   - Styled with gold accents
4. Check global leaderboard section:
   - Shows "Loading leaderboard..." initially
   - Shows error or "No scores yet" when API fails
5. Test Close button:
   - Click Close
   - Verify scene closes cleanly
   - Verify game is still behind (not restarted)

**Expected behavior:**
- Leaderboard opens as overlay
- Personal best displays correctly from localStorage
- Loading states are shown appropriately
- API failure is handled gracefully
- Close button returns to game

### 5. Session Tracking

**Steps to test:**
1. Open browser console
2. Play a game and make moves
3. Check console for session tracking logs
4. Verify session hash is generated at game over

**Expected behavior:**
- Session starts with unique seed
- Moves are tracked incrementally
- Score updates are tracked
- Session hash is computed correctly
- All session data is included in submission

## Testing With Azurite (Local Azure Emulation)

To test the full API locally before deployment:

### Setup

1. Install Azurite:
   ```bash
   npm install -g azurite
   ```

2. Start Azurite:
   ```bash
   azurite --silent --location c:\azurite --debug c:\azurite\debug.log
   ```

3. Install API dependencies:
   ```bash
   cd api
   npm install
   ```

4. Start Azure Functions locally:
   ```bash
   cd api
   npm start
   ```

### API Testing

1. Submit a score:
   ```bash
   curl -X POST http://localhost:7071/api/submit-score \
     -H "Content-Type: application/json" \
     -d '{
       "playerName": "TestPlayer",
       "score": 1000,
       "moves": 25,
       "duration": 120,
       "sessionHash": "abc123",
       "gameVersion": "1.0.0"
     }'
   ```

2. Get leaderboard:
   ```bash
   curl http://localhost:7071/api/get-leaderboard?limit=10
   ```

3. Update API base URL in `bejeweled/src/api/HighScoreAPI.ts`:
   ```typescript
   private baseUrl = 'http://localhost:7071/api'
   ```

4. Test full flow with local API

## Testing After Azure Deployment

Once the Static Web App is deployed:

### 1. End-to-End Score Submission

**Steps to test:**
1. Play a complete game on production site
2. Submit score with name
3. Verify success message appears
4. Verify rank is displayed (if applicable)
5. Open leaderboard
6. Verify submitted score appears in global leaderboard

**Expected behavior:**
- Score submits successfully
- Rank is returned and displayed
- Leaderboard updates with new score
- Personal best is maintained locally

### 2. Anti-Cheat Validation

**Steps to test:**
1. Submit a score with unrealistic score/move ratio:
   ```bash
   curl -X POST https://your-site.azurestaticapps.net/api/submit-score \
     -H "Content-Type: application/json" \
     -d '{
       "playerName": "Cheater",
       "score": 999999,
       "moves": 1,
       "duration": 1,
       "sessionHash": "fake",
       "gameVersion": "1.0.0"
     }'
   ```
2. Verify response: `{"success": false, "error": "Invalid score data"}`

**Expected behavior:**
- Suspicious scores are rejected
- Validation errors are returned
- Valid scores are accepted

### 3. Rate Limiting

**Steps to test:**
1. Submit 11 scores rapidly from same IP
2. Verify 11th submission fails with rate limit error
3. Wait 1 hour and verify submissions work again

**Expected behavior:**
- First 10 submissions succeed
- 11th submission fails with "Rate limit exceeded"
- Rate limit resets after window expires

### 4. Leaderboard Display

**Steps to test:**
1. Submit scores from multiple "players"
2. Verify leaderboard shows:
   - Top 50 scores in descending order
   - Correct rank numbers
   - Gold/silver/bronze styling for top 3
   - Player names, scores, and moves
3. Verify leaderboard caches for 60 seconds

**Expected behavior:**
- Scores are sorted correctly
- Ranking is accurate
- Visual styling matches design
- Caching reduces API calls

## Known Limitations (Local Testing)

- API endpoints will fail without Azure backend or Azurite
- Leaderboard will show "No scores yet" or error message
- Global rankings cannot be tested
- Rate limiting cannot be tested
- Anti-cheat validation cannot be tested

## Browser Console Commands

Useful commands for testing localStorage:

```javascript
// View personal best
JSON.parse(localStorage.getItem('bejeweled_personal_best'))

// View score history
JSON.parse(localStorage.getItem('bejeweled_scores_history'))

// View last player name
localStorage.getItem('bejeweled_player_name')

// Clear all high score data
localStorage.removeItem('bejeweled_personal_best')
localStorage.removeItem('bejeweled_scores_history')
localStorage.removeItem('bejeweled_player_name')

// Or use the LocalScores API
LocalScores.getPersonalBest()
LocalScores.getScoreHistory()
LocalScores.getStats()
LocalScores.clearAll()
```

## Next Steps

1. **Local Testing**: Test all localStorage and UI features (listed above)
2. **Deploy to Azure**: Push to GitHub to trigger Azure Static Web Apps deployment
3. **Configure Azure**: Ensure Table Storage is connected to Functions
4. **Production Testing**: Test full end-to-end flow on deployed site
5. **Monitor**: Watch for errors, rate limiting issues, and suspicious submissions

## Deployment Checklist

- [ ] All TypeScript errors resolved (✅ DONE)
- [ ] Azure workflow configuration updated (✅ DONE)
- [ ] API functions have correct environment variables
- [ ] Azure Table Storage connection string configured
- [ ] staticwebapp.config.json deployed with site (✅ DONE)
- [ ] API endpoints return correct CORS headers
- [ ] Rate limiting is working
- [ ] Anti-cheat validation is working
- [ ] Leaderboard displays correctly

## Cost Monitoring

After deployment, monitor Azure costs:

- Expected: $1-5/month for moderate traffic
- Watch for: Unexpected spikes in API calls or storage
- Alert if: Daily costs exceed $1
- Review: Check Azure cost analysis weekly for first month

## Support and Debugging

If issues occur:

1. Check browser console for JavaScript errors
2. Check Azure Functions logs for API errors
3. Verify Table Storage has correct data structure
4. Test rate limiting isn't blocking legitimate users
5. Verify CORS configuration allows site domain
6. Check session hash generation is working
7. Verify name sanitization isn't breaking valid names
