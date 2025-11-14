import { test, expect } from '@playwright/test'

test.describe('Analytics Level Tracking', () => {
  test('should track level attempt on completion', async ({ page }) => {
    // Track API calls
    const trackLevelCalls: any[] = []

    await page.route('**/api/track-level', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()
      trackLevelCalls.push(postData)

      // Mock successful response
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Level attempt tracked'
        })
      })
    })

    // Navigate to game
    await page.goto('http://localhost:8000')
    await page.waitForTimeout(2000) // Wait for game to load

    // Complete level using game methods
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Set challenge to something easy to complete
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 5,
        currentValue: 5 // Already complete
      }

      // Trigger level complete
      gameScene.checkLevelCompletion()

      // Wait a bit for async tracking
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    // Wait for API call
    await page.waitForTimeout(1000)

    // Verify analytics was tracked
    expect(trackLevelCalls.length).toBeGreaterThan(0)

    const attemptData = trackLevelCalls[0]

    // Verify required fields
    expect(attemptData).toHaveProperty('levelNumber')
    expect(attemptData).toHaveProperty('challengeType')
    expect(attemptData).toHaveProperty('success')
    expect(attemptData).toHaveProperty('movesTaken')
    expect(attemptData).toHaveProperty('movesRemaining')
    expect(attemptData).toHaveProperty('duration')
    expect(attemptData).toHaveProperty('finalProgress')
    expect(attemptData).toHaveProperty('powerUpsUsed')
    expect(attemptData).toHaveProperty('comboMaxChain')
    expect(attemptData).toHaveProperty('finalScore')
    expect(attemptData).toHaveProperty('gameVersion')

    // Verify data types
    expect(typeof attemptData.levelNumber).toBe('number')
    expect(typeof attemptData.success).toBe('boolean')
    expect(typeof attemptData.duration).toBe('number')
    expect(typeof attemptData.finalProgress).toBe('number')

    // Verify successful completion
    expect(attemptData.success).toBe(true)
    expect(attemptData.finalProgress).toBe(100)

    console.log('[Analytics Test] Tracked level attempt:', attemptData)
  })

  test('should track failed level attempt', async ({ page }) => {
    const trackLevelCalls: any[] = []

    await page.route('**/api/track-level', async (route) => {
      const postData = route.request().postDataJSON()
      trackLevelCalls.push(postData)

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Level attempt tracked' })
      })
    })

    await page.goto('http://localhost:8000')
    await page.waitForTimeout(2000)

    // Fail level by running out of moves
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Set challenge that's not complete
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 100,
        currentValue: 30 // 30% progress
      }

      // Set moves to 0
      gameScene.moves = 0

      // Trigger level check (should fail)
      gameScene.checkLevelCompletion()

      await new Promise(resolve => setTimeout(resolve, 500))
    })

    await page.waitForTimeout(1000)

    expect(trackLevelCalls.length).toBeGreaterThan(0)

    const attemptData = trackLevelCalls[0]

    // Verify failed state
    expect(attemptData.success).toBe(false)
    expect(attemptData.movesRemaining).toBe(0)
    expect(attemptData.finalProgress).toBeLessThan(100)

    console.log('[Analytics Test] Tracked failed attempt:', attemptData)
  })

  test('should queue attempts when network fails', async ({ page }) => {
    let callCount = 0

    await page.route('**/api/track-level', async (route) => {
      callCount++
      // Simulate network error
      await route.abort('failed')
    })

    await page.goto('http://localhost:8000')
    await page.waitForTimeout(2000)

    // Complete level (should fail to track and queue)
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 5,
        currentValue: 5
      }

      gameScene.checkLevelCompletion()
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    await page.waitForTimeout(1000)

    // Check that attempt was queued in localStorage
    const queuedAttempts = await page.evaluate(() => {
      const queueJson = localStorage.getItem('levelAttemptQueue')
      return queueJson ? JSON.parse(queueJson) : []
    })

    expect(queuedAttempts.length).toBeGreaterThan(0)
    expect(queuedAttempts[0]).toHaveProperty('levelNumber')
    expect(queuedAttempts[0]).toHaveProperty('success')

    console.log('[Analytics Test] Queued attempt after network failure:', queuedAttempts[0])
  })

  test('should track combo chain maximum', async ({ page }) => {
    const trackLevelCalls: any[] = []

    await page.route('**/api/track-level', async (route) => {
      trackLevelCalls.push(route.request().postDataJSON())
      await route.fulfill({ status: 201, body: JSON.stringify({ success: true }) })
    })

    await page.goto('http://localhost:8000')
    await page.waitForTimeout(2000)

    // Simulate combo chains
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Trigger combo updates
      gameScene.updateComboDisplay(2)
      gameScene.updateComboDisplay(5)
      gameScene.updateComboDisplay(3) // Max should be 5

      // Complete level
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 5,
        currentValue: 5
      }

      gameScene.checkLevelCompletion()
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    await page.waitForTimeout(1000)

    expect(trackLevelCalls.length).toBeGreaterThan(0)
    expect(trackLevelCalls[0].comboMaxChain).toBe(5)
  })
})
