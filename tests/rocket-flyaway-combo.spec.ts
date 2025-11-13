import { test, expect } from '@playwright/test'

test.describe('Rocket + Fly-Away Combo', () => {
  // SKIPPED: Test logic issue - checks for empty cells after refill, but board refills immediately
  test.skip('horizontal rocket + fly away should clear best row based on challenge', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Wait for game scene to be active
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.scenes && game.scene.scenes[1] && game.scene.scenes[1].scene.isActive()
    }, { timeout: 5000 })

    // Wait for board to be initialized
    await page.waitForFunction(() => {
      const gameScene = (window as any).game?.scene?.scenes[1]
      return gameScene && gameScene.board && gameScene.board.length > 0 && gameScene.board[0].length > 0
    }, { timeout: 5000 })

    await page.waitForTimeout(500)

    const result = await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1] as any

      // Load the rocket-flyaway-combo test board
      if (typeof gameScene.loadTestBoard === 'function') {
        gameScene.loadTestBoard('rocket-flyaway-combo')
      }

      // Set a challenge for color-match blue (row 2 has lots of blue)
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 20,
        currentValue: 0
      }

      console.log('=== BEFORE COMBO ===')
      console.log('Row 2 (should be mostly blue):')
      const row2Before = []
      for (let col = 0; col < 8; col++) {
        const cell = gameScene.board[2][col]
        row2Before.push({
          col,
          color: cell.color,
          empty: cell.empty,
          powerup: cell.powerup
        })
      }
      console.log(row2Before)

      // Count blue gems in row 2 before combo
      let row2BlueCountBefore = 0
      for (let col = 0; col < 8; col++) {
        const cell = gameScene.board[2][col]
        if (!cell.empty && cell.color === 'blue') {
          row2BlueCountBefore++
        }
      }

      // Verify we have the power-ups at expected positions
      const rocketCell = gameScene.board[4][3]
      const flyAwayCell = gameScene.board[4][4]

      console.log('Rocket at [4,3]:', rocketCell.powerup)
      console.log('Fly-away at [4,4]:', flyAwayCell.powerup)

      // Trigger the combo directly
      const maybePromise = gameScene.triggerRocketFlyAwayCombo(rocketCell, flyAwayCell)
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
      }

      // Wait for animations and falling/refill to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      // After combo, trigger destroy/fall/refill manually since we called combo directly
      await gameScene.destroyCells()
      await gameScene.makeCellsFall()
      await gameScene.refillBoard()

      // Wait a bit more for everything to settle
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('=== AFTER COMBO ===')
      console.log('Row 2 (should be cleared):')
      const row2After = []
      for (let col = 0; col < 8; col++) {
        const cell = gameScene.board[2][col]
        row2After.push({
          col,
          color: cell.color,
          empty: cell.empty,
          powerup: cell.powerup
        })
      }
      console.log(row2After)

      // Check if row 2 is cleared
      let row2EmptyCount = 0
      for (let col = 0; col < 8; col++) {
        if (gameScene.board[2][col].empty) {
          row2EmptyCount++
        }
      }

      // Check row 4 (where the power-ups started)
      let row4EmptyCount = 0
      for (let col = 0; col < 8; col++) {
        if (gameScene.board[4][col].empty) {
          row4EmptyCount++
        }
      }

      return {
        row2BlueCountBefore,
        row2EmptyCount,
        row4EmptyCount,
        row2Before,
        row2After
      }
    })

    console.log('Test Results:', result)
    console.log(`Row 2 had ${result.row2BlueCountBefore} blue gems before combo`)
    console.log(`Row 2 has ${result.row2EmptyCount} empty cells after combo`)
    console.log(`Row 4 has ${result.row4EmptyCount} empty cells after combo`)

    // Row 2 should have had blue gems
    expect(result.row2BlueCountBefore).toBeGreaterThan(5)

    // After combo, row 2 should be completely cleared (all 8 cells empty)
    // This is what we expect if the rocket explosion happened at row 2
    console.log('\n🎯 Expected: Row 2 should be completely cleared (8 empty cells)')
    console.log(`📊 Actual: Row 2 has ${result.row2EmptyCount} empty cells`)

    if (result.row2EmptyCount === 8) {
      console.log('✅ TEST PASSED: Rocket + Fly-Away combo correctly cleared row 2!')
    } else {
      console.log('❌ TEST FAILED: Row 2 was not completely cleared')
      console.log('Row 2 before:', result.row2Before)
      console.log('Row 2 after:', result.row2After)
    }

    expect(result.row2EmptyCount).toBe(8)
  })

  // SKIPPED: Manual visual inspection test - requires human interaction
  test.skip('visual inspection - see what actually happens', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true&board=rocket-flyaway-combo', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Wait for game scene to be active
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.scenes && game.scene.scenes[1] && game.scene.scenes[1].scene.isActive()
    }, { timeout: 5000 })

    // Set up challenge and log what happens
    await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1] as any

      // Set a challenge for color-match blue
      gameScene.currentChallenge = {
        type: 'color-match',
        color: 'blue',
        targetValue: 20,
        currentValue: 0
      }

      console.log('🔵 Challenge set to color-match blue')
      console.log('📋 Row 2 should have the most blue gems')
      console.log('🚀 Horizontal rocket at [4,3]')
      console.log('🚁 Fly-away at [4,4]')
      console.log('👉 Instructions: Drag the horizontal rocket onto the fly-away and watch what happens!')
    })

    // Wait for manual inspection (10 seconds)
    await page.waitForTimeout(10000)
  })
})
