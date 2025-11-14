import { test, expect } from '@playwright/test'

test.describe('Analytics Integration', () => {
  test('should track level completion with real API', async ({ page }) => {
    // Intercept the analytics API call
    let analyticsCallMade = false
    let requestBody: any = null

    await page.route('**/api/track-level', async route => {
      analyticsCallMade = true
      const request = route.request()
      requestBody = JSON.parse(request.postData() || '{}')

      // Respond with success
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Level attempt tracked' })
      })
    })

    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Simulate completing a level by calling the game method directly
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Set up a simple level completion scenario
      gameScene.score = 1000
      gameScene.moves = 20
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 10,
        currentValue: 10,
        isCompleted: true
      }

      // Track the level attempt
      await gameScene.checkLevelCompletion()
    })

    // Wait for the API call
    await page.waitForTimeout(2000)

    // Verify analytics call was made
    expect(analyticsCallMade).toBe(true)
    expect(requestBody).toBeTruthy()

    // Verify the request body has the right structure
    if (requestBody) {
      expect(requestBody.levelNumber).toBeDefined()
      expect(requestBody.success).toBeDefined()
      expect(requestBody.finalScore).toBeDefined()
      expect(requestBody.movesTaken).toBeDefined()
      expect(requestBody.challengeType).toBeDefined()
      expect(requestBody.gameVersion).toBeDefined()
    }
  })

  test('should track level failure with real API', async ({ page }) => {
    let analyticsCallMade = false
    let requestBody: any = null

    await page.route('**/api/track-level', async route => {
      analyticsCallMade = true
      const request = route.request()
      requestBody = JSON.parse(request.postData() || '{}')

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Level attempt tracked' })
      })
    })

    await page.goto('http://localhost:8000')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Simulate failing a level
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]

      // Set up a failed level scenario
      gameScene.score = 500
      gameScene.moves = 0 // Out of moves
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'red',
        targetValue: 20,
        currentValue: 10,
        isCompleted: false
      }

      // Trigger game over
      await gameScene.gameOver('Out of Moves', false)
    })

    // Wait for the API call
    await page.waitForTimeout(2000)

    // Verify analytics call was made
    expect(analyticsCallMade).toBe(true)
    expect(requestBody).toBeTruthy()

    // Verify it's marked as a failure
    if (requestBody) {
      expect(requestBody.success).toBe(false)
      expect(requestBody.finalProgress).toBeLessThan(100)
    }
  })
})
