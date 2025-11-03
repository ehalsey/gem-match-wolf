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

test('vertical rocket + vertical rocket combo clears column and row', async ({ page }) => {
  await page.goto('/')

  // wait for Phaser and the GameScene to be available
  await page.waitForFunction(() => Boolean((window as any).game && (window as any).game.scene && (window as any).game.scene.keys['GameScene']))

  // run everything inside the page to access the scene and board objects directly
  const result = await page.evaluate(async () => {
    // grab the scene
    const scene = (window as any).game.scene.keys['GameScene'] as any

    // load a deterministic test board
    if (typeof scene.loadTestBoard === 'function') {
      scene.loadTestBoard('tnt-test')
    }

    // spawn two vertical rockets vertically adjacent to each other
    // First rocket at row 3, col 4
    // Second rocket at row 4, col 4 (directly below the first)
    if (typeof scene.spawnPowerup === 'function') {
      scene.spawnPowerup('vertical-rocket', 3, 4)
      scene.spawnPowerup('vertical-rocket', 4, 4)
    } else {
      // fallback: directly set powerups on the cells
      scene.board[3][4].powerup = 'vertical-rocket'
      scene.board[4][4].powerup = 'vertical-rocket'
    }

    const firstCell = scene.board[3][4]
    const secondCell = scene.board[4][4]

    // Trigger the combo: first rocket clears column, second clears row
    const maybePromise = scene.triggerVerticalRocketCombo(firstCell, secondCell)
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise
    }

    // collect which cells in column 4 are empty (should all be empty)
    const columnEmpty = scene.board.map((row: any) => !!row[4].empty)

    // collect which cells in row 4 are empty (should all be empty)
    const rowEmpty = scene.board[4].map((c: any) => !!c.empty)

    return {
      columnEmpty,
      rowEmpty
    }
  })

  // expect the entire column 4 to be empty (first vertical rocket)
  expect(result.columnEmpty.every(Boolean)).toBeTruthy()

  // expect the entire row 4 to be empty (second rocket triggered as horizontal)
  expect(result.rowEmpty.every(Boolean)).toBeTruthy()
})

test('horizontal rocket + horizontal rocket combo clears row and column', async ({ page }) => {
  await page.goto('/')

  // wait for Phaser and the GameScene to be available
  await page.waitForFunction(() => Boolean((window as any).game && (window as any).game.scene && (window as any).game.scene.keys['GameScene']))

  // run everything inside the page to access the scene and board objects directly
  const result = await page.evaluate(async () => {
    // grab the scene
    const scene = (window as any).game.scene.keys['GameScene'] as any

    // load a deterministic test board
    if (typeof scene.loadTestBoard === 'function') {
      scene.loadTestBoard('tnt-test')
    }

    // spawn two horizontal rockets horizontally adjacent to each other
    // First rocket at row 4, col 3
    // Second rocket at row 4, col 4 (directly to the right of the first)
    if (typeof scene.spawnPowerup === 'function') {
      scene.spawnPowerup('horizontal-rocket', 4, 3)
      scene.spawnPowerup('horizontal-rocket', 4, 4)
    } else {
      // fallback: directly set powerups on the cells
      scene.board[4][3].powerup = 'horizontal-rocket'
      scene.board[4][4].powerup = 'horizontal-rocket'
    }

    const firstCell = scene.board[4][3]
    const secondCell = scene.board[4][4]

    // Trigger the combo: first rocket clears row, second clears column
    const maybePromise = scene.triggerHorizontalRocketCombo(firstCell, secondCell)
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise
    }

    // collect which cells in row 4 are empty (should all be empty)
    const rowEmpty = scene.board[4].map((c: any) => !!c.empty)

    // collect which cells in column 4 are empty (should all be empty)
    const columnEmpty = scene.board.map((row: any) => !!row[4].empty)

    return {
      rowEmpty,
      columnEmpty
    }
  })

  // expect the entire row 4 to be empty (first horizontal rocket)
  expect(result.rowEmpty.every(Boolean)).toBeTruthy()

  // expect the entire column 4 to be empty (second rocket triggered as vertical)
  expect(result.columnEmpty.every(Boolean)).toBeTruthy()
})
