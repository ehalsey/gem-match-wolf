# Claude Development Guide

This document serves as a quick reference for Claude when working on the Gem Match Wolf codebase.

## 🎯 Quick Links

### Testing
- **[Automated Testing Approach](docs/TEST_APPROACH.md)** - Essential patterns for testing Phaser interactions with Playwright
- **[Manual Testing Guide](TESTING.md)** - Debug mode, console commands, and test boards
- **[Variable Boards Testing](docs/TESTING_VARIABLE_BOARDS.md)** - Testing different board sizes

### Documentation
- **[Features](FEATURES.md)** - Complete list of game features
- **[Ideas](docs/ideas.md)** - Feature ideas and enhancements
- **[Left Off Here](docs/LEFT_OFF_HERE.md)** - Current development status

### System Architecture
- **[High Score System](HIGH-SCORE-SYSTEM.md)** - Backend API and database schema
- **[Deployment](DEPLOYMENT.md)** - Deployment instructions

## ⚠️ Critical Testing Pattern

**When testing Phaser game interactions:**

❌ **DON'T** use `page.mouse.move()`, `page.mouse.down()`, etc. - these don't trigger Phaser events!

✅ **DO** call game methods directly:

```typescript
await page.evaluate(async () => {
  const gameScene = (window as any).game.scene.scenes[1]
  const cell1 = gameScene.board[row1][col1]
  const cell2 = gameScene.board[row2][col2]

  // Call methods directly
  await gameScene.triggerRocketFlyAwayCombo(cell1, cell2)
  await gameScene.destroyCells()
  await gameScene.makeCellsFall()
  await gameScene.refillBoard()
})
```

**See [docs/TEST_APPROACH.md](docs/TEST_APPROACH.md) for complete examples.**

## 📁 Key Files

### Game Logic
- `src/GameScene.ts` - Main game scene, handles board interactions, power-ups, combos
- `src/game/PowerUpSystem.ts` - Power-up creation and pattern detection
- `src/game/MatchDetector.ts` - Match-3 logic
- `src/LevelSystem.ts` - Level progression, challenges, difficulty

### Power-Up Combos
All combo handlers are in `GameScene.ts`:
- `triggerLightBallLightBallCombo()` - Light ball + light ball → clear board
- `triggerLightBallTNTCombo()` - Light ball + TNT → mega explosion
- `triggerLightBallRocketCombo()` - Light ball + rocket → color clear + line
- `triggerFlyAwayLightBallCombo()` - Fly away + light ball → multi-target
- `triggerRocketFlyAwayCombo()` - **Rocket + fly away → smart row/column clear**
- `triggerFlyAwayFlyAwayCombo()` - Fly away + fly away → create 3 fly aways
- `triggerVerticalRocketCombo()` - Vertical + vertical → cross explosion
- `triggerHorizontalRocketCombo()` - Horizontal + horizontal → cross explosion

### Test Boards
Test boards are defined in `GameScene.ts` in the `loadTestBoard()` method. Examples:
- `rocket-flyaway-combo` - Horizontal rocket + fly away combo
- `rocket-flyaway-combo-vertical` - Vertical rocket + fly away combo
- `double-flyaway` - Two fly aways adjacent
- `light-ball-combo` - Light ball combos
- `match5`, `match4h`, `match4v` - Basic pattern tests

## 🧪 Testing Workflow

### 1. Manual Testing
```bash
npm start
# Open http://localhost:8000/?debug=true&board=test-board-name
```

### 2. Automated Testing
```bash
# Run specific test
npx playwright test tests/my-test.spec.ts --headed

# Run all tests
npm test
```

### 3. Creating New Tests

1. Create test file in `tests/` directory
2. Use `page.evaluate()` to call game methods directly (NOT mouse events!)
3. Capture console logs for debugging
4. Verify board state before/after
5. See [docs/TEST_APPROACH.md](docs/TEST_APPROACH.md) for examples

## 🎮 Game Constants

- Board size: 8x8 (configurable via `size` variable)
- Cell size: 80 pixels
- Colors: red, green, blue, yellow, pink
- Power-ups: light-ball, tnt, horizontal-rocket, vertical-rocket, fly-away

## 📝 Adding New Power-Up Combos

1. Add combo detection in `GameScene.ts` → `onDragEnd()` (around line 3320)
2. Create combo handler method (e.g., `triggerMyNewCombo()`)
3. Add logging for debugging
4. Create test board in `loadTestBoard()`
5. Write automated test following [TEST_APPROACH.md](docs/TEST_APPROACH.md)

## 🐛 Common Issues

### Tests Pass But Feature Doesn't Work
- Build the project: `npm run build`
- Hard reload browser (Ctrl+Shift+R)
- Check console for errors

### Drag-and-Drop Not Working in Tests
- Don't use `page.mouse` events
- Call game methods directly via `page.evaluate()`
- See [docs/TEST_APPROACH.md](docs/TEST_APPROACH.md)

### Power-Up Not Spawning
- Check `spawnPowerup()` in test board definition
- Verify power-up type string matches exactly
- Check console logs for errors

## 🚀 Build & Deploy

```bash
# Development
npm start

# Build
npm run build

# Deploy
# See DEPLOYMENT.md
```

## 📚 Additional Resources

- **Phaser Documentation**: https://phaser.io/docs
- **Playwright Documentation**: https://playwright.dev/
- **Project README**: [README.md](README.md)
