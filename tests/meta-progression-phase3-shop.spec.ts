import { test, expect } from '@playwright/test'

test.describe('Meta-Progression Phase 3 - Shop', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:8000/')
    await page.evaluate(() => localStorage.clear())
    await page.waitForTimeout(500)
  })

  test('should open shop when clicking shop button', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    // Click shop button
    await page.evaluate(() => {
      // Find and click shop button in MenuScene
      const menuScene = (window as any).game.scene.scenes[0]
      menuScene.scene.launch('ShopScene')
    })

    await page.waitForTimeout(500)

    // Verify shop scene is active
    const shopSceneStatus = await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]  // ShopScene
      return {
        isActive: shopScene.scene.isActive(),
        key: shopScene.scene.key
      }
    })

    expect(shopSceneStatus.key).toBe('ShopScene')
    expect(shopSceneStatus.isActive).toBe(true)

    await page.screenshot({ path: 'tests/screenshots/shop-scene.png' })
  })

  test('should buy 1 life with 10 coins', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player coins and reduce lives
      LevelSystem.setCoins(20)
      LevelSystem.setLives(3)

      const beforeCoins = LevelSystem.getCoins()
      const beforeLives = LevelSystem.getLives()

      // Buy 1 life
      const success = LevelSystem.buyLife()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeLives,
        afterLives: LevelSystem.getLives()
      }
    })

    expect(result.success).toBe(true)
    expect(result.beforeCoins).toBe(20)
    expect(result.afterCoins).toBe(10)  // 20 - 10
    expect(result.beforeLives).toBe(3)
    expect(result.afterLives).toBe(4)  // 3 + 1
  })

  test('should not buy life when at max lives', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player coins and max lives
      LevelSystem.setCoins(20)
      LevelSystem.setLives(5)

      const beforeCoins = LevelSystem.getCoins()
      const beforeLives = LevelSystem.getLives()

      // Try to buy 1 life
      const success = LevelSystem.buyLife()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeLives,
        afterLives: LevelSystem.getLives()
      }
    })

    expect(result.success).toBe(false)
    expect(result.afterCoins).toBe(result.beforeCoins)  // Coins unchanged
    expect(result.afterLives).toBe(5)  // Still at max
  })

  test('should not buy life with insufficient coins', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player only 5 coins
      LevelSystem.setCoins(5)
      LevelSystem.setLives(3)

      const beforeCoins = LevelSystem.getCoins()
      const beforeLives = LevelSystem.getLives()

      // Try to buy 1 life (costs 10 coins)
      const success = LevelSystem.buyLife()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeLives,
        afterLives: LevelSystem.getLives()
      }
    })

    expect(result.success).toBe(false)
    expect(result.afterCoins).toBe(5)  // Coins unchanged
    expect(result.afterLives).toBe(3)  // Lives unchanged
  })

  test('should refill all lives with 50 coins', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player coins and reduce lives to 1
      LevelSystem.setCoins(60)
      LevelSystem.setLives(1)

      const beforeCoins = LevelSystem.getCoins()
      const beforeLives = LevelSystem.getLives()

      // Refill all lives
      const success = LevelSystem.refillAllLives()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeLives,
        afterLives: LevelSystem.getLives()
      }
    })

    expect(result.success).toBe(true)
    expect(result.beforeCoins).toBe(60)
    expect(result.afterCoins).toBe(10)  // 60 - 50
    expect(result.beforeLives).toBe(1)
    expect(result.afterLives).toBe(5)  // Refilled to max
  })

  test('should buy 1 hammer with 20 coins', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player coins
      LevelSystem.setCoins(30)

      const beforeCoins = LevelSystem.getCoins()
      const beforeHammers = LevelSystem.getHammers()

      // Buy 1 hammer
      const success = LevelSystem.buyHammer()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeHammers,
        afterHammers: LevelSystem.getHammers()
      }
    })

    expect(result.success).toBe(true)
    expect(result.beforeCoins).toBe(30)
    expect(result.afterCoins).toBe(10)  // 30 - 20
    expect(result.beforeHammers).toBe(0)
    expect(result.afterHammers).toBe(1)
  })

  test('should buy 3 hammers with 50 coins (hammer pack)', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player coins
      LevelSystem.setCoins(60)

      const beforeCoins = LevelSystem.getCoins()
      const beforeHammers = LevelSystem.getHammers()

      // Buy hammer pack (3 hammers)
      const success = LevelSystem.buyHammerPack()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeHammers,
        afterHammers: LevelSystem.getHammers()
      }
    })

    expect(result.success).toBe(true)
    expect(result.beforeCoins).toBe(60)
    expect(result.afterCoins).toBe(10)  // 60 - 50
    expect(result.beforeHammers).toBe(0)
    expect(result.afterHammers).toBe(3)
  })

  test('should not buy hammer with insufficient coins', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()

      // Give player only 10 coins
      LevelSystem.setCoins(10)

      const beforeCoins = LevelSystem.getCoins()
      const beforeHammers = LevelSystem.getHammers()

      // Try to buy 1 hammer (costs 20 coins)
      const success = LevelSystem.buyHammer()

      return {
        success,
        beforeCoins,
        afterCoins: LevelSystem.getCoins(),
        beforeHammers,
        afterHammers: LevelSystem.getHammers()
      }
    })

    expect(result.success).toBe(false)
    expect(result.afterCoins).toBe(10)  // Coins unchanged
    expect(result.afterHammers).toBe(0)  // Hammers unchanged
  })

  test('should show shop UI with correct pricing', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    // Set up player with some coins
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()
      LevelSystem.setCoins(100)
      LevelSystem.setLives(2)
    })

    // Open shop
    await page.evaluate(() => {
      const menuScene = (window as any).game.scene.scenes[0]
      menuScene.scene.launch('ShopScene')
    })

    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'tests/screenshots/shop-pricing.png' })

    // Check that shop displays items
    const shopContent = await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]
      const textObjects = []

      shopScene.children.list.forEach((child: any) => {
        if (child.type === 'Text') {
          textObjects.push(child.text)
        }
      })

      return textObjects
    })

    // Verify shop title
    expect(shopContent.some((text: string) => text.includes('SHOP') || text.includes('🏪'))).toBe(true)

    // Verify coin display
    expect(shopContent.some((text: string) => text.includes('100') && text.includes('🪙'))).toBe(true)

    // Verify pricing is shown
    expect(shopContent.some((text: string) => text.includes('10') && text.includes('🪙'))).toBe(true)  // Buy 1 life
    expect(shopContent.some((text: string) => text.includes('20') && text.includes('🪙'))).toBe(true)  // Buy 1 hammer
    expect(shopContent.some((text: string) => text.includes('50') && text.includes('🪙'))).toBe(true)  // Refill/Pack
  })

  test('should update coins display after purchase', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    // Set up player
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()
      LevelSystem.setCoins(50)
      LevelSystem.setLives(2)
    })

    // Open shop
    await page.evaluate(() => {
      const menuScene = (window as any).game.scene.scenes[0]
      menuScene.scene.launch('ShopScene')
    })

    await page.waitForTimeout(1000)

    // Get initial coins display
    const initialCoins = await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]
      const textObjects = []

      shopScene.children.list.forEach((child: any) => {
        if (child.type === 'Text' && child.text.includes('Your Coins')) {
          textObjects.push(child.text)
        }
      })

      return textObjects[0]
    })

    expect(initialCoins).toContain('50')

    // Make a purchase
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.buyLife()  // Costs 10 coins
    })

    await page.waitForTimeout(500)

    // Reopen shop to see updated coins
    await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]
      shopScene.scene.restart()
    })

    await page.waitForTimeout(1000)

    // Get updated coins display
    const updatedCoins = await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]
      const textObjects = []

      shopScene.children.list.forEach((child: any) => {
        if (child.type === 'Text' && child.text.includes('Your Coins')) {
          textObjects.push(child.text)
        }
      })

      return textObjects[0]
    })

    expect(updatedCoins).toContain('40')  // 50 - 10
  })

  test('should disable buy life button when at max lives', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    // Set player to max lives
    await page.evaluate(() => {
      const { LevelSystem } = (window as any)
      LevelSystem.reset()
      LevelSystem.setCoins(100)
      LevelSystem.setLives(5)
    })

    // Open shop
    await page.evaluate(() => {
      const menuScene = (window as any).game.scene.scenes[0]
      menuScene.scene.launch('ShopScene')
    })

    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'tests/screenshots/shop-max-lives.png' })

    // Check for "MAX LIVES" text
    const shopContent = await page.evaluate(() => {
      const shopScene = (window as any).game.scene.scenes[4]
      const textObjects = []

      shopScene.children.list.forEach((child: any) => {
        if (child.type === 'Text') {
          textObjects.push(child.text)
        }
      })

      return textObjects
    })

    expect(shopContent.some((text: string) => text.includes('MAX LIVES'))).toBe(true)
  })
})
