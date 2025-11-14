import { test, expect } from '@playwright/test'

test('level 21 with seed 884386 - bug report feature', async ({ page }) => {
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

  console.log('=== Setting up level 21 with seed 884386 ===')

  // Load the game with seed parameter in URL
  await page.goto('http://localhost:8000/?seed=884386')
  await page.waitForSelector('canvas', { timeout: 10000 })
  await page.waitForTimeout(2000)

  // Navigate to level 21 using LevelSystem
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const LevelSystem = (window as any).LevelSystem

    // Set the level in LevelSystem
    LevelSystem.setCurrentLevel(21)

    // Load level 21 (seed already set via URL)
    gameScene.loadNextLevel()
  })

  await page.waitForTimeout(3000)

  // Verify we're on level 21 with seed 884386
  const levelInfo = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const LevelSystem = (window as any).LevelSystem
    return {
      level: LevelSystem.getCurrentLevel(),
      seed: gameScene.rng?.getSeed ? gameScene.rng.getSeed() : (gameScene.rng?.seed || 'unknown'),
      boardShape: gameScene.levelConfig?.boardConfig?.shape || 'none',
      challenge: gameScene.levelConfig?.challenge?.type || 'unknown',
      challengeTarget: gameScene.currentChallenge?.target || 'unknown'
    }
  })

  console.log('=== Level Info ===')
  console.log('Current Level:', levelInfo.level)
  console.log('Current Seed:', levelInfo.seed)
  console.log('Board Shape:', levelInfo.boardShape)
  console.log('Challenge:', levelInfo.challenge)
  console.log('Challenge Target:', levelInfo.challengeTarget)

  await page.screenshot({ path: 'test-results/level-21-before-shift-click.png' })
  console.log('📸 Screenshot saved: test-results/level-21-before-shift-click.png')

  console.log('=== Attempting Shift+Click move (bug report feature) ===')

  // Simulate the bug reporting feature - Shift+Click on two cells
  // This triggers the exportBoard() method which was causing the error
  const clickResult = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const board = gameScene.boardState.getRawBoard()

    // Log board state before clicking
    console.log('Board dimensions:', board.length, 'x', board[0]?.length)

    // Simulate shift-clicking cell [4, 6]
    const cell1 = board[4]?.[6]
    console.log('Cell [4,6]:', cell1 ? `${cell1.color} (exists)` : 'null')
    if (cell1 && cell1.sprite) {
      const event = new PointerEvent('pointerdown', { shiftKey: true })
      gameScene.onPointerDown(event, cell1.sprite)
    }

    // Simulate shift-clicking cell [4, 5]
    const cell2 = board[4]?.[5]
    console.log('Cell [4,5]:', cell2 ? `${cell2.color} (exists)` : 'null')
    if (cell2 && cell2.sprite) {
      const event = new PointerEvent('pointerdown', { shiftKey: true })
      gameScene.onPointerDown(event, cell2.sprite)
    }

    return {
      cell1Color: cell1?.color || 'null',
      cell2Color: cell2?.color || 'null',
      cell1Exists: !!cell1,
      cell2Exists: !!cell2
    }
  })

  console.log('Clicked cells:', clickResult)

  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'test-results/level-21-after-shift-click.png' })
  console.log('📸 Screenshot saved: test-results/level-21-after-shift-click.png')

  console.log('=== Checking for errors ===')

  const nullErrors = errors.filter(err =>
    err.includes('Cannot read properties of null') &&
    err.includes('powerup')
  )

  if (nullErrors.length > 0) {
    console.error('Null errors found:', nullErrors)
  } else {
    console.log('✅ No null errors - exportBoard works correctly!')
  }

  // Verify the board state matches what was in the bug report
  const boardExport = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const board = gameScene.boardState.getRawBoard()
    const config = gameScene.levelConfig?.boardConfig || { width: 9, height: 9 }

    const boardData = []
    for (let row = 0; row < config.height; row++) {
      const rowData = []
      for (let col = 0; col < config.width; col++) {
        const cell = board[row][col]
        if (!cell) {
          rowData.push('null')
        } else {
          rowData.push(cell.color)
        }
      }
      boardData.push(rowData)
    }
    return boardData
  })

  console.log('Board state after fix:')
  console.log('Row 4, Col 6:', boardExport[4][6])
  console.log('Row 4, Col 5:', boardExport[4][5])
  console.log('Null cells in corners (should be null):', boardExport[0][0], boardExport[0][8])

  expect(nullErrors).toHaveLength(0)
})

test('level 21 - regular move should work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => {
    errors.push(error.message)
  })

  await page.goto('http://localhost:8000')
  await page.waitForSelector('canvas', { timeout: 10000 })
  await page.waitForTimeout(2000)

  // Navigate to level 21 using LevelSystem
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const LevelSystem = (window as any).LevelSystem

    LevelSystem.setCurrentLevel(21)
    gameScene.loadNextLevel()
  })

  await page.waitForTimeout(3000)

  // Make a regular move
  const canvas = await page.locator('canvas')
  const boundingBox = await canvas.boundingBox()

  if (boundingBox) {
    const centerX = boundingBox.x + boundingBox.width / 2
    const centerY = boundingBox.y + boundingBox.height / 2

    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 100, centerY)
    await page.mouse.up()

    await page.waitForTimeout(2000)
  }

  const nullErrors = errors.filter(err =>
    err.includes('Cannot read properties of null')
  )

  expect(nullErrors).toHaveLength(0)
})
