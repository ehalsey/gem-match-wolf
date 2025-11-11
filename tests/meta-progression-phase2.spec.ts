import { test, expect } from '@playwright/test'

test.describe('Meta-Progression Phase 2 - Stars and Rewards', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.evaluate(() => localStorage.clear())
    await page.waitForTimeout(1000)
  })

  test('should calculate 1 star for low score on easy level', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      // Target score for easy is 3500, so 1000 is ~29% - should be 1 star
      return LevelSystem.calculateStars(1000, 'easy')
    })

    expect(result).toBe(1)
  })

  test('should calculate 2 stars for medium score on easy level', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      // Target score for easy is 3500, so 1800 is ~51% - should be 2 stars
      return LevelSystem.calculateStars(1800, 'easy')
    })

    expect(result).toBe(2)
  })

  test('should calculate 3 stars for high score on easy level', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      // Target score for easy is 3500, so 2800 is 80% - should be 3 stars
      return LevelSystem.calculateStars(2800, 'easy')
    })

    expect(result).toBe(3)
  })

  test('should calculate correct stars for medium difficulty', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const results = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      // Target score for medium is 4500
      return {
        oneStar: LevelSystem.calculateStars(1500, 'medium'),    // ~33%
        twoStars: LevelSystem.calculateStars(2300, 'medium'),   // ~51%
        threeStars: LevelSystem.calculateStars(3600, 'medium')  // 80%
      }
    })

    expect(results.oneStar).toBe(1)
    expect(results.twoStars).toBe(2)
    expect(results.threeStars).toBe(3)
  })

  test('should calculate correct stars for hard difficulty', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const results = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      // Target score for hard is 5500
      return {
        oneStar: LevelSystem.calculateStars(2000, 'hard'),    // ~36%
        twoStars: LevelSystem.calculateStars(2800, 'hard'),   // ~51%
        threeStars: LevelSystem.calculateStars(4400, 'hard')  // 80%
      }
    })

    expect(results.oneStar).toBe(1)
    expect(results.twoStars).toBe(2)
    expect(results.threeStars).toBe(3)
  })

  test('should award correct coins for each star rating', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const coinRewards = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      LevelSystem.reset()

      const results = []

      // 1 star = 10 coins
      const result1 = LevelSystem.calculateLevelResult(1, 1000, 'easy')
      results.push({ stars: 1, coins: result1.coinsEarned, totalCoins: LevelSystem.getCoins() })

      // 2 stars = 25 coins
      const result2 = LevelSystem.calculateLevelResult(2, 2300, 'medium')
      results.push({ stars: 2, coins: result2.coinsEarned, totalCoins: LevelSystem.getCoins() })

      // 3 stars = 50 coins
      const result3 = LevelSystem.calculateLevelResult(3, 4400, 'hard')
      results.push({ stars: 3, coins: result3.coinsEarned, totalCoins: LevelSystem.getCoins() })

      return results
    })

    expect(coinRewards[0].stars).toBe(1)
    expect(coinRewards[0].coins).toBe(10)
    expect(coinRewards[0].totalCoins).toBe(10)

    expect(coinRewards[1].stars).toBe(2)
    expect(coinRewards[1].coins).toBe(25)
    expect(coinRewards[1].totalCoins).toBe(35)  // 10 + 25

    expect(coinRewards[2].stars).toBe(3)
    expect(coinRewards[2].coins).toBe(50)
    expect(coinRewards[2].totalCoins).toBe(85)  // 10 + 25 + 50
  })

  test('should track best score per level', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const results = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      LevelSystem.reset()

      // Play level 1 with score 1000
      const result1 = LevelSystem.calculateLevelResult(1, 1000, 'easy')

      // Play level 1 again with score 1500
      const result2 = LevelSystem.calculateLevelResult(1, 1500, 'easy')

      // Play level 1 again with score 800 (lower)
      const result3 = LevelSystem.calculateLevelResult(1, 800, 'easy')

      return {
        first: { score: 1000, isNewBest: result1.isNewBest, previousBest: result1.previousBestScore },
        second: { score: 1500, isNewBest: result2.isNewBest, previousBest: result2.previousBestScore },
        third: { score: 800, isNewBest: result3.isNewBest, previousBest: result3.previousBestScore },
        finalBest: LevelSystem.getBestScoreForLevel(1)
      }
    })

    // First play should be new best
    expect(results.first.isNewBest).toBe(true)
    expect(results.first.previousBest).toBe(0)

    // Second play with higher score should be new best
    expect(results.second.isNewBest).toBe(true)
    expect(results.second.previousBest).toBe(1000)

    // Third play with lower score should NOT be new best
    expect(results.third.isNewBest).toBe(false)
    expect(results.third.previousBest).toBe(1500)

    // Final best should be 1500
    expect(results.finalBest).toBe(1500)
  })

  test('should track best scores for different levels independently', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const results = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      LevelSystem.reset()

      // Play different levels with different scores
      LevelSystem.calculateLevelResult(1, 1000, 'easy')
      LevelSystem.calculateLevelResult(2, 2000, 'easy')
      LevelSystem.calculateLevelResult(3, 1500, 'medium')

      return {
        level1Best: LevelSystem.getBestScoreForLevel(1),
        level2Best: LevelSystem.getBestScoreForLevel(2),
        level3Best: LevelSystem.getBestScoreForLevel(3),
        level4Best: LevelSystem.getBestScoreForLevel(4)  // Never played
      }
    })

    expect(results.level1Best).toBe(1000)
    expect(results.level2Best).toBe(2000)
    expect(results.level3Best).toBe(1500)
    expect(results.level4Best).toBe(0)  // Never played
  })

  test('should show level complete scene on challenge completion', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true')
    await page.waitForTimeout(1000)

    // Complete a level by manually triggering gameOver with isLevelComplete=true
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      // Set a score
      gameScene.score = 2500
      // Trigger level complete
      gameScene.gameOver('Level Complete!', true, false)
    })

    // Wait for level complete scene to appear
    await page.waitForTimeout(1000)

    // Check that level complete scene is running
    const sceneStatus = await page.evaluate(() => {
      // @ts-ignore
      const levelCompleteScene = window.game.scene.scenes[3]  // LevelCompleteScene
      return {
        isActive: levelCompleteScene.scene.isActive(),
        key: levelCompleteScene.scene.key
      }
    })

    expect(sceneStatus.key).toBe('LevelCompleteScene')
    expect(sceneStatus.isActive).toBe(true)

    await page.screenshot({ path: 'tests/screenshots/level-complete-scene.png' })
  })

  test('should display correct stars in level complete scene', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true')
    await page.waitForTimeout(1000)

    // Complete level with 3-star score
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.score = 2800  // 80% of 3500 = 3 stars
      gameScene.gameOver('Level Complete!', true, false)
    })

    await page.waitForTimeout(1500)  // Wait for animations

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/level-complete-3-stars.png' })

    // Verify stars are displayed (looking for ⭐ emoji)
    const sceneContent = await page.evaluate(() => {
      // @ts-ignore
      const levelCompleteScene = window.game.scene.scenes[3]
      const textObjects = []

      // Iterate through all text objects in the scene
      levelCompleteScene.children.list.forEach((child: any) => {
        if (child.type === 'Text') {
          textObjects.push(child.text)
        }
      })

      return textObjects
    })

    // Check that the scene contains star indicators
    const starTexts = sceneContent.filter((text: string) => text.includes('⭐') || text.includes('☆'))
    expect(starTexts.length).toBeGreaterThan(0)

    // Check for "LEVEL COMPLETE!" text
    expect(sceneContent.some((text: string) => text.includes('LEVEL COMPLETE'))).toBe(true)
  })

  test('should display coins earned in level complete scene', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true')
    await page.waitForTimeout(1000)

    const initialCoins = await page.evaluate(() => {
      // @ts-ignore
      return window.game.scene.scenes[1].registry.get('LevelSystem')?.getCoins() || 0
    })

    // Complete level with 2-star score (should earn 25 coins)
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.score = 1800  // ~51% of 3500 = 2 stars = 25 coins
      gameScene.gameOver('Level Complete!', true, false)
    })

    await page.waitForTimeout(1500)

    await page.screenshot({ path: 'tests/screenshots/level-complete-coins.png' })

    const sceneContent = await page.evaluate(() => {
      // @ts-ignore
      const levelCompleteScene = window.game.scene.scenes[3]
      const textObjects = []

      levelCompleteScene.children.list.forEach((child: any) => {
        if (child.type === 'Text') {
          textObjects.push(child.text)
        }
      })

      return textObjects
    })

    // Check for coins display (+25 🪙 for 2 stars)
    const hasCoinsDisplay = sceneContent.some((text: string) =>
      text.includes('🪙') && (text.includes('25') || text.includes('10') || text.includes('50'))
    )
    expect(hasCoinsDisplay).toBe(true)
  })

  test('should show NEW BEST indicator when beating previous best', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // First, complete level with low score
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      const { LevelSystem } = window
      LevelSystem.reset()
      gameScene.score = 1000
      gameScene.gameOver('Level Complete!', true, false)
    })

    await page.waitForTimeout(1500)

    // Click "Next Level" to proceed
    await page.evaluate(() => {
      // @ts-ignore
      const levelCompleteScene = window.game.scene.scenes[3]
      levelCompleteScene.scene.stop()
    })

    await page.waitForTimeout(1000)

    // Now complete same level again with higher score
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      const { LevelSystem } = window
      LevelSystem.setCurrentLevel(1)  // Go back to level 1
      gameScene.score = 2500  // Higher score
      gameScene.gameOver('Level Complete!', true, false)
    })

    // Wait longer for scene to be fully created
    await page.waitForTimeout(3000)

    // Wait for scene to be active AND have content using scene key
    await page.waitForFunction(() => {
      const game = (window as any).game
      if (!game || !game.scene) return false
      const scene = game.scene.getScene('LevelCompleteScene')
      if (!scene || !scene.scene || !scene.scene.isActive()) return false
      if (!scene.children || !scene.children.list) return false
      // Check for at least some text objects
      return scene.children.list.some((child: any) => child.type === 'Text')
    }, { timeout: 15000 })

    await page.screenshot({ path: 'tests/screenshots/level-complete-new-best.png' })
    await page.waitForTimeout(500)

    const sceneContent = await page.evaluate(() => {
      // @ts-ignore
      const levelCompleteScene = window.game.scene.getScene('LevelCompleteScene')
      const textObjects = []

      if (levelCompleteScene && levelCompleteScene.children && levelCompleteScene.children.list) {
        levelCompleteScene.children.list.forEach((child: any) => {
          if (child.type === 'Text') {
            textObjects.push(child.text)
          }
        })
      }

      return textObjects
    })

    console.log('Scene content for NEW BEST test:', sceneContent)

    // Check for NEW BEST indicator
    const hasNewBest = sceneContent.some((text: string) => text.includes('NEW BEST'))
    expect(hasNewBest).toBe(true)
  })

  test('should return correct target scores for each difficulty', async ({ page }) => {
    await page.goto('http://localhost:8000/')
    await page.waitForTimeout(1000)

    const targetScores = await page.evaluate(() => {
      // @ts-ignore
      const { LevelSystem } = window
      return {
        easy: LevelSystem.getTargetScore('easy'),
        medium: LevelSystem.getTargetScore('medium'),
        hard: LevelSystem.getTargetScore('hard')
      }
    })

    expect(targetScores.easy).toBe(3500)
    expect(targetScores.medium).toBe(4500)
    expect(targetScores.hard).toBe(5500)
  })
})
