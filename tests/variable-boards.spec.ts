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
