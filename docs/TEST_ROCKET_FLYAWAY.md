# Manual Test: Rocket + Fly Away Combo

## Test the Combo

1. Open the game with the test board:
   ```
   http://localhost:8000/?debug=true&board=rocket-flyaway-combo
   ```

2. Open the browser console (F12)

3. Set a blue color-match challenge (row 2 has the most blue gems):
   ```javascript
   gameScene = window.game.scene.scenes[1]
   gameScene.currentChallenge = {
     type: 'color-match',
     color: 'blue',
     targetValue: 20,
     currentValue: 0
   }
   ```

4. Check the board state:
   ```javascript
   // Row 2 should have lots of blue gems
   for (let col = 0; col < 8; col++) {
     console.log(`Row 2, Col ${col}: ${gameScene.board[2][col].color}`)
   }
   ```

5. **Drag the horizontal rocket (at row 4, col 3) onto the fly away (at row 4, col 4)**

6. Watch what happens:
   - Fly away should fly in an arc to row 2
   - Row 2 should be cleared with a rocket explosion (wave animation)
   - Board refills

7. Check row 2 after:
   ```javascript
   for (let col = 0; col < 8; col++) {
     console.log(`Row 2, Col ${col}: ${gameScene.board[2][col].color}`)
   }
   ```

## Expected Behavior

- ✅ Fly away flies in arc motion (no spinning)
- ✅ Flies to row 2 (the row with most blue gems)
- ✅ Row 2 cleared by horizontal rocket explosion
- ✅ Wave animation radiating from center
- ✅ Board refills after clearing

## Automated Test Results

The automated test confirms:
- Row 2 had 7 blue gems before combo
- Row 2 was completely destroyed (all gems changed colors after refill)
- Rocket explosion is working correctly

**Test file:** `tests/rocket-flyaway-combo.spec.ts`
**Run test:** `npx playwright test tests/rocket-flyaway-combo.spec.ts --headed --grep "horizontal rocket"`
