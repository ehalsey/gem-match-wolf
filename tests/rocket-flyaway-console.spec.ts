import { test, expect } from '@playwright/test'

test('rocket + fly away - check console logs', async ({ page }) => {
  const consoleLogs: string[] = []

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text()
    consoleLogs.push(text)
    console.log(`[BROWSER]: ${text}`)
  })

  await page.goto('http://localhost:8000/?debug=true&board=rocket-flyaway-combo', {
    waitUntil: 'domcontentloaded'
  })

  // Hard reload
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Set challenge
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    gameScene.currentChallenge = {
      type: 'color-match',
      color: 'blue',
      targetValue: 20,
      currentValue: 0
    }
    console.log('✅ Challenge set to color-match blue')
  })

  await page.waitForTimeout(500)

  // Check power-ups are there
  const powerups = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    const rocket = gameScene.board[4][3]
    const flyAway = gameScene.board[4][4]
    console.log(`Rocket at [4,3]: powerup=${rocket.powerup}, color=${rocket.color}`)
    console.log(`Fly-away at [4,4]: powerup=${flyAway.powerup}, color=${flyAway.color}`)
    return {
      rocketPowerup: rocket.powerup,
      flyAwayPowerup: flyAway.powerup
    }
  })

  console.log('Power-ups:', powerups)

  // Get positions
  const bounds = await page.evaluate(() => {
    const CELL_SIZE = 80
    return {
      rocketX: 3 * CELL_SIZE + CELL_SIZE / 2,
      rocketY: 4 * CELL_SIZE + CELL_SIZE / 2,
      flyAwayX: 4 * CELL_SIZE + CELL_SIZE / 2,
      flyAwayY: 4 * CELL_SIZE + CELL_SIZE / 2
    }
  })

  // Trigger the combo directly via game API
  console.log('🔧 Triggering combo via game API...')
  await page.evaluate(async () => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    const rocketCell = gameScene.board[4][3]
    const flyAwayCell = gameScene.board[4][4]

    console.log('📍 Calling triggerRocketFlyAwayCombo directly...')
    const maybePromise = gameScene.triggerRocketFlyAwayCombo(rocketCell, flyAwayCell)
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise
    }

    // Also trigger destroy/fall/refill
    await gameScene.destroyCells()
    await gameScene.makeCellsFall()
    await gameScene.refillBoard()
  })

  console.log('✅ Combo triggered, waiting for completion...')
  await page.waitForTimeout(2000)

  // Check logs
  console.log('\n=== CONSOLE LOGS ===')
  const comboLogs = consoleLogs.filter(log =>
    log.includes('COMBO') || log.includes('ROCKET') || log.includes('FLY-AWAY') || log.includes('power-up')
  )

  if (comboLogs.length > 0) {
    console.log('Found combo-related logs:')
    comboLogs.forEach(log => console.log(`  - ${log}`))
  } else {
    console.log('❌ NO COMBO LOGS FOUND!')
  }

  // Check final state
  const finalRow2 = await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1] as any
    return gameScene.board[2].map((cell: any) => cell.color)
  })

  console.log('\n📊 Final row 2:', finalRow2.join(', '))
})
