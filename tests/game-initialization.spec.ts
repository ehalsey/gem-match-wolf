import { test, expect } from '@playwright/test'

test.describe('Game Initialization and Null Safety', () => {
  test('should initialize game without null reference errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Listen for runtime errors
    page.on('pageerror', error => {
      errors.push(error.message)
    })

    // Navigate to the game
    await page.goto('http://localhost:8000')

    // Wait for game to load
    await page.waitForSelector('canvas', { timeout: 10000 })

    // Wait a bit for initialization to complete
    await page.waitForTimeout(2000)

    // Check that no errors occurred
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null') ||
      err.includes('null reference')
    )

    if (nullErrors.length > 0) {
      console.error('Null reference errors found:', nullErrors)
    }

    expect(nullErrors).toHaveLength(0)
  })

  test('should handle drag and drop without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
    })

    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Get canvas element
    const canvas = await page.locator('canvas')
    const boundingBox = await canvas.boundingBox()

    if (!boundingBox) {
      throw new Error('Canvas not found')
    }

    // Simulate a drag on the board
    const centerX = boundingBox.x + boundingBox.width / 2
    const centerY = boundingBox.y + boundingBox.height / 2

    // Drag from center to the right
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 100, centerY)
    await page.mouse.up()

    // Wait for any animations
    await page.waitForTimeout(1000)

    // Check for errors
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null')
    )

    expect(nullErrors).toHaveLength(0)
  })

  test('should handle board operations without null errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
    })

    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Call internal methods that were problematic
    await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Test methods that had null reference issues
      const board = gameScene.boardState.getRawBoard()

      // This should not throw errors anymore
      gameScene.saveInitialBoardState()
      gameScene.createBoardSnapshot()

      return true
    })

    await page.waitForTimeout(500)

    // Check for errors
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null')
    )

    expect(nullErrors).toHaveLength(0)
  })
})
