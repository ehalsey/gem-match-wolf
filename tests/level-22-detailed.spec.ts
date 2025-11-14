import { test, expect } from '@playwright/test'

test('capture all errors and logs on level 22', async ({ page }) => {
  // Capture everything
  const allLogs: Array<{ type: string, text: string }> = []

  page.on('console', msg => {
    allLogs.push({ type: msg.type(), text: msg.text() })
    console.log(`[${msg.type()}]`, msg.text())
  })

  page.on('pageerror', error => {
    allLogs.push({ type: 'pageerror', text: error.message })
    console.log('[PAGE ERROR]', error.message)
    console.log('[STACK]', error.stack)
  })

  await page.goto('http://localhost:8000')
  await page.waitForSelector('canvas', { timeout: 10000 })
  await page.waitForTimeout(2000)

  console.log('=== Navigating to Level 22 ===')

  // Jump to level 22 using LevelSystem
  await page.evaluate(() => {
    const gameScene = (window as any).game.scene.scenes[1]
    const LevelSystem = (window as any).LevelSystem

    LevelSystem.setCurrentLevel(22)
    gameScene.loadNextLevel()
  })

  await page.waitForTimeout(3000)

  console.log('=== Level 22 Loaded ===')

  // Try making several moves
  const canvas = await page.locator('canvas')
  const boundingBox = await canvas.boundingBox()

  if (boundingBox) {
    console.log('=== Attempting moves ===')

    // Move 1: horizontal
    await page.mouse.move(boundingBox.x + 200, boundingBox.y + 200)
    await page.mouse.down()
    await page.mouse.move(boundingBox.x + 280, boundingBox.y + 200)
    await page.mouse.up()
    await page.waitForTimeout(1500)

    // Move 2: vertical
    await page.mouse.move(boundingBox.x + 150, boundingBox.y + 150)
    await page.mouse.down()
    await page.mouse.move(boundingBox.x + 150, boundingBox.y + 230)
    await page.mouse.up()
    await page.waitForTimeout(1500)
  }

  console.log('=== Final Error Summary ===')
  const errors = allLogs.filter(log =>
    log.type === 'error' ||
    log.type === 'pageerror' ||
    log.text.includes('Error') ||
    log.text.includes('failed')
  )

  if (errors.length > 0) {
    console.log('Errors found:', JSON.stringify(errors, null, 2))
  } else {
    console.log('No errors detected!')
  }

  // Don't fail the test, just report
  console.log(`Total logs: ${allLogs.length}, Errors: ${errors.length}`)
})
