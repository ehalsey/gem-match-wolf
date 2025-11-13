# VS Code Launch Configurations

This directory contains VS Code configurations for debugging and running the Gem Match Wolf project.

## Quick Start

Press **F5** or go to **Run and Debug** (Ctrl+Shift+D) and select one of these configurations:

### 🚀 Full Stack (Game + API + Azurite) - RECOMMENDED

**One-click to start everything!**

Launches:
1. **Azurite** - Local Azure Storage emulator (ports 10000-10002)
2. **Azure Functions** - Backend API (http://localhost:7071)
3. **Game Dev Server** - Frontend (http://localhost:8000)
4. **Chrome** - Browser with DevTools debugging

Perfect for:
- Full-stack development
- Testing analytics integration
- Working on features that need the backend

### 🎮 Game Only (Chrome/Edge)

Launches just the game frontend without the backend API.

Perfect for:
- Frontend-only work
- UI development
- Testing game mechanics

## Configurations Available

| Configuration | What it does |
|--------------|--------------|
| 🚀 **Full Stack (Game + API + Azurite)** | Complete dev environment |
| 🎮 **Game Only (Chrome)** | Frontend only in Chrome |
| 🎮 **Game Only (Edge)** | Frontend only in Edge |
| **Launch Azure Functions + Azurite** | Backend only (no game) |
| **Attach to Azure Functions** | Attach debugger to running Functions |

## Debugging

Once launched, you can:
- Set breakpoints in TypeScript files
- Inspect variables
- Step through code
- View console output in Debug Console

### Frontend Debugging
- Set breakpoints in `src/**/*.ts` files
- Use Chrome DevTools (F12)

### Backend Debugging
- Set breakpoints in `api/**/*.ts` files
- View Azure Functions logs in Terminal

## Manual Testing

If you prefer manual control, open three terminals:

```bash
# Terminal 1: Storage
cd api
npm run storage

# Terminal 2: API
cd api
npm start

# Terminal 3: Game
npm run dev
```

Then open http://localhost:8000 in your browser.

## Troubleshooting

### Port Already in Use

If you get "EADDRINUSE" errors:

```bash
# Windows
netstat -ano | findstr :7071
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:7071 | xargs kill
```

### Azurite Not Starting

Make sure the azurite directory exists:

```bash
cd api
mkdir azurite
```

### Functions Not Loading

1. Check `api/local.settings.json` exists (copy from `local.settings.example.json`)
2. Run `cd api && npm run build` to rebuild TypeScript
3. Check Terminal output for errors

## More Info

- **[Local Testing Guide](../api/LOCAL_TESTING.md)** - Complete testing documentation
- **[Analytics Plan](../docs/ANALYTICS_PLAN.md)** - Backend architecture
- **[Claude Development Guide](../CLAUDE.md)** - Development patterns
