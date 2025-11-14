import { test, expect } from '@playwright/test'

test.describe('Non-Rectangular Test Boards', () => {
  test('should load octagon test board from level 1', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
      console.log('PAGE ERROR:', error.message)
    })

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('CONSOLE ERROR:', msg.text())
      }
    })

    console.log('=== Loading octagon test board ===')

    // Load the game with octagon test board
    await page.goto('http://localhost:8000/?debug=true&board=octagon')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Verify board configuration
    const boardInfo = await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]
      const board = gameScene.boardState.getRawBoard()
      const config = gameScene.boardState.getConfig()

      // Count null cells
      let nullCount = 0
      let validCellCount = 0
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
          if (board[row][col] === null) {
            nullCount++
          } else {
            validCellCount++
          }
        }
      }

      return {
        width: config.width,
        height: config.height,
        shape: config.shape,
        nullCount,
        validCellCount,
        totalCells: board.length * board[0].length,
        // Check specific corners are null (octagon shape)
        topLeftCornerNull: board[0][0] === null,
        topRightCornerNull: board[0][8] === null,
        bottomLeftCornerNull: board[8][0] === null,
        bottomRightCornerNull: board[8][8] === null
      }
    })

    console.log('Board info:', boardInfo)

    // Verify octagon shape
    expect(boardInfo.shape).toBe('octagon')
    expect(boardInfo.width).toBe(9)
    expect(boardInfo.height).toBe(9)
    expect(boardInfo.totalCells).toBe(81)
    expect(boardInfo.nullCount).toBe(24) // Octagon has 24 null cells in corners
    expect(boardInfo.validCellCount).toBe(57)
    expect(boardInfo.topLeftCornerNull).toBe(true)
    expect(boardInfo.topRightCornerNull).toBe(true)
    expect(boardInfo.bottomLeftCornerNull).toBe(true)
    expect(boardInfo.bottomRightCornerNull).toBe(true)

    await page.screenshot({ path: 'test-results/octagon-board.png' })
    console.log('📸 Screenshot saved: test-results/octagon-board.png')

    // Test exportBoard() function
    const boardExport = await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]
      return gameScene.exportBoard()
    })

    console.log('exportBoard() result:', boardExport)

    // Try making a move
    console.log('=== Testing move on octagon board ===')
    const moveResult = await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]
      const board = gameScene.boardState.getRawBoard()

      // Find two adjacent valid cells
      let cell1 = null
      let cell2 = null
      for (let row = 0; row < board.length && !cell1; row++) {
        for (let col = 0; col < board[row].length - 1 && !cell1; col++) {
          if (board[row][col] !== null && board[row][col + 1] !== null) {
            cell1 = board[row][col]
            cell2 = board[row][col + 1]
          }
        }
      }

      if (!cell1 || !cell2) {
        return { success: false, reason: 'No adjacent cells found' }
      }

      // Simulate drag
      gameScene.dragStartCell = cell1
      await gameScene.onDragEnd(cell1.sprite, null, cell2.sprite)

      return {
        success: true,
        cell1: `${cell1.color} at [${cell1.row},${cell1.column}]`,
        cell2: `${cell2.color} at [${cell2.row},${cell2.column}]`
      }
    })

    console.log('Move result:', moveResult)
    await page.waitForTimeout(2000)

    // Check for null reference errors
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null')
    )

    expect(nullErrors).toHaveLength(0)
    console.log('✅ Octagon board test passed - no null errors!')
  })

  test('should load diamond test board from level 1', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
      console.log('PAGE ERROR:', error.message)
    })

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('CONSOLE ERROR:', msg.text())
      }
    })

    console.log('=== Loading diamond test board ===')

    // Load the game with diamond test board
    await page.goto('http://localhost:8000/?debug=true&board=diamond')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Verify board configuration
    const boardInfo = await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]
      const board = gameScene.boardState.getRawBoard()
      const config = gameScene.boardState.getConfig()

      // Count null cells
      let nullCount = 0
      let validCellCount = 0
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
          if (board[row][col] === null) {
            nullCount++
          } else {
            validCellCount++
          }
        }
      }

      return {
        width: config.width,
        height: config.height,
        shape: config.shape,
        nullCount,
        validCellCount,
        totalCells: board.length * board[0].length,
        // Check center cell is valid (diamond shape)
        centerCellValid: board[4][4] !== null,
        // Check corners and edges are null
        topCenterNull: board[0][4] !== null, // Row 0 col 4 should be null in diamond
        bottomCenterNull: board[8][4] !== null // Row 8 col 4 should be null in diamond
      }
    })

    console.log('Board info:', boardInfo)

    // Verify diamond shape
    expect(boardInfo.shape).toBe('diamond')
    expect(boardInfo.width).toBe(9)
    expect(boardInfo.height).toBe(9)
    expect(boardInfo.totalCells).toBe(81)
    expect(boardInfo.nullCount).toBe(40) // Diamond has 40 null cells
    expect(boardInfo.validCellCount).toBe(41)
    expect(boardInfo.centerCellValid).toBe(true)

    await page.screenshot({ path: 'test-results/diamond-board.png' })
    console.log('📸 Screenshot saved: test-results/diamond-board.png')

    // Test exportBoard() function
    const boardExport = await page.evaluate(() => {
      const gameScene = (window as any).game.scene.scenes[1]
      return gameScene.exportBoard()
    })

    console.log('exportBoard() result:', boardExport)

    // Try making a move
    console.log('=== Testing move on diamond board ===')
    const moveResult = await page.evaluate(async () => {
      const gameScene = (window as any).game.scene.scenes[1]
      const board = gameScene.boardState.getRawBoard()

      // Find two adjacent valid cells
      let cell1 = null
      let cell2 = null
      for (let row = 0; row < board.length && !cell1; row++) {
        for (let col = 0; col < board[row].length - 1 && !cell1; col++) {
          if (board[row][col] !== null && board[row][col + 1] !== null) {
            cell1 = board[row][col]
            cell2 = board[row][col + 1]
          }
        }
      }

      if (!cell1 || !cell2) {
        return { success: false, reason: 'No adjacent cells found' }
      }

      // Simulate drag
      gameScene.dragStartCell = cell1
      await gameScene.onDragEnd(cell1.sprite, null, cell2.sprite)

      return {
        success: true,
        cell1: `${cell1.color} at [${cell1.row},${cell1.column}]`,
        cell2: `${cell2.color} at [${cell2.row},${cell2.column}]`
      }
    })

    console.log('Move result:', moveResult)
    await page.waitForTimeout(2000)

    // Check for null reference errors
    const nullErrors = errors.filter(err =>
      err.includes('Cannot read properties of null')
    )

    expect(nullErrors).toHaveLength(0)
    console.log('✅ Diamond board test passed - no null errors!')
  })
})
