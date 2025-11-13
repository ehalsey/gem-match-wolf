import { test, expect } from '@playwright/test'

test.describe('Variable Board Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
  })

  test('should render 8x8 board for level 1', async ({ page }) => {
    // Clear localStorage and reload
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for game to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Check board dimensions in game
    const dimensions = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        cellCount: scene.boardState.getAllCells().length,
        currentLevel: (window as any).LevelSystem.getCurrentLevel()
      }
    })

    expect(dimensions.currentLevel).toBe(1)
    expect(dimensions.width).toBe(8)
    expect(dimensions.height).toBe(8)
    expect(dimensions.cellCount).toBe(64)
  })

  test('should render 9x9 board for level 20', async ({ page }) => {
    // Set level to 20 and reload
    await page.evaluate(() => {
      (window as any).LevelSystem.setCurrentLevel(20)
    })
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for game to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Check board dimensions in game
    const dimensions = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        cellCount: scene.boardState.getAllCells().length,
        currentLevel: (window as any).LevelSystem.getCurrentLevel()
      }
    })

    expect(dimensions.currentLevel).toBe(20)
    expect(dimensions.width).toBe(9)
    expect(dimensions.height).toBe(9)
    expect(dimensions.cellCount).toBe(81)
  })

  test('should render octagon board for level 21', async ({ page }) => {
    // Set level to 21 and reload
    await page.evaluate(() => {
      (window as any).LevelSystem.setCurrentLevel(21)
    })
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for game to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Check board dimensions in game
    const dimensions = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        cellCount: scene.boardState.getAllCells().length,
        currentLevel: (window as any).LevelSystem.getCurrentLevel()
      }
    })

    expect(dimensions.currentLevel).toBe(21)
    expect(dimensions.width).toBe(9)
    expect(dimensions.height).toBe(9)
    // Octagon has missing corners, so less than 81 cells
    expect(dimensions.cellCount).toBeLessThan(81)
    expect(dimensions.cellCount).toBeGreaterThan(60) // Should have significant cells
  })

  test('should render diamond board for level 22', async ({ page }) => {
    // Set level to 22 and reload
    await page.evaluate(() => {
      (window as any).LevelSystem.setCurrentLevel(22)
    })
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for game to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Check board dimensions in game
    const dimensions = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        cellCount: scene.boardState.getAllCells().length,
        currentLevel: (window as any).LevelSystem.getCurrentLevel()
      }
    })

    expect(dimensions.currentLevel).toBe(22)
    expect(dimensions.width).toBe(9)
    expect(dimensions.height).toBe(9)
    // Diamond has even more missing corners, so less than octagon
    expect(dimensions.cellCount).toBeLessThan(81)
    expect(dimensions.cellCount).toBeLessThan(70) // Should have fewer cells than octagon
  })
})
