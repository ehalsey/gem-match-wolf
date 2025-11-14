import { test, expect } from '@playwright/test'

test.describe('Level 22 Testing', () => {
  test('should load and play level 22 without errors', async ({ page }) => {
    // Collect all errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('Console error:', msg.text())
      }
    })

    page.on('pageerror', error => {
      errors.push(error.message)
      console.log('Page error:', error.message)
    })

    // Navigate to the game
    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Jump to level 22 using LevelSystem
    await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]
      const LevelSystem = (window as any).LevelSystem

      LevelSystem.setCurrentLevel(22)
      gameScene.loadNextLevel()
    })

    // Wait for level to load
    await page.waitForTimeout(3000)

    // Try to make a move
    const canvas = await page.locator('canvas')
    const boundingBox = await canvas.boundingBox()

    if (!boundingBox) {
      throw new Error('Canvas not found')
    }

    const centerX = boundingBox.x + boundingBox.width / 2
    const centerY = boundingBox.y + boundingBox.height / 2

    // Simulate a drag
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 100, centerY)
    await page.mouse.up()

    await page.waitForTimeout(2000)

    // Check for null reference errors
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null') ||
      err.includes('null is not an object')
    )

    if (nullErrors.length > 0) {
      console.error('Null errors found on level 22:', nullErrors)
    }

    expect(nullErrors).toHaveLength(0)
  })

  test('should check level 22 configuration', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const level22Config = await page.evaluate(() => {
      const LevelSystem = (window as any).LevelSystem
      const config = LevelSystem.getLevelConfig(22)

      return {
        hasBoardConfig: !!config.boardConfig,
        boardWidth: config.boardConfig?.width,
        boardHeight: config.boardConfig?.height,
        boardShape: config.boardConfig?.shape,
        challengeType: config.challenge.type,
        moves: config.moves
      }
    })

    console.log('Level 22 config:', level22Config)

    // Check if it has a custom board configuration (diamond shape)
    expect(level22Config.hasBoardConfig).toBe(true)
    expect(level22Config.boardShape).toBe('diamond')
    expect(level22Config.boardWidth).toBe(9)
    expect(level22Config.boardHeight).toBe(9)
  })
})
