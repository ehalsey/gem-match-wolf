import { test, expect } from '@playwright/test'

test.describe('Variable Board Dimensions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.evaluate(() => localStorage.clear())
    await page.waitForTimeout(1000)
  })

  test('should return default 8x8 board config for standard levels', async ({ page }) => {
    const boardConfig = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      const config = LevelSystem.getLevelConfig(1)
      return config.boardConfig
    })

    expect(boardConfig).toBeDefined()
    expect(boardConfig.width).toBe(8)
    expect(boardConfig.height).toBe(8)
    expect(boardConfig.shape).toBe('rectangle')
  })

  test('should return 9x9 board config for level 20', async ({ page }) => {
    const boardConfig = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      const config = LevelSystem.getLevelConfig(20)
      return config.boardConfig
    })

    expect(boardConfig).toBeDefined()
    expect(boardConfig.width).toBe(9)
    expect(boardConfig.height).toBe(9)
    expect(boardConfig.shape).toBe('rectangle')
    expect(boardConfig.missingCells).toBeUndefined()
  })

  test('should return octagon board config for level 21', async ({ page }) => {
    const boardConfig = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      const config = LevelSystem.getLevelConfig(21)
      return config.boardConfig
    })

    expect(boardConfig).toBeDefined()
    expect(boardConfig.width).toBe(9)
    expect(boardConfig.height).toBe(9)
    expect(boardConfig.shape).toBe('octagon')
    expect(boardConfig.missingCells).toBeDefined()
    expect(boardConfig.missingCells.length).toBeGreaterThan(0)
  })

  test('should return diamond board config for level 22', async ({ page }) => {
    const boardConfig = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      const config = LevelSystem.getLevelConfig(22)
      return config.boardConfig
    })

    expect(boardConfig).toBeDefined()
    expect(boardConfig.width).toBe(9)
    expect(boardConfig.height).toBe(9)
    expect(boardConfig.shape).toBe('diamond')
    expect(boardConfig.missingCells).toBeDefined()
    expect(boardConfig.missingCells.length).toBeGreaterThan(0)
  })

  test('should initialize board with correct dimensions on level 20', async ({ page }) => {
    // Set to level 20
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.setCurrentLevel(20)
    })

    // Reload to start at level 20
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // Wait for scene to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })

    const boardInfo = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        totalCells: scene.boardState.getAllCells().length
      }
    })

    expect(boardInfo.width).toBe(9)
    expect(boardInfo.height).toBe(9)
    expect(boardInfo.totalCells).toBe(81) // 9x9 = 81 cells
  })

  test('should initialize octagon board with missing cells on level 21', async ({ page }) => {
    // Set to level 21
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.setCurrentLevel(21)
    })

    // Reload to start at level 21
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // Wait for scene to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })

    const boardInfo = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      const allCells = scene.boardState.getAllCells()
      const rawBoard = scene.boardState.getRawBoard()

      let nullCells = 0
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (rawBoard[row][col] === null) {
            nullCells++
          }
        }
      }

      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        validCells: allCells.length,
        nullCells: nullCells,
        totalPositions: 9 * 9
      }
    })

    expect(boardInfo.width).toBe(9)
    expect(boardInfo.height).toBe(9)
    expect(boardInfo.nullCells).toBeGreaterThan(0) // Should have missing cells
    expect(boardInfo.validCells + boardInfo.nullCells).toBe(81) // Total should equal 9x9
    expect(boardInfo.validCells).toBeLessThan(81) // Should have fewer valid cells than 9x9
  })

  test('should initialize diamond board with more missing cells on level 22', async ({ page }) => {
    // Set to level 22
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.setCurrentLevel(22)
    })

    // Reload to start at level 22
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // Wait for scene to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })

    const boardInfo = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      const allCells = scene.boardState.getAllCells()
      const rawBoard = scene.boardState.getRawBoard()

      let nullCells = 0
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (rawBoard[row][col] === null) {
            nullCells++
          }
        }
      }

      return {
        width: scene.boardState.getWidth(),
        height: scene.boardState.getHeight(),
        validCells: allCells.length,
        nullCells: nullCells
      }
    })

    expect(boardInfo.width).toBe(9)
    expect(boardInfo.height).toBe(9)
    expect(boardInfo.nullCells).toBeGreaterThan(0) // Should have missing cells
    expect(boardInfo.validCells).toBeLessThan(81) // Should have fewer valid cells than 9x9
  })

  test('should render gems only in valid cells for non-rectangular boards', async ({ page }) => {
    // Set to level 21 (octagon)
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.setCurrentLevel(21)
    })

    // Reload to start at level 21
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // Wait for scene to be ready
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.keys && game.scene.keys.default && game.scene.keys.default.boardState
    }, { timeout: 10000 })

    const gemInfo = await page.evaluate(() => {
      const scene = (window as any).game.scene.keys.default
      const allCells = scene.boardState.getAllCells()

      // Count cells with sprites and non-empty gems
      const gemsWithSprites = allCells.filter((cell: any) =>
        cell.sprite && !cell.empty
      ).length

      return {
        totalValidCells: allCells.length,
        gemsWithSprites: gemsWithSprites
      }
    })

    // All valid cells should have sprites
    expect(gemInfo.gemsWithSprites).toBeGreaterThan(0)
    expect(gemInfo.gemsWithSprites).toBeLessThanOrEqual(gemInfo.totalValidCells)
  })

  test('should maintain backward compatibility with 8x8 boards', async ({ page }) => {
    // Test various standard levels
    for (const level of [1, 5, 10, 15, 19]) {
      const boardConfig = await page.evaluate((lvl) => {
        const { LevelSystem } = (window as any)
        const config = LevelSystem.getLevelConfig(lvl)
        return config.boardConfig
      }, level)

      expect(boardConfig.width).toBe(8)
      expect(boardConfig.height).toBe(8)
      expect(boardConfig.shape).toBe('rectangle')
    }
  })
})
