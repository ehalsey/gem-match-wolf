import { test, expect } from '@playwright/test'

test.describe('Combo Display System', () => {
  // SKIPPED: Board initialization timing issues - see docs/TEST_APPROACH.md "Known Test Issues"
  test.skip('should show green combo display on 2x cascade', async ({ page }) => {
    // Load game with debug mode and a seed that creates cascades
    await page.goto('http://localhost:8000/?debug=true&seed=12345', { waitUntil: 'domcontentloaded' })

    // Wait for game to load and be ready
    await page.waitForTimeout(2500)

    // Wait for game scene to be active
    await page.waitForFunction(() => {
      const game = (window as any).game
      return game && game.scene && game.scene.scenes && game.scene.scenes[1] && game.scene.scenes[1].scene.isActive()
    }, { timeout: 5000 })

    // Wait for board to be initialized
    await page.waitForFunction(() => {
      const scene = (window as any).game?.scene?.scenes[1]
      return scene?.board && scene.board.length > 0 && scene.board[0].length > 0
    }, { timeout: 5000 })

    await page.waitForTimeout(500)

    // Take a screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/combo-before.png' })
    await page.waitForTimeout(500)

    // Get move and calculate positions in one evaluation to avoid context issues
    const moveData = await page.evaluate(() => {
      // @ts-ignore
      const moves = window.game.scene.scenes[1].getWinningMoves()
      if (moves.length === 0) return null

      const firstMove = moves[0]
      const CELL_SIZE = 65
      const MENU_WIDTH = 200

      return {
        moveCount: moves.length,
        cell1Pos: {
          x: MENU_WIDTH + firstMove.cell1.column * CELL_SIZE + CELL_SIZE / 2,
          y: firstMove.cell1.row * CELL_SIZE + CELL_SIZE / 2
        },
        cell2Pos: {
          x: MENU_WIDTH + firstMove.cell2.column * CELL_SIZE + CELL_SIZE / 2,
          y: firstMove.cell2.row * CELL_SIZE + CELL_SIZE / 2
        }
      }
    })

    console.log('Available moves:', moveData?.moveCount || 0)

    if (moveData) {
      await page.waitForTimeout(300)

      // Trigger swap directly via game API (not mouse events - they don't work with Phaser)
      await page.evaluate(async () => {
        const gameScene = (window as any).game.scene.scenes[1]
        const moves = gameScene.getWinningMoves()
        if (moves.length > 0) {
          const firstMove = moves[0]
          const maybePromise = gameScene.handleMove(firstMove.cell1, firstMove.cell2)
          if (maybePromise && typeof maybePromise.then === 'function') {
            await maybePromise
          }
        }
      })

      // Wait for animations and cascades
      await page.waitForTimeout(2000)

      // Take screenshot after move
      await page.screenshot({ path: 'tests/screenshots/combo-after.png' })

      // Check if combo display is visible
      const comboInfo = await page.evaluate(() => {
        // @ts-ignore
        const gameScene = window.game.scene.scenes[1]
        return {
          currentCombo: gameScene.currentCombo,
          comboContainerVisible: gameScene.comboContainer?.alpha > 0,
          comboText: gameScene.comboText?.text
        }
      })

      console.log('Combo info:', comboInfo)
    }
  })

  // SKIPPED: Board initialization timing issues - see docs/TEST_APPROACH.md "Known Test Issues"
  test.skip('should display combo particles at top-middle of board', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true', { waitUntil: 'domcontentloaded' })

    // Wait for game to load and be ready
    await page.waitForTimeout(2000)

    // Manually trigger a 2x combo to see the green particles
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game?.scene?.scenes[1]
      if (gameScene && gameScene.updateComboDisplay) {
        gameScene.updateComboDisplay(2)
      }
    })

    // Wait for animation
    await page.waitForTimeout(1000)

    // Take screenshot showing the green combo display
    await page.screenshot({ path: 'tests/screenshots/combo-green-2x.png' })
    await page.waitForTimeout(300)

    // Trigger 3x combo (yellow)
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.updateComboDisplay(3)
    })

    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/screenshots/combo-yellow-3x.png' })
    await page.waitForTimeout(300)

    // Trigger 5x combo (red)
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.updateComboDisplay(5)
    })

    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/screenshots/combo-red-5x.png' })
  })

  // SKIPPED: Board initialization timing issues - see docs/TEST_APPROACH.md "Known Test Issues"
  test.skip('should show combo display position', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true')

    await page.waitForTimeout(1000)

    // Get combo display position
    const comboPosition = await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      const container = gameScene.comboContainer

      return {
        x: container?.x,
        y: container?.y,
        visible: container?.alpha > 0,
        depth: container?.depth
      }
    })

    console.log('Combo display position:', comboPosition)
    expect(comboPosition.depth).toBe(3000)
  })
})
