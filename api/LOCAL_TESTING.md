# Local Testing Guide for Analytics Backend

This guide shows how to test the complete Azure Functions + Storage backend locally before deploying to Azure.

## Prerequisites

- Node.js 18+
- Azure Functions Core Tools (already installed)
- Azurite (now installed as dev dependency)

## Quick Start

### Option 1: Manual Testing (Recommended for first time)

**Terminal 1 - Start Azurite (Storage Emulator):**
```bash
cd api
npm run storage
```

You should see:
```
Azurite Blob service is starting at http://127.0.0.1:10000
Azurite Queue service is starting at http://127.0.0.1:10001
Azurite Table service is starting at http://127.0.0.1:10002
```

**Terminal 2 - Start Azure Functions:**
```bash
cd api
npm start
```

You should see:
```
Functions:
  submit-score: [POST] http://localhost:7071/api/submit-score
  get-leaderboard: [GET] http://localhost:7071/api/get-leaderboard
  track-level: [POST] http://localhost:7071/api/track-level
```

**Terminal 3 - Test the API:**
```bash
# Test with valid attempt
curl -X POST http://localhost:7071/api/track-level \
  -H "Content-Type: application/json" \
  -d '{
    "levelNumber": 1,
    "challengeType": "color-match",
    "challengeTarget": "blue",
    "targetValue": 50,
    "success": true,
    "movesTaken": 20,
    "movesRemaining": 10,
    "duration": 120,
    "finalProgress": 100,
    "powerUpsUsed": 3,
    "comboMaxChain": 5,
    "finalScore": 1500,
    "gameVersion": "1.0.0"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Level attempt tracked"
}
```

### Option 2: Run Integration Tests

**Start services (in separate terminals):**
```bash
cd api
npm run storage  # Terminal 1
npm start        # Terminal 2
```

**Run integration tests:**
```bash
cd api
npm run test:integration  # Terminal 3
```

## Testing Scenarios

### 1. Valid Level Completion
```json
{
  "levelNumber": 1,
  "challengeType": "color-match",
  "challengeTarget": "blue",
  "targetValue": 50,
  "success": true,
  "movesTaken": 20,
  "movesRemaining": 10,
  "duration": 120,
  "finalProgress": 100,
  "powerUpsUsed": 3,
  "comboMaxChain": 5,
  "finalScore": 1500,
  "gameVersion": "1.0.0"
}
```
✅ Should return 201 Created

### 2. Failed Level Attempt
```json
{
  "levelNumber": 1,
  "challengeType": "color-match",
  "challengeTarget": "blue",
  "targetValue": 100,
  "success": false,
  "movesTaken": 30,
  "movesRemaining": 0,
  "duration": 180,
  "finalProgress": 60,
  "powerUpsUsed": 2,
  "comboMaxChain": 3,
  "finalScore": 800,
  "gameVersion": "1.0.0"
}
```
✅ Should return 201 Created

### 3. Invalid Level Number
```json
{
  "levelNumber": 999,
  "challengeType": "color-match",
  ...
}
```
❌ Should return 400 Bad Request

### 4. Invalid Business Logic
```json
{
  "success": true,
  "finalProgress": 50,  // Should be 100 for success
  ...
}
```
❌ Should return 400 Bad Request

## Viewing Stored Data

### Using Azure Storage Explorer
1. Download: https://azure.microsoft.com/features/storage-explorer/
2. Connect to Local Emulator
3. Browse Tables → `levelattempts`

### Using REST API
```bash
# List all attempts for level 1
curl "http://127.0.0.1:10002/devstoreaccount1/levelattempts()?$filter=PartitionKey%20eq%20'level-1'"
```

## Running All Tests

```bash
cd api

# Unit tests (no services needed)
npm test

# Integration tests (requires services running)
npm run test:integration

# Coverage report
npm run test:coverage
```

## Common Issues

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::7071
```

**Solution:** Kill existing process:
```bash
# Windows
netstat -ano | findstr :7071
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:7071 | xargs kill
```

### Azurite Not Starting
```
Error: ENOENT: no such file or directory
```

**Solution:** Create azurite directory:
```bash
cd api
mkdir azurite
npm run storage
```

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:10002
```

**Solution:** Make sure Azurite is running in a separate terminal

## Next Steps

Once local testing passes:
1. ✅ All unit tests pass
2. ✅ All integration tests pass
3. ✅ Manual testing confirms data saves
4. ✅ Ready to deploy to Azure
5. ✅ Safe to merge PR

## Cleanup

Stop services:
- Ctrl+C in each terminal

Clear local data:
```bash
cd api
rm -rf azurite/*
```
