import { test, expect } from '@playwright/test'

// SKIPPED: Uses page.mouse drag events which don't work in headless CI
// This test is for visual verification only - see rocket-flyaway-console.spec.ts for working automated test
test.skip('rocket + fly away combo - visual proof with screenshots', async ({ page, context }) => {
  // Clear cache and cookies to ensure fresh load
  await context.clearCookies()

  await page.goto('http://localhost:8000/?debug=true&board=rocket-flyaway-combo', {
    waitUntil: 'domcontentloaded'
  })

  // Hard reload the page to bypass cache
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Wait for game scene to be active
  await page.waitForFunction(() => {
    const game = (window as any).game
    return game && game.scene && game.scene.scenes && game.scene.scenes[1] && game.scene.scenes[1].scene.isActive()
  }, { timeout: 5000 })

  // Set challenge and take initial screenshot
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    gameScene.currentChallenge = {
      type: 'color-match',
      color: 'blue',
      targetValue: 20,
      currentValue: 0
    }
    console.log('Challenge set to color-match blue')
  })

  await page.waitForTimeout(500)

  // Screenshot 1: Initial board state
  await page.screenshot({ path: 'test-results/rocket-flyaway-01-initial.png' })
  console.log('Screenshot 1: Initial board')

  // Log row 2 state
  const row2Before = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    const row2 = []
    for (let col = 0; col < 8; col++) {
      row2.push(gameScene.board[2][col].color)
    }
    console.log('Row 2 BEFORE:', row2)
    return row2
  })

  console.log('Row 2 BEFORE:', row2Before)

  // Get the rocket and fly away positions
  const bounds = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    const CELL_SIZE = 80

    const rocketX = 3 * CELL_SIZE + CELL_SIZE / 2
    const rocketY = 4 * CELL_SIZE + CELL_SIZE / 2
    const flyAwayX = 4 * CELL_SIZE + CELL_SIZE / 2
    const flyAwayY = 4 * CELL_SIZE + CELL_SIZE / 2

    return { rocketX, rocketY, flyAwayX, flyAwayY }
  })

  // Drag rocket onto fly away
  console.log('Dragging rocket to fly away...')
  await page.mouse.move(bounds.rocketX, bounds.rocketY)
  await page.mouse.down()
  await page.waitForTimeout(100)

  // Screenshot 2: During drag
  await page.screenshot({ path: 'test-results/rocket-flyaway-02-dragging.png' })
  console.log('Screenshot 2: Dragging')

  await page.mouse.move(bounds.flyAwayX, bounds.flyAwayY, { steps: 10 })
  await page.waitForTimeout(100)

  // Screenshot 3: At drop position
  await page.screenshot({ path: 'test-results/rocket-flyaway-03-drop.png' })
  console.log('Screenshot 3: About to drop')

  await page.mouse.up()
  await page.waitForTimeout(500)

  // Screenshot 4: Right after drop
  await page.screenshot({ path: 'test-results/rocket-flyaway-04-after-drop.png' })
  console.log('Screenshot 4: After drop')

  // Wait for animation
  await page.waitForTimeout(1500)

  // Screenshot 5: During animation
  await page.screenshot({ path: 'test-results/rocket-flyaway-05-animation.png' })
  console.log('Screenshot 5: During animation')

  await page.waitForTimeout(2000)

  // Screenshot 6: After animation complete
  await page.screenshot({ path: 'test-results/rocket-flyaway-06-complete.png' })
  console.log('Screenshot 6: Animation complete')

  // Log row 2 state after
  const row2After = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    const row2 = []
    for (let col = 0; col < 8; col++) {
      row2.push(gameScene.board[2][col].color)
    }
    console.log('Row 2 AFTER:', row2)
    return row2
  })

  console.log('Row 2 AFTER:', row2After)

  // Check console logs
  const consoleLogs = await page.evaluate(() => {
    return (window as any).testLogs || []
  })

  console.log('\n=== ANALYSIS ===')
  console.log('Row 2 BEFORE:', row2Before.join(', '))
  console.log('Row 2 AFTER:', row2After.join(', '))

  if (JSON.stringify(row2Before) === JSON.stringify(row2After)) {
    console.log('❌ Row 2 DID NOT CHANGE - combo may not have triggered!')
  } else {
    console.log('✓ Row 2 changed - checking if it was cleared...')
  }

  console.log('\nScreenshots saved to test-results/ folder')
})
