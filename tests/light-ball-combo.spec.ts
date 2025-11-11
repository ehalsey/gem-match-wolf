import { test, expect } from '@playwright/test'

test.describe('Light Ball (Color Bomb) Combos', () => {
  test('light-ball + light-ball should clear entire board', async ({ page }) => {
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

    // Spawn two light-balls adjacent to each other and swap them
    const result = await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1] as any

      // Load a test board for consistency
      if (typeof gameScene.loadTestBoard === 'function') {
        gameScene.loadTestBoard('tnt-test')
      }

      // Spawn two light-balls next to each other (row 4, columns 3 and 4)
      if (typeof gameScene.spawnPowerup === 'function') {
        gameScene.spawnPowerup('light-ball', 4, 3)
        gameScene.spawnPowerup('light-ball', 4, 4)
      } else {
        gameScene.board[4][3].powerup = 'light-ball'
        gameScene.board[4][4].powerup = 'light-ball'
      }

      // Count non-empty cells before combo
      let cellsBeforeCombo = 0
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (!gameScene.board[row][col].empty) {
            cellsBeforeCombo++
          }
        }
      }

      // Trigger the combo by swapping the two light-balls
      const firstCell = gameScene.board[4][3]
      const secondCell = gameScene.board[4][4]

      // Manually trigger the combo
      const maybePromise = gameScene.triggerLightBallLightBallCombo(firstCell, secondCell)
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
      }

      // Wait a bit for destruction to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Count empty cells after combo
      let emptyCellsAfter = 0
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (gameScene.board[row][col].empty) {
            emptyCellsAfter++
          }
        }
      }

      return {
        cellsBeforeCombo,
        emptyCellsAfter,
        totalCells: 64
      }
    })

    console.log('Light-ball + Light-ball combo result:', result)

    // Verify board had gems before
    expect(result.cellsBeforeCombo).toBeGreaterThan(0)

    // Verify entire board is cleared (all 64 cells should be empty)
    expect(result.emptyCellsAfter).toBe(result.totalCells)
  })

  test('light-ball + light-ball via swap should clear entire board', async ({ page }) => {
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

    // Set up the board and spawn light-balls
    await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1] as any

      // Load a test board
      if (typeof gameScene.loadTestBoard === 'function') {
        gameScene.loadTestBoard('tnt-test')
      }

      // Spawn two light-balls next to each other
      if (typeof gameScene.spawnPowerup === 'function') {
        gameScene.spawnPowerup('light-ball', 4, 3)
        gameScene.spawnPowerup('light-ball', 4, 4)
      }
    })

    await page.waitForTimeout(500)

    // Calculate click positions
    const positions = await page.evaluate(() => {
      const CELL_SIZE = 65
      const MENU_WIDTH = 200
      return {
        cell1: {
          x: MENU_WIDTH + 3 * CELL_SIZE + CELL_SIZE / 2, // column 3
          y: 4 * CELL_SIZE + CELL_SIZE / 2 // row 4
        },
        cell2: {
          x: MENU_WIDTH + 4 * CELL_SIZE + CELL_SIZE / 2, // column 4
          y: 4 * CELL_SIZE + CELL_SIZE / 2 // row 4
        }
      }
    })

    // Perform the swap by clicking
    await page.mouse.click(positions.cell1.x, positions.cell1.y)
    await page.waitForTimeout(300)
    await page.mouse.click(positions.cell2.x, positions.cell2.y)

    // Wait for combo animations to complete
    await page.waitForTimeout(2000)

    // Take screenshot to verify
    await page.screenshot({ path: 'tests/screenshots/light-ball-double-combo.png' })

    // Check that board is cleared
    const result = await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1] as any

      let emptyCells = 0
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (gameScene.board[row][col].empty) {
            emptyCells++
          }
        }
      }

      return { emptyCells, totalCells: 64 }
    })

    console.log('Board state after swap:', result)

    // Verify entire board is cleared
    expect(result.emptyCells).toBe(result.totalCells)
  })
})
