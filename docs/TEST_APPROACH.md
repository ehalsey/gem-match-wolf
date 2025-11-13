# Testing Approach for Gem Match Wolf

This document describes the testing strategies and patterns used for the game, particularly for Phaser-based interactions.

## Table of Contents
- [Key Principle](#key-principle)
- [Testing Phaser Drag-and-Drop](#testing-phaser-drag-and-drop)
- [Test Pattern Examples](#test-pattern-examples)
- [Console Log Capture](#console-log-capture)
- [Visual Testing with Screenshots](#visual-testing-with-screenshots)
- [Best Practices](#best-practices)

## Key Principle

**⚠️ IMPORTANT: Automated mouse events (Playwright's `page.mouse`) do NOT reliably trigger Phaser's drag handlers.**

Instead, **call game methods directly** using `page.evaluate()` to execute code in the browser context.

## Testing Phaser Drag-and-Drop

### ❌ What DOESN'T Work

```typescript
// This will NOT trigger Phaser's drag events properly
await page.mouse.move(x, y)
await page.mouse.down()
await page.mouse.move(targetX, targetY)
await page.mouse.up()
```

### ✅ What DOES Work

Call the game methods directly through the Phaser scene:

```typescript
await page.evaluate(async () => {
  const gameScene = (window as any).game.scene.scenes[1] as any

  // Get the cells
  const firstCell = gameScene.board[row1][col1]
  const secondCell = gameScene.board[row2][col2]

  // Call the combo/interaction method directly
  const maybePromise = gameScene.triggerRocketFlyAwayCombo(firstCell, secondCell)
  if (maybePromise && typeof maybePromise.then === 'function') {
    await maybePromise
  }

  // Trigger any necessary cleanup
  await gameScene.destroyCells()
  await gameScene.makeCellsFall()
  await gameScene.refillBoard()
})
```

## Test Pattern Examples

### Example 1: Testing Power-Up Combos

```typescript
import { test, expect } from '@playwright/test'

test('rocket + fly away combo clears best row', async ({ page }) => {
  // 1. Load the game with a test board
  await page.goto('http://localhost:8000/?debug=true&board=rocket-flyaway-combo')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 2. Wait for game scene
  await page.waitForFunction(() => {
    const game = (window as any).game
    return game?.scene?.scenes[1]?.scene?.isActive()
  }, { timeout: 5000 })

  // 3. Set up test conditions
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    gameScene.currentChallenge = {
      type: 'color-match',
      color: 'blue',
      targetValue: 20,
      currentValue: 0
    }
  })

  // 4. Capture board state BEFORE
  const rowBefore = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    return gameScene.board[2].map((cell: any) => cell.color)
  })

  // 5. Trigger the interaction
  await page.evaluate(async () => {
    const gameScene = (window as any).game.scene.scenes[1]
    const rocket = gameScene.board[4][3]
    const flyAway = gameScene.board[4][4]

    await gameScene.triggerRocketFlyAwayCombo(rocket, flyAway)
    await gameScene.destroyCells()
    await gameScene.makeCellsFall()
    await gameScene.refillBoard()
  })

  await page.waitForTimeout(500)

  // 6. Verify board state AFTER
  const rowAfter = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    return gameScene.board[2].map((cell: any) => cell.color)
  })

  // 7. Assert the change
  expect(JSON.stringify(rowBefore)).not.toBe(JSON.stringify(rowAfter))
})
```

### Example 2: Verifying Power-Ups Are Spawned

```typescript
test('test board spawns correct power-ups', async ({ page }) => {
  await page.goto('http://localhost:8000/?debug=true&board=rocket-flyaway-combo')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const powerups = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    return {
      rocket: gameScene.board[4][3].powerup,
      flyAway: gameScene.board[4][4].powerup
    }
  })

  expect(powerups.rocket).toBe('horizontal-rocket')
  expect(powerups.flyAway).toBe('fly-away')
})
```

## Console Log Capture

Capture browser console logs to verify game behavior:

```typescript
test('verify combo triggers correct logs', async ({ page }) => {
  const consoleLogs: string[] = []

  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text()
    consoleLogs.push(text)
    console.log(`[BROWSER]: ${text}`)
  })

  await page.goto('http://localhost:8000/?debug=true&board=test-board')

  // ... trigger interaction ...

  // Verify expected logs appeared
  const comboLogs = consoleLogs.filter(log =>
    log.includes('COMBO') || log.includes('ROCKET')
  )

  expect(comboLogs.length).toBeGreaterThan(0)
  expect(comboLogs.some(log => log.includes('Best row'))).toBe(true)
})
```

## Visual Testing with Screenshots

Use screenshots to debug and verify visual behavior:

```typescript
test('visual verification with screenshots', async ({ page }) => {
  await page.goto('http://localhost:8000/?debug=true&board=test-board')

  // Screenshot 1: Initial state
  await page.screenshot({ path: 'test-results/01-initial.png' })

  // ... perform actions ...

  // Screenshot 2: After interaction
  await page.screenshot({ path: 'test-results/02-after.png' })

  // Screenshots can be manually reviewed or compared
})
```

## Best Practices

### 1. Always Reload Page After Build

Browser caching can cause old code to run. Force reload:

```typescript
await page.goto('http://localhost:8000/?debug=true&board=test-board')
await page.reload({ waitUntil: 'domcontentloaded' })
```

### 2. Wait for Game Scene to Be Ready

```typescript
await page.waitForFunction(() => {
  const game = (window as any).game
  return game && game.scene && game.scene.scenes[1] && game.scene.scenes[1].scene.isActive()
}, { timeout: 5000 })
```

### 3. Check Power-Ups Are Loaded

Before testing interactions, verify power-ups spawned correctly:

```typescript
const powerups = await page.evaluate(() => {
  const gameScene = (window as any).game.scene.scenes[1]
  return {
    cell1: gameScene.board[row][col].powerup,
    cell2: gameScene.board[row2][col2].powerup
  }
})

expect(powerups.cell1).toBe('expected-powerup-type')
```

### 4. Capture State Before and After

Always capture board state before/after to verify changes:

```typescript
// Before
const stateBefore = await page.evaluate(() => {
  const gameScene = (window as any).game.scene.scenes[1]
  return gameScene.board[targetRow].map((cell: any) => ({
    color: cell.color,
    empty: cell.empty,
    powerup: cell.powerup
  }))
})

// ... trigger interaction ...

// After
const stateAfter = await page.evaluate(() => {
  const gameScene = (window as any).game.scene.scenes[1]
  return gameScene.board[targetRow].map((cell: any) => ({
    color: cell.color,
    empty: cell.empty,
    powerup: cell.powerup
  }))
})

// Compare
expect(JSON.stringify(stateBefore)).not.toBe(JSON.stringify(stateAfter))
```

### 5. Handle Async Game Methods

Game methods often return promises. Always handle them:

```typescript
await page.evaluate(async () => {
  const gameScene = (window as any).game.scene.scenes[1]

  // Check if method returns a promise
  const maybePromise = gameScene.someGameMethod()
  if (maybePromise && typeof maybePromise.then === 'function') {
    await maybePromise
  }
})
```

### 6. Use Console Logs for Debugging

Add console.log statements in game code, then capture them in tests:

```typescript
// In game code (GameScene.ts)
console.log('🚀🚁 ROCKET + FLY-AWAY COMBO DETECTED!')
console.log(`[ROCKET + FLY-AWAY] Best row is ${bestRow}`)

// In test
page.on('console', msg => {
  console.log(`[BROWSER]: ${msg.text()}`)
})
```

## Common Pitfalls

### 1. ❌ Trying to Simulate User Input

Don't try to simulate clicks, drags, or keyboard input for Phaser interactions. Call game methods directly.

### 2. ❌ Not Waiting for Animations

Game methods trigger animations. Wait for them to complete:

```typescript
await gameScene.triggerPowerUp(cell)
await page.waitForTimeout(2000)  // Wait for animation
```

### 3. ❌ Forgetting to Trigger Cleanup

After calling combo methods, trigger board updates:

```typescript
await gameScene.destroyCells()
await gameScene.makeCellsFall()
await gameScene.refillBoard()
```

### 4. ❌ Not Handling Scene Context

Always get the game scene through the correct path:

```typescript
const gameScene = (window as any).game.scene.scenes[1]  // ✅ Correct
const gameScene = (window as any).game.scene.keys['GameScene']  // ❌ May not work
```

## Test File Examples

### Real Working Example

See `tests/rocket-flyaway-console.spec.ts` for a complete working example that:
- ✅ Loads a test board
- ✅ Verifies power-ups are present
- ✅ Calls combo method directly
- ✅ Captures console logs
- ✅ Verifies board state changed

### Screenshot Example

See `tests/rocket-flyaway-screenshot.spec.ts` for visual testing with screenshots.

## Summary

**Key Takeaway**: When testing Phaser game interactions, **bypass the UI layer** and **call game methods directly** through `page.evaluate()`. This gives you reliable, fast tests that accurately verify game logic.
