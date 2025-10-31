import { test, expect } from '@playwright/test'

test('horizontal rocket clears its row when triggered', async ({ page }) => {
  await page.goto('/')

  // wait for Phaser and the GameScene to be available
  await page.waitForFunction(() => Boolean((window as any).game && (window as any).game.scene && (window as any).game.scene.keys['GameScene']))

  // run everything inside the page to access the scene and board objects directly
  const result = await page.evaluate(async () => {
    // grab the scene
    const scene = (window as any).game.scene.keys['GameScene'] as any

    // load a deterministic test board (tnt-test exists in dev/test boards)
    if (typeof scene.loadTestBoard === 'function') {
      scene.loadTestBoard('tnt-test')
    }

    // spawn a horizontal rocket at row 4 col 4 (center)
    if (typeof scene.spawnPowerup === 'function') {
      scene.spawnPowerup('horizontal-rocket', 4, 4)
    } else {
      // fallback: directly set powerup on the cell
      const cell = scene.board[4][4]
      cell.powerup = 'horizontal-rocket'
    }

    // trigger the power-up by calling the scene method
    // some implementations return a Promise; handle both
    const targetCell = scene.board[4][4]
    const maybePromise = scene.triggerPowerUp(targetCell)
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise
    }

    // collect which cells in row 4 are empty
    const rowEmpty = scene.board[4].map((c: any) => !!c.empty)
    return rowEmpty
  })

  // expect the entire row to be empty (rocket destroys whole row)
  expect(result.every(Boolean)).toBeTruthy()
})
