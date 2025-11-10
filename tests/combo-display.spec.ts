import { test, expect } from '@playwright/test'

test.describe('Combo Display System', () => {
  test('should show green combo display on 2x cascade', async ({ page }) => {
    // Load game with debug mode and a seed that creates cascades
    await page.goto('http://localhost:8000/?debug=true&seed=12345')

    // Wait for game to load
    await page.waitForTimeout(1000)

    // Take a screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/combo-before.png' })

    // Make a move that will create cascades
    // First, let's check what moves are available
    const availableMoves = await page.evaluate(() => {
      // @ts-ignore
      return window.game.scene.scenes[1].getWinningMoves()
    })

    console.log('Available moves:', availableMoves.length)

    if (availableMoves.length > 0) {
      // Make a move by clicking two cells
      const firstMove = availableMoves[0]

      // Get cell positions and click them
      const cell1Pos = await page.evaluate((cell) => {
        const CELL_SIZE = 65
        const MENU_WIDTH = 200
        return {
          x: MENU_WIDTH + cell.column * CELL_SIZE + CELL_SIZE / 2,
          y: cell.row * CELL_SIZE + CELL_SIZE / 2
        }
      }, firstMove.cell1)

      const cell2Pos = await page.evaluate((cell) => {
        const CELL_SIZE = 65
        const MENU_WIDTH = 200
        return {
          x: MENU_WIDTH + cell.column * CELL_SIZE + CELL_SIZE / 2,
          y: cell.row * CELL_SIZE + CELL_SIZE / 2
        }
      }, firstMove.cell2)

      // Click first cell
      await page.mouse.click(cell1Pos.x, cell1Pos.y)

      // Click second cell
      await page.mouse.click(cell2Pos.x, cell2Pos.y)

      // Wait for animations and cascades
      await page.waitForTimeout(3000)

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

  test('should display combo particles at top-middle of board', async ({ page }) => {
    await page.goto('http://localhost:8000/?debug=true')

    // Wait for game to load
    await page.waitForTimeout(1000)

    // Manually trigger a 2x combo to see the green particles
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.updateComboDisplay(2)
    })

    // Wait for animation
    await page.waitForTimeout(500)

    // Take screenshot showing the green combo display
    await page.screenshot({ path: 'tests/screenshots/combo-green-2x.png' })

    // Trigger 3x combo (yellow)
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.updateComboDisplay(3)
    })

    await page.waitForTimeout(500)
    await page.screenshot({ path: 'tests/screenshots/combo-yellow-3x.png' })

    // Trigger 5x combo (red)
    await page.evaluate(() => {
      // @ts-ignore
      const gameScene = window.game.scene.scenes[1]
      gameScene.updateComboDisplay(5)
    })

    await page.waitForTimeout(500)
    await page.screenshot({ path: 'tests/screenshots/combo-red-5x.png' })
  })

  test('should show combo display position', async ({ page }) => {
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
