# Bejeweled High Score API

Azure Functions API for managing high scores with anti-cheat validation.

## Features

- **Score Submission** with server-side validation
- **Leaderboard** retrieval with caching
- **Rate Limiting** (10 requests/hour per IP, 50 submissions/day)
- **Anti-Cheat Measures**:
  - Score/move ratio validation
  - Score/time ratio validation
  - Session hash verification
  - IP-based rate limiting
  - Input sanitization

## API Endpoints

### POST /api/submit-score

Submit a high score.

**Request Body:**
```json
{
  "playerName": "Player",
  "score": 1500,
  "moves": 25,
  "duration": 120,
  "sessionHash": "abc123...",
  "gameVersion": "1.0.0"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Score submitted successfully",
  "score": 1500,
  "rank": null
}
```

**Response (Error):**
```json
{
  "error": "Score/move ratio is suspicious"
}
```

### GET /api/get-leaderboard

Get top scores.

**Query Parameters:**
- `limit` (optional): Number of scores to return (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "count": 100,
  "leaderboard": [
    {
      "playerName": "Player1",
      "score": 5000,
      "moves": 30,
      "duration": 180,
      "timestamp": "2025-01-15T10:30:00Z",
      "rank": 1
    }
  ]
}
```

## Local Development

### Prerequisites

- Node.js 20.x
- Azure Functions Core Tools 4.x
- Azure Storage Emulator (Azurite)

### Setup

1. Install dependencies:
```bash
cd api
npm install
```

2. Start Azurite (Azure Storage Emulator):
```bash
# Install globally if not already installed
npm install -g azurite

# Start in a separate terminal
azurite --silent --location c:\\azurite --debug c:\\azurite\\debug.log
```

3. Build TypeScript:
```bash
npm run build
```

4. Start the Azure Functions locally:
```bash
npm start
```

The API will be available at `http://localhost:7071/api`

### Testing Locally

```bash
# Submit a score
curl -X POST http://localhost:7071/api/submit-score \
  -H "Content-Type: application/json" \
  -d '{
    "playerName": "TestPlayer",
    "score": 1500,
    "moves": 25,
    "duration": 120,
    "sessionHash": "abc123def456...",
    "gameVersion": "1.0.0"
  }'

# Get leaderboard
curl http://localhost:7071/api/get-leaderboard?limit=10
```

## Deployment to Azure

### Option 1: Deploy with Azure Static Web Apps

Azure Static Web Apps automatically deploys the `/api` folder as Azure Functions.

1. Push to GitHub
2. Azure Static Web Apps CI/CD will automatically deploy

### Option 2: Manual Deployment

```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name bejeweled-rg --location eastus

# Create storage account
az storage account create \
  --name bejeweledscores \
  --resource-group bejeweled-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name bejeweledscores \
  --resource-group bejeweled-rg

# Create Function App
az functionapp create \
  --resource-group bejeweled-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name bejeweled-api \
  --storage-account bejeweledscores

# Set environment variables
az functionapp config appsettings set \
  --name bejeweled-api \
  --resource-group bejeweled-rg \
  --settings AZURE_STORAGE_CONNECTION_STRING="<connection-string>"

# Deploy
cd api
npm run build
func azure functionapp publish bejeweled-api
```

## Configuration

### Environment Variables

- `AZURE_STORAGE_CONNECTION_STRING`: Azure Table Storage connection string
- `FUNCTIONS_WORKER_RUNTIME`: Set to `node`
- `NODE_ENV`: Set to `production` for production deployment

### Rate Limiting

Edit `shared/rateLimit.ts` to adjust:
- `maxRequests`: Maximum requests per window
- `windowMs`: Time window in milliseconds

### Validation Rules

Edit `shared/validation.ts` to adjust:
- `MAX_SCORE`, `MIN_SCORE`: Score range
- `MAX_POINTS_PER_MOVE`: Maximum points per move
- `MAX_DURATION`: Maximum game duration
- Player name length, profanity filters, etc.

## Security

### DDoS Protection

- Azure automatically provides DDoS protection
- Rate limiting at application level (10 req/hour per IP)
- Daily submission limit (50 per IP)

### Data Privacy

- IP addresses are hashed before storage
- Only aggregated statistics stored
- GDPR compliant (no PII stored)

### Anti-Cheat

The system validates:
1. **Score feasibility**: Based on moves and time
2. **Session integrity**: Hash verification
3. **Rate limits**: Prevents spam
4. **Input sanitization**: Prevents injection attacks

## Cost Estimate

With Azure Free Tier:
- **Azure Functions**: 1M free executions/month
- **Table Storage**: ~$0.10/month for 10K scores
- **Static Web Apps**: Free tier sufficient

**Estimated cost**: $2-5/month for moderate traffic

## Monitoring

View logs in Azure Portal:
1. Navigate to your Function App
2. Go to "Monitor" > "Logs"
3. Use Application Insights for detailed metrics

## Troubleshooting

### "AZURE_STORAGE_CONNECTION_STRING is not set"

Set the environment variable in `local.settings.json` for local development:
```json
{
  "Values": {
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true"
  }
}
```

### CORS Errors

The API is configured with `Access-Control-Allow-Origin: *`. For production, update this in the function handlers to your specific domain.

### Rate Limit Issues

The in-memory rate limiter resets on function restarts. For production with multiple instances, consider using Azure Table Storage or Redis for distributed rate limiting.

## License

MIT
