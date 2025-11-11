# Testing Variable Board Dimensions

This document describes how to test the variable board dimensions feature, including automated tests and manual testing procedures.

## Feature Overview

The variable board dimensions feature allows different board sizes and shapes:
- **Levels 1-19**: 8x8 rectangular boards (backward compatible)
- **Level 20**: 9x9 rectangular board
- **Level 21**: 9x9 octagon board (corners removed)
- **Level 22**: 9x9 diamond board (more corners removed)

## Automated Tests

### Running the Tests

```bash
npm test -- tests/variable-boards.spec.ts
```

### Test Coverage

The automated test suite includes 5 tests that validate:

1. **Default 8x8 Board Config** - Verifies standard levels return 8x8 configuration
2. **9x9 Board Config (Level 20)** - Verifies level 20 returns 9x9 rectangular configuration
3. **Octagon Board Config (Level 21)** - Verifies level 21 returns 9x9 octagon with missing cells
4. **Diamond Board Config (Level 22)** - Verifies level 22 returns 9x9 diamond with more missing cells
5. **Backward Compatibility** - Verifies levels 1, 5, 10, 15, and 19 all use 8x8 boards

All tests validate the `LevelSystem.getLevelConfig()` method returns correct `boardConfig` objects.

## Manual Testing

### Prerequisites

1. Start the development server:
   ```bash
   npm start
   ```

2. Navigate to `http://localhost:8000` in your browser

3. Open the browser console (F12 or Cmd+Option+I)

### Test Procedure

#### Test 1: Verify Default 8x8 Boards

**Steps:**
1. Start a new game
2. Play through levels 1-5
3. Observe the board size

**Expected Results:**
- Board should be 8x8 for all levels
- All cells should be rendered with gems
- Game mechanics should work normally

#### Test 2: Verify 9x9 Rectangular Board (Level 20)

**Steps:**
1. In the browser console, run:
   ```javascript
   LevelSystem.setCurrentLevel(20)
   location.reload()
   ```
2. Observe the board after reload

**Expected Results:**
- Board should be 9x9 (visibly larger than 8x8)
- All 81 cells should be rendered with gems
- No missing cells in corners
- Matching should work correctly
- Power-ups should work correctly

**Verification:**
```javascript
// In browser console - should return 9
game.scene.keys.default.boardState.getWidth()
game.scene.keys.default.boardState.getHeight()

// Should return 81
game.scene.keys.default.boardState.getAllCells().length
```

#### Test 3: Verify Octagon Board (Level 21)

**Steps:**
1. In the browser console, run:
   ```javascript
   LevelSystem.setCurrentLevel(21)
   location.reload()
   ```
2. Observe the board after reload

**Expected Results:**
- Board should be 9x9 with corners removed (octagon shape)
- Corner cells should be empty/missing
- Only valid cells should have gems rendered
- Gems should not fall into missing cells
- Matching should work correctly in the octagon shape

**Verification:**
```javascript
// Should return 9x9
game.scene.keys.default.boardState.getWidth()  // 9
game.scene.keys.default.boardState.getHeight() // 9

// Should be less than 81 due to missing corners
game.scene.keys.default.boardState.getAllCells().length

// Count null cells in raw board
const rawBoard = game.scene.keys.default.boardState.getRawBoard()
let nullCount = 0
for (let row = 0; row < 9; row++) {
  for (let col = 0; col < 9; col++) {
    if (rawBoard[row][col] === null) nullCount++
  }
}
console.log('Missing cells:', nullCount)  // Should be > 0
```

#### Test 4: Verify Diamond Board (Level 22)

**Steps:**
1. In the browser console, run:
   ```javascript
   LevelSystem.setCurrentLevel(22)
   location.reload()
   ```
2. Observe the board after reload

**Expected Results:**
- Board should be 9x9 with more corners removed (diamond shape)
- Should have more missing cells than octagon
- Only valid cells should have gems rendered
- Matching should work correctly in the diamond shape

**Verification:**
```javascript
// Should return 9x9
game.scene.keys.default.boardState.getWidth()  // 9
game.scene.keys.default.boardState.getHeight() // 9

// Should be less than octagon cell count
game.scene.keys.default.boardState.getAllCells().length
```

#### Test 5: Verify Backward Compatibility

**Steps:**
1. Start a new game
2. For each level (1, 5, 10, 15, 19):
   ```javascript
   LevelSystem.setCurrentLevel(LEVEL_NUMBER)
   location.reload()
   ```
3. Verify board is 8x8

**Expected Results:**
- All tested levels should have 8x8 boards
- No visual or functional differences from before the feature was added
- All game mechanics work normally

### Edge Cases to Test

1. **Power-ups on larger boards**
   - Create horizontal/vertical rockets on 9x9 board
   - Verify they clear entire row/column (9 cells instead of 8)

2. **Power-ups on non-rectangular boards**
   - Create TNT on octagon board near missing cells
   - Verify it doesn't try to affect missing cells

3. **Falling gems on non-rectangular boards**
   - Make matches near missing cells
   - Verify gems don't fall into missing cell positions

4. **Matching near board edges**
   - Test matching at the edges of 9x9 boards
   - Test matching near missing cells in shaped boards

## Troubleshooting

### Board Still Shows 8x8 After Setting Level 20+

**Problem:** After running `LevelSystem.setCurrentLevel(20)` and reloading, the board is still 8x8.

**Solution:** This was a bug that has been fixed. Ensure you're on the latest commit of the `refactor/variable-boards` branch. The fix ensures `levelConfig` is loaded before the board is initialized.

### Missing Cells Not Rendering Correctly

**Problem:** Cells that should be missing still show gems.

**Solution:** Check that the `GameScene.initBoard()` method is using the `boardConfig.missingCells` array correctly when creating the `BoardState`.

### Tests Failing

**Problem:** Automated tests are failing.

**Solution:**
1. Ensure the development server is running (`npm start`)
2. Check that no other process is using port 8000
3. Clear browser cache and localStorage
4. Run tests again

## Next Steps

After verifying the variable board dimensions work correctly:

1. Add more non-rectangular board shapes to additional levels
2. Implement obstacle rendering system
3. Create levels that combine shaped boards with obstacles
4. Add visual indicators for board shape (optional)

## References

- Level configurations: `src/LevelSystem.ts:248`
- Board state implementation: `src/game/BoardState.ts`
- Board initialization: `src/GameScene.ts:183`
- Automated tests: `tests/variable-boards.spec.ts`
